/**
 * FCM 푸시 알림 서비스 (Phase 0 — Mock / Phase 1 — firebase-admin)
 *
 * 아키텍처:
 *   notificationService
 *     ├── subscribe(traderId, deviceToken)   — 구독 등록 (인메모리)
 *     ├── unsubscribe(traderId, deviceToken) — 구독 해제
 *     └── tradeEventEmitter 'trade' 구독
 *           → FCM 키 있으면 firebase-admin으로 실제 발송
 *           → FCM 키 없으면 pendingQueue에 적재 + 로그 출력 (FE 폴링용 fallback)
 *
 * Phase 1 전환 조건: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY 세팅
 */

import { tradeEventEmitter, type TradeEvent } from './traderEngine'
import { logger } from './logger'

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

export interface TradeNotification {
  title: string
  body: string
  data: {
    traderId: string
    tradeId: string
    action: 'buy' | 'sell'
    symbol: string
    url: string
  }
}

export interface PendingNotification {
  id: string
  traderId: string
  deviceToken: string
  notification: TradeNotification
  createdAt: string
  status: 'pending' | 'sent' | 'failed'
}

// ─── 인메모리 상태 ────────────────────────────────────────────────────────────

/** traderId → Set<deviceToken> */
const subscriptions = new Map<string, Set<string>>()

/** FE 폴링용 pending 큐 (최대 500건, FIFO) */
const pendingQueue: PendingNotification[] = []
const MAX_PENDING = 500

// ─── FCM 초기화 (환경변수 존재 시만 활성화) ──────────────────────────────────

const FCM_ENABLED =
  Boolean(process.env.FIREBASE_PROJECT_ID) &&
  Boolean(process.env.FIREBASE_CLIENT_EMAIL) &&
  Boolean(process.env.FIREBASE_PRIVATE_KEY)

// firebase-admin은 동적 import — 패키지 미설치 시 런타임 에러 방지
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let firebaseMessaging: any | null = null

async function initFirebase(): Promise<void> {
  if (!FCM_ENABLED) {
    logger.info('FCM 키 미설정 — 알림 Mock 모드로 동작 (Phase 0)')
    return
  }

  try {
    // firebase-admin이 설치된 경우에만 실행 (패키지 미설치 시 catch로 폴백)
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
    const admin = require('firebase-admin') as {
      apps: unknown[]
      initializeApp: (options: unknown) => void
      credential: { cert: (serviceAccount: unknown) => unknown }
      messaging: () => {
        send: (message: unknown) => Promise<string>
      }
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId:   process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // \n 이스케이프 복원 (환경변수 단일 라인 처리)
          privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      })
    }

    firebaseMessaging = admin.messaging()
    logger.info({ projectId: process.env.FIREBASE_PROJECT_ID }, 'Firebase Admin 초기화 완료')
  } catch (err) {
    logger.error({ err }, 'Firebase Admin 초기화 실패 — Mock 모드로 폴백')
    firebaseMessaging = null
  }
}

// ─── 알림 페이로드 빌더 ───────────────────────────────────────────────────────

const TRADER_NAMES: Record<string, string> = {
  alpha:   '알파 트레이더',
  beta:    '베타 트레이더',
  gamma:   '감마 트레이더',
  delta:   '델타 트레이더',
  epsilon: '엡실론 트레이더',
}

function buildNotificationPayload(event: TradeEvent): TradeNotification {
  const traderName = TRADER_NAMES[event.traderId] ?? event.traderId
  const actionKr   = event.action === 'buy' ? '매수' : '매도'
  const pnlSign    = event.totalReturn >= 0 ? '+' : ''
  const pnlPct     = `${pnlSign}${(event.totalReturn * 100).toFixed(2)}%`

  // 가격 포맷: 국내(KRW) vs 해외(USD) 구분
  const isUsd   = !event.symbol.startsWith('KRW-') && !/^\d{6}$/.test(event.symbol) && !/^\d{6}$/.test(event.symbol)
  const currency = isUsd ? '$' : '₩'
  const priceStr = isUsd
    ? event.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : event.price.toLocaleString('ko-KR')

  return {
    title: `${traderName} — ${event.symbolName} ${actionKr}`,
    body:  `${event.symbol} × ${event.quantity.toLocaleString()}주 @ ${currency}${priceStr} | ${pnlPct} 수익 중`,
    data: {
      traderId: event.traderId,
      tradeId:  `trade_${event.timestamp.replace(/\D/g, '').slice(0, 14)}`,
      action:   event.action,
      symbol:   event.symbol,
      url:      `/trader/${event.traderId}`,
    },
  }
}

// ─── FCM 발송 ─────────────────────────────────────────────────────────────────

async function sendFcmMessage(deviceToken: string, payload: TradeNotification): Promise<void> {
  if (!firebaseMessaging) {
    throw new Error('firebase-admin 미초기화')
  }

  await firebaseMessaging.send({
    token:        deviceToken,
    notification: {
      title: payload.title,
      body:  payload.body,
    },
    data:         payload.data,
    webpush: {
      notification: {
        title: payload.title,
        body:  payload.body,
        icon:  '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        requireInteraction: false,
      },
      fcmOptions: {
        link: payload.data.url,
      },
    },
  })
}

// ─── 알림 발송 (구독자 전체) ──────────────────────────────────────────────────

async function dispatchNotifications(event: TradeEvent): Promise<void> {
  const tokens = subscriptions.get(event.traderId)
  if (!tokens || tokens.size === 0) return

  const payload = buildNotificationPayload(event)

  const sendTasks = [...tokens].map(async (deviceToken) => {
    if (FCM_ENABLED && firebaseMessaging) {
      // 실제 FCM 발송
      try {
        await sendFcmMessage(deviceToken, payload)
        logger.info(
          {
            traderId:         event.traderId,
            symbol:           event.symbol,
            action:           event.action,
            deviceTokenSuffix: deviceToken.slice(-8),
          },
          'FCM 푸시 발송 완료',
        )
      } catch (err) {
        logger.error(
          {
            err,
            traderId:         event.traderId,
            deviceTokenSuffix: deviceToken.slice(-8),
          },
          'FCM 푸시 발송 실패',
        )

        // 발송 실패 시 pending 큐에 적재 (FE fallback)
        enqueuePending(event.traderId, deviceToken, payload, 'failed')
      }
    } else {
      // Phase 0: Mock 발송 — 로그 + pending 큐 적재
      logger.info(
        {
          traderId:          event.traderId,
          symbol:            event.symbol,
          action:            event.action,
          title:             payload.title,
          body:              payload.body,
          deviceTokenSuffix: deviceToken.slice(-8),
        },
        'FCM 발송 시뮬레이션 (Phase 0 Mock)',
      )

      enqueuePending(event.traderId, deviceToken, payload, 'pending')
    }
  })

  // 구독자 수에 무관하게 병렬 발송
  await Promise.all(sendTasks)
}

// ─── Pending 큐 관리 ─────────────────────────────────────────────────────────

function enqueuePending(
  traderId:    string,
  deviceToken: string,
  payload:     TradeNotification,
  status:      'pending' | 'failed',
): void {
  const entry: PendingNotification = {
    id:           `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    traderId,
    deviceToken,
    notification: payload,
    createdAt:    new Date().toISOString(),
    status,
  }

  pendingQueue.push(entry)

  // FIFO: 최대 건수 초과 시 오래된 항목 제거
  if (pendingQueue.length > MAX_PENDING) {
    pendingQueue.splice(0, pendingQueue.length - MAX_PENDING)
  }
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * traderId에 deviceToken 구독 등록
 * 중복 등록 시 Set 특성상 무시
 */
export function subscribe(traderId: string, deviceToken: string): void {
  const tokens = subscriptions.get(traderId) ?? new Set<string>()
  tokens.add(deviceToken)
  subscriptions.set(traderId, tokens)

  logger.info(
    {
      traderId,
      subscriberCount:   tokens.size,
      deviceTokenSuffix: deviceToken.slice(-8),
    },
    '알림 구독 등록',
  )
}

/**
 * traderId의 deviceToken 구독 해제
 * 해당 traderId의 마지막 구독자면 Map 엔트리도 정리
 */
export function unsubscribe(traderId: string, deviceToken: string): void {
  const tokens = subscriptions.get(traderId)
  if (!tokens) return

  tokens.delete(deviceToken)

  if (tokens.size === 0) {
    subscriptions.delete(traderId)
  }

  logger.info(
    {
      traderId,
      remainingSubscribers: tokens.size,
      deviceTokenSuffix:    deviceToken.slice(-8),
    },
    '알림 구독 해제',
  )
}

/**
 * traderId의 현재 구독자 수
 */
export function getSubscriberCount(traderId: string): number {
  return subscriptions.get(traderId)?.size ?? 0
}

/**
 * 전체 구독 현황 스냅샷 (진단·모니터링용)
 */
export function getSubscriptionStats(): Record<string, number> {
  const stats: Record<string, number> = {}
  for (const [traderId, tokens] of subscriptions) {
    stats[traderId] = tokens.size
  }
  return stats
}

/**
 * FE 폴링용 pending 알림 목록
 * deviceToken이 주어지면 해당 토큰의 알림만 반환, 없으면 전체
 *
 * 주의: deviceToken을 응답에 노출하지 않음 (suffix 8자만)
 */
export function getPendingNotifications(deviceToken?: string): Omit<PendingNotification, 'deviceToken'>[] {
  const filtered = deviceToken
    ? pendingQueue.filter((n) => n.deviceToken === deviceToken)
    : pendingQueue

  return filtered.map(({ deviceToken: _dt, ...rest }) => rest)
}

/**
 * 특정 알림 ID를 consumed 처리 (pending 큐에서 제거)
 */
export function consumeNotification(notificationId: string): boolean {
  const idx = pendingQueue.findIndex((n) => n.id === notificationId)
  if (idx === -1) return false
  pendingQueue.splice(idx, 1)
  return true
}

// ─── 이벤트 리스너 등록 ───────────────────────────────────────────────────────

/**
 * notificationService 초기화
 * traderEngine의 'trade' 이벤트를 구독하여 알림 발송 파이프라인 연결
 */
export async function startNotificationService(): Promise<void> {
  await initFirebase()

  tradeEventEmitter.on('trade', (event: TradeEvent) => {
    // 비동기 에러가 프로세스를 죽이지 않도록 내부에서 catch
    dispatchNotifications(event).catch((err: unknown) => {
      logger.error({ err }, '알림 발송 파이프라인 오류')
    })
  })

  logger.info(
    { fcmEnabled: FCM_ENABLED },
    `알림 서비스 시작 (${FCM_ENABLED ? 'FCM 실제 발송' : 'Phase 0 Mock 모드'})`,
  )
}

/**
 * notificationService 종료 (Graceful Shutdown)
 */
export function stopNotificationService(): void {
  tradeEventEmitter.removeAllListeners('trade')
  subscriptions.clear()
  pendingQueue.splice(0)
  logger.info('알림 서비스 종료')
}

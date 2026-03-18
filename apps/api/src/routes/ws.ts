import type { FastifyInstance } from 'fastify'
import type { SocketStream } from '@fastify/websocket'
import type { WebSocket } from 'ws'
import { Kafka } from 'kafkajs'
import { logger } from '../lib/logger'
import {
  setCryptoPriceCache,
  getCryptoPriceFromCache,
  type CryptoPricePayload,
} from '../lib/priceCache'

/**
 * WebSocket 브로드캐스트 서버 (S1-002 업비트 연동)
 *
 * 데이터 흐름:
 *   Kafka(crypto.raw) → Redis 캐시 업데이트 → 구독 클라이언트 브로드캐스트
 *   Kafka(price.validated) → 구독 클라이언트 브로드캐스트 (주식)
 *
 * 업비트 인프라 운영 경험 기반:
 * - 종목별 구독 Set으로 팬아웃 최소화
 * - 연결당 최대 구독 50개 제한 (메모리 보호)
 * - 이상값(캐시 저장 거부된 메시지)은 브로드캐스트 제외
 * - stale 감지 시 { type: "stale" } 메시지 별도 전송
 */

const MAX_SUBSCRIPTIONS_PER_CONNECTION = 50
const HEARTBEAT_INTERVAL_MS  = 30_000
const STALE_CHECK_INTERVAL_MS = 5_000

// symbol 유효성: 업비트 형식(KRW-BTC) + 기존 형식(UPBIT_BTC_KRW) 모두 허용
const SYMBOL_PATTERN = /^[A-Z0-9_\-]{1,20}$/

// 종목 → ws.WebSocket Set (글로벌 구독 맵)
const subscriptionMap = new Map<string, Set<WebSocket>>()

// Kafka consumer 싱글턴
let kafkaConsumer: Awaited<ReturnType<InstanceType<typeof Kafka>['consumer']>> | null = null

type ClientMessage =
  | { type: 'subscribe';   symbols: string[] }
  | { type: 'unsubscribe'; symbols: string[] }
  | { type: 'ping' }

// ─── 구독 맵 헬퍼 ────────────────────────────────────────────────────────

function addSubscription(symbol: string, ws: WebSocket): void {
  if (!subscriptionMap.has(symbol)) {
    subscriptionMap.set(symbol, new Set())
  }
  subscriptionMap.get(symbol)!.add(ws)
}

function removeSubscription(symbol: string, ws: WebSocket): void {
  const subscribers = subscriptionMap.get(symbol)
  if (!subscribers) return
  subscribers.delete(ws)
  if (subscribers.size === 0) {
    subscriptionMap.delete(symbol)
  }
}

function broadcastToSubscribers(symbol: string, payload: string): void {
  const subscribers = subscriptionMap.get(symbol)
  if (!subscribers || subscribers.size === 0) return

  for (const ws of subscribers) {
    if (ws.readyState === ws.OPEN) {
      ws.send(payload)
    }
  }
}

// ─── 라우트 ──────────────────────────────────────────────────────────────

export async function wsRoutes(app: FastifyInstance) {
  const kafka = new Kafka({
    clientId: 'costock-ws-server',
    brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
    retry: { retries: 0 },
  })

  kafkaConsumer = kafka.consumer({ groupId: 'ws-broadcaster' })
  try {
    await kafkaConsumer.connect()

    // crypto.raw: 업비트 수집기 원본 / price.validated: 정규화 서비스 (주식 등)
    await kafkaConsumer.subscribe({ topic: 'crypto.raw',      fromBeginning: false })
    await kafkaConsumer.subscribe({ topic: 'price.validated', fromBeginning: false })
  } catch (err) {
    logger.warn({ err }, 'Kafka 연결 실패 — 개발 환경에서 실시간 스트림 없이 실행')
    kafkaConsumer = null
  }

  if (kafkaConsumer !== null) await kafkaConsumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return

      let raw: Record<string, unknown>
      try {
        raw = JSON.parse(message.value.toString())
      } catch {
        logger.warn({ topic }, 'Kafka 메시지 파싱 실패 — 건너뜀')
        return
      }

      if (topic === 'crypto.raw') {
        // ── 업비트 코인 가격 처리 ──────────────────────────────────
        const symbol = typeof raw['symbol'] === 'string' ? raw['symbol'] : null
        if (!symbol) return

        const payload: CryptoPricePayload = {
          symbol,
          price:      Number(raw['price']      ?? 0),
          change:     Number(raw['change']     ?? 0),
          changeRate: Number(raw['changeRate'] ?? 0),
          volume24h:  Number(raw['volume24h']  ?? 0),
          timestamp:  Number(raw['timestamp']  ?? Date.now()),
          source:     (raw['source'] === 'bithumb') ? 'bithumb' : 'upbit',
        }

        // Redis 캐시 저장 — 이상값이면 false 반환, 브로드캐스트 건너뜀
        const cached = await setCryptoPriceCache(app.redis, payload)
        if (!cached) {
          // 이상값: 캐시 미저장 + 브로드캐스트 제외
          logger.warn({ symbol, price: payload.price }, '이상값 — 브로드캐스트 제외')
          return
        }

        // 정상 가격: 구독 클라이언트에 브로드캐스트
        const outbound = JSON.stringify({
          type:       'price',
          symbol,
          price:      payload.price,
          change:     payload.change,
          changeRate: payload.changeRate,
          volume24h:  payload.volume24h,
          timestamp:  payload.timestamp,
          assetType:  'crypto',
          source:     payload.source,
        })
        broadcastToSubscribers(symbol, outbound)

      } else if (topic === 'price.validated') {
        // ── 주식 가격 처리 (정규화 완료) ──────────────────────────
        const symbol = typeof raw['symbol'] === 'string' ? raw['symbol'] : null
        if (!symbol) return

        const outbound = JSON.stringify({
          type:      'price',
          symbol,
          price:     raw['price'],
          assetType: raw['assetType'] ?? 'stock',
          ts:        raw['ts'] ?? raw['timestamp'],
        })
        broadcastToSubscribers(symbol, outbound)
      }
    },
  }) // end kafkaConsumer.run

  // ── stale 감지 루프 ──────────────────────────────────────────────────
  // 구독 중인 코인 종목에 대해 5초마다 Redis 캐시 freshness 확인
  setInterval(async () => {
    if (subscriptionMap.size === 0) return

    const symbols = [...subscriptionMap.keys()]

    // 독립 작업 — 병렬 처리
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const cached = await getCryptoPriceFromCache(app.redis, symbol)
          return { symbol, cached }
        } catch {
          return { symbol, cached: null }
        }
      }),
    )

    for (const { symbol, cached } of results) {
      if (cached?.stale === true) {
        const staleMsg = JSON.stringify({
          type:        'stale',
          symbol,
          lastUpdated: cached.cachedAt,
        })
        broadcastToSubscribers(symbol, staleMsg)
      }
    }
  }, STALE_CHECK_INTERVAL_MS)

  // ── WebSocket 엔드포인트 ─────────────────────────────────────────────
  // connection: SocketStream — .socket 으로 ws.WebSocket 접근
  app.get('/prices', { websocket: true }, (connection: SocketStream, req) => {
    const ws = connection.socket
    const subscribedSymbols = new Set<string>()

    logger.info({ ip: req.ip }, 'WebSocket 연결 수립')

    // 하트비트
    const heartbeatTimer = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }))
      }
    }, HEARTBEAT_INTERVAL_MS)

    // ── 클라이언트 메시지 처리 ───────────────────────────────────────
    ws.on('message', (rawData) => {
      let msg: ClientMessage
      try {
        msg = JSON.parse(rawData.toString())
      } catch {
        ws.send(JSON.stringify({
          type:    'error',
          message: '올바르지 않은 메시지 형식입니다.',
        }))
        return
      }

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }))
        return
      }

      if (msg.type === 'subscribe') {
        // 유효한 심볼만 필터링 + 신규 구독만 추가
        const toAdd = msg.symbols.filter(
          (s) => SYMBOL_PATTERN.test(s) && !subscribedSymbols.has(s),
        )

        if (subscribedSymbols.size + toAdd.length > MAX_SUBSCRIPTIONS_PER_CONNECTION) {
          ws.send(JSON.stringify({
            type:    'error',
            message: `구독 한도 초과: 최대 ${MAX_SUBSCRIPTIONS_PER_CONNECTION}개 종목까지 구독 가능합니다.`,
          }))
          return
        }

        for (const symbol of toAdd) {
          subscribedSymbols.add(symbol)
          addSubscription(symbol, ws)
        }

        ws.send(JSON.stringify({
          type:    'subscribed',
          symbols: [...subscribedSymbols],
        }))
        return
      }

      if (msg.type === 'unsubscribe') {
        for (const symbol of msg.symbols) {
          subscribedSymbols.delete(symbol)
          removeSubscription(symbol, ws)
        }

        ws.send(JSON.stringify({
          type:    'unsubscribed',
          symbols: msg.symbols,
        }))
      }
    })

    // ── 연결 종료 — 구독 맵 정리 필수 ────────────────────────────────
    ws.on('close', () => {
      clearInterval(heartbeatTimer)
      for (const symbol of subscribedSymbols) {
        removeSubscription(symbol, ws)
      }
      subscribedSymbols.clear()
      logger.info({ ip: req.ip }, 'WebSocket 연결 종료')
    })

    ws.on('error', (err) => {
      logger.error({ err: { message: err.message } }, 'WebSocket 에러')
    })
  })

  // ── Graceful shutdown ────────────────────────────────────────────────
  app.addHook('onClose', async () => {
    if (kafkaConsumer) {
      await kafkaConsumer.disconnect()
      logger.info('Kafka consumer 종료')
    }
  })
}

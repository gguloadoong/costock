/**
 * AI 트레이더 REST API 라우트
 *
 * GET /api/v1/traders                    — 트레이더 목록 (수익률 랭킹)
 * GET /api/v1/traders/:id                — 트레이더 상세 (프로필 + 통계)
 * GET /api/v1/traders/:id/positions      — 현재 보유 포지션
 * GET /api/v1/traders/:id/trades         — 매매 히스토리 (최근 30개)
 * GET /api/v1/traders/:id/pnl            — 실현손익 (월별, ?year=2026)
 * GET /api/v1/traders/:id/pnl/:year/:month — 월별 일별 상세
 *
 * POST /api/v1/notifications/subscribe          — 알림 구독
 * DELETE /api/v1/notifications/subscribe/:traderId — 알림 구독 해제
 *
 * 모든 응답에 isSimulated: true 포함 — 실제 자금 없는 모의투자
 */

import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import {
  getAllTraders,
  getTrader,
  getPositions,
  getTrades,
  getMonthlyPnl,
  getDailyPnl,
} from '../lib/traderEngine'
import {
  subscribe,
  unsubscribe,
  getSubscriberCount,
  getPendingNotifications,
  consumeNotification,
} from '../lib/notificationService'
import { logger } from '../lib/logger'

// ─── 유효성 검사 스키마 ───────────────────────────────────────────────────

const VALID_TRADER_IDS = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'] as const
type TraderId = typeof VALID_TRADER_IDS[number]

const TraderIdSchema = z.enum(VALID_TRADER_IDS)

const TradesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
})

const PnlQuerySchema = z.object({
  year: z.coerce.number().int().min(2024).max(2030).default(2026),
})

const PnlDetailParamsSchema = z.object({
  id:    z.enum(VALID_TRADER_IDS),
  year:  z.coerce.number().int().min(2024).max(2030),
  month: z.coerce.number().int().min(1).max(12),
})

const NotificationSubscribeSchema = z.object({
  traderId:    z.enum(VALID_TRADER_IDS),
  deviceToken: z.string().min(10).max(512),
})

const NotificationPendingQuerySchema = z.object({
  deviceToken: z.string().min(10).max(512).optional(),
})

const NotificationConsumeSchema = z.object({
  notificationId: z.string().min(1).max(128),
})

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────

function traderNotFound(reply: FastifyReply, id: string) {
  return reply.status(404).send({
    statusCode: 404,
    error: 'Not Found',
    message: `트레이더 '${id}'를 찾을 수 없습니다. 유효한 ID: ${VALID_TRADER_IDS.join(', ')}`,
    isSimulated: true,
  })
}

// ─── 라우트 등록 ──────────────────────────────────────────────────────────

export async function traderRoutes(app: FastifyInstance) {

  /**
   * GET /api/v1/traders
   * 트레이더 목록 — 총 수익률 내림차순 랭킹
   */
  app.get('/', async (_req, reply) => {
    const traders = getAllTraders()

    // 총 수익률 기준 내림차순 정렬
    const ranked = traders
      .sort((a, b) => b.stats.totalReturn - a.stats.totalReturn)
      .map((t, idx) => ({
        rank: idx + 1,
        id: t.id,
        nameKr: t.nameKr,
        nameEn: t.nameEn,
        strategy: t.strategy,
        strategyDesc: t.strategyDesc,
        assetType: t.assetType,
        stats: {
          totalReturn:       t.stats.totalReturn,
          totalReturnAmount: t.stats.totalReturnAmount,
          winRate:           t.stats.winRate,
          totalTrades:       t.stats.totalTrades,
          portfolioValue:    t.stats.portfolioValue,
          maxDrawdown:       t.stats.maxDrawdown,
          sharpeRatio:       t.stats.sharpeRatio,
        },
        isSimulated: true,
      }))

    return reply.send({
      data:        ranked,
      count:       ranked.length,
      isSimulated: true,
      updatedAt:   new Date().toISOString(),
    })
  })

  /**
   * GET /api/v1/traders/:id
   * 트레이더 상세 — 프로필 + 통계 + 유니버스
   */
  app.get('/:id', async (req, reply) => {
    const parseResult = TraderIdSchema.safeParse((req.params as { id: string }).id)
    if (!parseResult.success) {
      return traderNotFound(reply, (req.params as { id: string }).id)
    }

    const trader = getTrader(parseResult.data)
    if (!trader) return traderNotFound(reply, parseResult.data)

    return reply.send({
      data: {
        id:           trader.id,
        nameKr:       trader.nameKr,
        nameEn:       trader.nameEn,
        strategy:     trader.strategy,
        strategyDesc: trader.strategyDesc,
        assetType:    trader.assetType,
        universe:     trader.universe,
        initialCapital: trader.initialCapital,
        createdAt:    trader.createdAt,
        stats:        trader.stats,
      },
      isSimulated: true,
      updatedAt:   new Date().toISOString(),
    })
  })

  /**
   * GET /api/v1/traders/:id/positions
   * 현재 보유 포지션 목록
   */
  app.get('/:id/positions', async (req, reply) => {
    const parseResult = TraderIdSchema.safeParse((req.params as { id: string }).id)
    if (!parseResult.success) {
      return traderNotFound(reply, (req.params as { id: string }).id)
    }

    const traderId = parseResult.data
    const positions = getPositions(traderId)

    // 평가손익 기준 내림차순
    const sorted = positions.sort((a, b) => b.unrealizedPnl - a.unrealizedPnl)

    return reply.send({
      traderId,
      data:        sorted,
      count:       sorted.length,
      isSimulated: true,
      updatedAt:   new Date().toISOString(),
    })
  })

  /**
   * GET /api/v1/traders/:id/trades?limit=30
   * 매매 히스토리 (최신 순, 기본 30건)
   */
  app.get('/:id/trades', async (req, reply) => {
    const parseResult = TraderIdSchema.safeParse((req.params as { id: string }).id)
    if (!parseResult.success) {
      return traderNotFound(reply, (req.params as { id: string }).id)
    }

    const query = TradesQuerySchema.parse(req.query)
    const traderId = parseResult.data
    const trades = getTrades(traderId, query.limit)

    return reply.send({
      traderId,
      data:        trades,
      count:       trades.length,
      isSimulated: true,
    })
  })

  /**
   * GET /api/v1/traders/:id/pnl?year=2026
   * 실현손익 월별 집계
   */
  app.get('/:id/pnl', async (req, reply) => {
    const parseResult = TraderIdSchema.safeParse((req.params as { id: string }).id)
    if (!parseResult.success) {
      return traderNotFound(reply, (req.params as { id: string }).id)
    }

    const query = PnlQuerySchema.parse(req.query)
    const traderId = parseResult.data
    const monthly = getMonthlyPnl(traderId, query.year)

    // 연간 합계
    const yearlyTotal = monthly.reduce((sum, m) => sum + m.realizedPnl, 0)
    const yearlyTradeCount = monthly.reduce((sum, m) => sum + m.tradeCount, 0)

    return reply.send({
      traderId,
      year:       query.year,
      yearlyPnl:  Math.round(yearlyTotal),
      tradeCount: yearlyTradeCount,
      data:       monthly,
      isSimulated: true,
    })
  })

  /**
   * GET /api/v1/traders/:id/pnl/:year/:month
   * 월별 일별 상세 실현손익
   */
  app.get('/:id/pnl/:year/:month', async (req, reply) => {
    const paramsResult = PnlDetailParamsSchema.safeParse(req.params)
    if (!paramsResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: '올바르지 않은 파라미터입니다.',
        isSimulated: true,
      })
    }

    const { id: traderId, year, month } = paramsResult.data
    const daily = getDailyPnl(traderId, year, month)
    const monthlyTotal = daily.reduce((sum, d) => sum + d.realizedPnl, 0)

    return reply.send({
      traderId,
      year,
      month,
      monthlyPnl: Math.round(monthlyTotal),
      data:       daily,
      isSimulated: true,
    })
  })
}

// ─── 알림 구독 라우트 ─────────────────────────────────────────────────────

export async function notificationRoutes(app: FastifyInstance) {

  /**
   * POST /api/v1/notifications/subscribe
   * FCM 알림 구독 등록 (Phase 0: 응답만, 실제 FCM은 Phase 1)
   *
   * Body: { traderId: string, deviceToken: string }
   */
  app.post('/subscribe', async (req, reply) => {
    const parseResult = NotificationSubscribeSchema.safeParse(req.body)
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.errors.map((e) => e.message).join(', '),
        isSimulated: true,
      })
    }

    const { traderId, deviceToken } = parseResult.data

    // notificationService에 구독 등록 (인메모리 Map<traderId, Set<deviceToken>>)
    subscribe(traderId, deviceToken)

    const subscriberCount = getSubscriberCount(traderId)

    return reply.status(200).send({
      message:         `트레이더 '${traderId}'의 매매 알림 구독이 등록되었습니다.`,
      traderId,
      status:          'active',
      subscriberCount,
      isSimulated:     true,
      subscribedAt:    new Date().toISOString(),
    })
  })

  /**
   * DELETE /api/v1/notifications/subscribe/:traderId
   * FCM 알림 구독 해제
   *
   * Body: { deviceToken: string }
   */
  app.delete('/subscribe/:traderId', async (req, reply) => {
    const { traderId } = req.params as { traderId: string }

    const parseResult = TraderIdSchema.safeParse(traderId)
    if (!parseResult.success) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `트레이더 '${traderId}'를 찾을 수 없습니다.`,
        isSimulated: true,
      })
    }

    // deviceToken이 body에 있으면 해당 토큰만 해제, 없으면 요청자 IP 기반 경고
    const bodyParse = z.object({ deviceToken: z.string().min(10).max(512).optional() }).safeParse(req.body)
    const deviceToken = bodyParse.success ? bodyParse.data.deviceToken : undefined

    if (deviceToken) {
      unsubscribe(parseResult.data, deviceToken)
    } else {
      // deviceToken 없이 호출 — 경고만 로그 (실제 해제 불가)
      logger.warn({ traderId: parseResult.data }, '알림 구독 해제 요청에 deviceToken 없음 — 해제 생략')
    }

    return reply.status(200).send({
      message:        `트레이더 '${parseResult.data}'의 매매 알림 구독이 해제되었습니다.`,
      traderId:       parseResult.data,
      isSimulated:    true,
      unsubscribedAt: new Date().toISOString(),
    })
  })

  /**
   * GET /api/v1/notifications/pending
   * FE 폴링용 — 발송 대기/실패 알림 목록
   *
   * Query: ?deviceToken=<token>  (선택: 내 토큰 알림만 필터링)
   *        &limit=20             (기본 20, 최대 100)
   */
  app.get('/pending', async (req, reply) => {
    const queryParse = NotificationPendingQuerySchema.safeParse(req.query)
    const deviceToken = queryParse.success ? queryParse.data.deviceToken : undefined

    const limitParse = z.coerce.number().int().min(1).max(100).default(20).safeParse(
      (req.query as Record<string, unknown>).limit,
    )
    const limit = limitParse.success ? limitParse.data : 20

    const notifications = getPendingNotifications(deviceToken).slice(-limit).reverse()

    return reply.send({
      data:    notifications,
      count:   notifications.length,
      isSimulated: true,
      fetchedAt:   new Date().toISOString(),
    })
  })

  /**
   * DELETE /api/v1/notifications/pending/:notificationId
   * 특정 알림을 consumed 처리 (pending 큐에서 제거)
   */
  app.delete('/pending/:notificationId', async (req, reply) => {
    const parsedParams = NotificationConsumeSchema.safeParse(req.params)
    if (!parsedParams.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: '올바르지 않은 notificationId입니다.',
        isSimulated: true,
      })
    }

    const consumed = consumeNotification(parsedParams.data.notificationId)

    if (!consumed) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `알림 '${parsedParams.data.notificationId}'을 찾을 수 없습니다.`,
        isSimulated: true,
      })
    }

    return reply.status(200).send({
      message:     '알림이 처리되었습니다.',
      consumed:    true,
      isSimulated: true,
    })
  })
}

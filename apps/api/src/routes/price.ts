import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getPriceFromCache, setPriceCache } from '../lib/priceCache'
import { logger } from '../lib/logger'

const CandleQuerySchema = z.object({
  symbol: z.string().min(1).max(20),
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

const LatestPriceQuerySchema = z.object({
  symbols: z.string().transform((v) => v.split(',')).pipe(
    z.array(z.string().min(1).max(20)).min(1).max(50)
  ),
})

// ─── 캔들 mock 생성 ───────────────────────────────────────────────────────

interface CandleData {
  ts: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

const BASE_PRICES: Record<string, number> = {
  '005930': 78_400,
  '000660': 198_000,
  '373220': 420_000,
  '207940': 850_000,
  '005380': 195_000,
  '035420': 180_000,
  'KRW-BTC': 94_500_000,
  'KRW-ETH': 4_820_000,
  'KRW-XRP': 850,
  'KRW-SOL': 185_000,
}

const INTERVAL_MS: Record<string, number> = {
  '1m':  60_000,
  '5m':  300_000,
  '15m': 900_000,
  '1h':  3_600_000,
  '4h':  14_400_000,
  '1d':  86_400_000,
}

function generateMockCandles(symbol: string, interval: string, limit: number): CandleData[] {
  const basePrice = BASE_PRICES[symbol] ?? 50_000
  const step: number = INTERVAL_MS[interval] ?? 86_400_000
  const now = Date.now()

  let price = basePrice
  return Array.from({ length: limit }, (_, i) => {
    const ts = new Date(now - (limit - i) * step).toISOString()
    const volatility = basePrice * 0.005
    const change = (Math.random() - 0.5) * volatility * 2
    const open = price
    price = Math.max(price + change, basePrice * 0.5)
    const high = Math.max(open, price) + Math.random() * volatility
    const low = Math.min(open, price) - Math.random() * volatility
    const volume = Math.floor(Math.random() * 1_000_000 + 100_000)
    return {
      ts,
      open:   Math.round(open),
      high:   Math.round(high),
      low:    Math.round(low),
      close:  Math.round(price),
      volume,
    }
  })
}

/**
 * 가격 조회 API
 *
 * GET /api/v1/prices/latest    — 복수 종목 현재가 (최대 50개)
 * GET /api/v1/prices/candles   — OHLCV 캔들 데이터
 * GET /api/v1/prices/:symbol   — 단일 종목 현재가 + 기본 정보
 */
export async function priceRoutes(app: FastifyInstance) {
  /**
   * 복수 종목 현재가 조회
   * 캐시 TTL: 3초 (장중) / 60초 (장 마감 후)
   * Redis 미스 시 TimescaleDB last() 쿼리로 폴백
   */
  app.get('/latest', async (req, reply) => {
    const query = LatestPriceQuerySchema.parse(req.query)
    const { symbols } = query

    // N+1 방지: 한 번에 모든 심볼 캐시 조회 (Redis mget)
    const cached = await getPriceFromCache(app.redis, symbols)

    const missingSymbols = symbols.filter((s) => cached[s] === null)

    let dbPrices: Record<string, unknown> = {}
    if (missingSymbols.length > 0) {
      // 파라미터 바인딩 필수 — 문자열 삽입 절대 금지
      // ANY($1::text[]) 패턴으로 배열 한 번에 조회
      const rows = await app.db.query<{
        symbol: string
        price: string
        ts: string
        asset_type: string
      }>(
        `SELECT DISTINCT ON (symbol)
           symbol, price, ts, asset_type
         FROM price_ticks
         WHERE symbol = ANY($1::text[])
           AND is_valid = true
         ORDER BY symbol, ts DESC`,
        [missingSymbols],
      )

      for (const row of rows.rows) {
        dbPrices[row.symbol] = {
          symbol: row.symbol,
          price: Number(row.price),
          ts: row.ts,
          assetType: row.asset_type,
          stale: false,
        }
      }

      // 캐시 갱신 (TTL 3초)
      await setPriceCache(app.redis, dbPrices)
    }

    const result = symbols.map((symbol) => {
      const data = cached[symbol] ?? dbPrices[symbol]
      if (!data) {
        return { symbol, price: null, stale: true, message: '가격 정보 없음' }
      }
      return data
    })

    return reply.send({ data: result, count: result.length })
  })

  /**
   * OHLCV 캔들 조회
   * interval에 따라 적절한 연속 집계 뷰 쿼리
   */
  app.get('/candles', async (req, reply) => {
    const query = CandleQuerySchema.parse(req.query)
    const { symbol, interval, limit, from, to } = query

    // interval → 뷰 매핑
    const viewMap: Record<string, string> = {
      '1m':  'candles_1m',
      '5m':  'candles_1m',   // 1m에서 집계
      '15m': 'candles_1m',
      '1h':  'candles_1h',
      '4h':  'candles_1h',
      '1d':  'candles_1d',
    }

    const bucketMap: Record<string, string> = {
      '1m': '1 minute', '5m': '5 minutes', '15m': '15 minutes',
      '1h': '1 hour',   '4h': '4 hours',   '1d':  '1 day',
    }

    const view = viewMap[interval]
    const bucket = bucketMap[interval]

    // 파라미터 바인딩으로 SQL Injection 방지
    const params: unknown[] = [symbol, limit]
    let whereClauses = 'WHERE symbol = $1'

    if (from) {
      params.push(from)
      whereClauses += ` AND bucket >= $${params.length}`
    }
    if (to) {
      params.push(to)
      whereClauses += ` AND bucket <= $${params.length}`
    }

    const sql = `
      SELECT
        time_bucket($${params.length + 1}::interval, bucket) AS ts,
        first(open, bucket)  AS open,
        max(high)            AS high,
        min(low)             AS low,
        last(close, bucket)  AS close,
        sum(volume)          AS volume
      FROM ${view}
      ${whereClauses}
      GROUP BY time_bucket($${params.length + 1}::interval, bucket)
      ORDER BY ts DESC
      LIMIT $2
    `
    params.push(bucket)

    try {
      const rows = await app.db.query(sql, params)

      return reply.send({
        symbol,
        interval,
        data: rows.rows.map((r) => ({
          ts:     r.ts,
          open:   Number(r.open),
          high:   Number(r.high),
          low:    Number(r.low),
          close:  Number(r.close),
          volume: Number(r.volume),
        })),
        count: rows.rows.length,
      })
    } catch (err) {
      logger.warn({ err, symbol, interval }, 'candles DB 조회 실패 — mock 데이터 반환')
      const mockData = generateMockCandles(symbol, interval, limit)
      reply.header('X-Data-Source', 'mock')
      return reply.send({
        symbol,
        interval,
        data: mockData,
        count: mockData.length,
      })
    }
  })

  /**
   * 단일 종목 현재가 + 전일 대비 변동
   */
  app.get('/:symbol', async (req, reply) => {
    const { symbol } = req.params as { symbol: string }

    if (!/^[A-Z0-9_]{1,20}$/.test(symbol)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: '올바르지 않은 종목 코드입니다.',
      })
    }

    const [cached] = await Promise.all([
      getPriceFromCache(app.redis, [symbol]),
    ])

    if (cached[symbol]) {
      return reply.send({ data: cached[symbol] })
    }

    // 캐시 미스: DB에서 현재가 + 전일 종가 동시 조회
    const { rows } = await app.db.query(
      `SELECT
         t.symbol,
         t.price       AS current_price,
         t.ts          AS current_ts,
         t.asset_type,
         d.close       AS prev_close
       FROM (
         SELECT DISTINCT ON (symbol) symbol, price, ts, asset_type
         FROM price_ticks
         WHERE symbol = $1 AND is_valid = true
         ORDER BY symbol, ts DESC
       ) t
       LEFT JOIN candles_1d d
         ON d.symbol = $1
        AND d.bucket = date_trunc('day', NOW()) - INTERVAL '1 day'`,
      [symbol],
    )

    if (rows.length === 0) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `종목 ${symbol}의 가격 정보를 찾을 수 없습니다.`,
      })
    }

    const row = rows[0]
    const currentPrice = Number(row.current_price)
    const prevClose = row.prev_close ? Number(row.prev_close) : null

    const changeRate =
      prevClose && prevClose > 0
        ? ((currentPrice - prevClose) / prevClose) * 100
        : null

    const data = {
      symbol: row.symbol,
      assetType: row.asset_type,
      price: currentPrice,
      prevClose,
      change: prevClose ? currentPrice - prevClose : null,
      changeRate: changeRate ? Math.round(changeRate * 100) / 100 : null,
      ts: row.current_ts,
      stale: false,
    }

    await setPriceCache(app.redis, { [symbol]: data })

    return reply.send({ data })
  })
}

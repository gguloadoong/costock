import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getPriceFromCache, setPriceCache, getCryptoPricesFromCache } from '../lib/priceCache'
import { logger } from '../lib/logger'
import { getPrice, getAllPrices } from '../lib/priceService'

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

const BatchPriceQuerySchema = z.object({
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

// ─── 가격 유효성 검사 ───────────────────────────────────────────────────────

/**
 * 가격 이상값 필터링
 * - 0원 또는 음수: 무효
 * - 비유한 수 (Infinity, NaN): 무효
 * - 이전 가격 대비 ±30% 초과 급변: 무효 (stale 표시)
 */
function isValidPrice(price: number, prevPrice?: number): boolean {
  if (price <= 0) return false;
  if (!isFinite(price)) return false;
  if (prevPrice && prevPrice > 0) {
    const changeRate = Math.abs((price - prevPrice) / prevPrice);
    if (changeRate > 0.3) return false; // 30% 급변
  }
  return true;
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
   * PriceService 실시간 가격 조회
   * GET /api/v1/prices?symbols=005930.KS,NVDA,KRW-BTC  (콤마 구분, 생략 시 전체)
   */
  app.get('/', async (req, reply) => {
    const rawSymbols = (req.query as Record<string, string>)['symbols']
    const requestedSymbols = rawSymbols
      ? rawSymbols.split(',').map((s) => s.trim()).filter(Boolean)
      : []

    const data =
      requestedSymbols.length > 0
        ? requestedSymbols.map((sym) => getPrice(sym)).filter((d): d is NonNullable<typeof d> => d !== undefined)
        : getAllPrices()

    return reply.send({ data, updatedAt: new Date().toISOString() })
  })

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
        const price = Number(row.price)
        const stale = !isValidPrice(price)
        dbPrices[row.symbol] = {
          symbol: row.symbol,
          price,
          ts: row.ts,
          assetType: row.asset_type,
          stale,
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
   * 복수 심볼 현재가 배치 조회
   * GET /api/v1/prices/batch?symbols=005930,KRW-BTC,KRW-ETH
   *
   * - 주식: price:v1:{symbol} (getPriceFromCache)
   * - 코인 (KRW- 접두사): price:crypto:{symbol} (getCryptoPricesFromCache)
   * - 캐시 미스 시 mock 가격 반환 (Phase 0)
   * - 응답: { data: { '005930': { price, changeRate, ... }, 'KRW-BTC': {...} } }
   */
  app.get('/batch', async (req, reply) => {
    const query = BatchPriceQuerySchema.parse(req.query)
    const { symbols } = query

    const cryptoSymbols = symbols.filter((s) => s.startsWith('KRW-'))
    const stockSymbols  = symbols.filter((s) => !s.startsWith('KRW-'))

    // 병렬 캐시 조회 (N+1 방지)
    const [stockCached, cryptoCached] = await Promise.all([
      stockSymbols.length > 0 ? getPriceFromCache(app.redis, stockSymbols) : Promise.resolve({} as Record<string, unknown>),
      cryptoSymbols.length > 0 ? getCryptoPricesFromCache(app.redis, cryptoSymbols) : Promise.resolve({} as Record<string, unknown>),
    ])

    const data: Record<string, {
      symbol:     string
      price:      number
      change:     number | null
      changeRate: number | null
      stale:      boolean
      source:     'cache' | 'mock'
    }> = {}

    for (const symbol of symbols) {
      const cached = symbol.startsWith('KRW-')
        ? (cryptoCached as Record<string, unknown>)[symbol]
        : stockCached[symbol]

      if (cached !== null && cached !== undefined) {
        const c = cached as Record<string, unknown>
        const cachedPrice = typeof c['price'] === 'number' ? c['price'] : Number(c['price'] ?? 0)
        const cachedStale = typeof c['stale'] === 'boolean' ? c['stale'] : false
        data[symbol] = {
          symbol,
          price:      cachedPrice,
          change:     typeof c['change']     === 'number' ? c['change']     : null,
          changeRate: typeof c['changeRate'] === 'number' ? c['changeRate'] : null,
          stale:      cachedStale || !isValidPrice(cachedPrice),
          source:     'cache',
        }
      } else {
        // 캐시 미스 — mock 가격 반환 (Phase 0)
        const basePrice = BASE_PRICES[symbol] ?? 50_000
        const mockChange     = Math.round((Math.random() - 0.5) * basePrice * 0.02)
        const mockChangeRate = Math.round((mockChange / basePrice) * 10_000) / 100

        data[symbol] = {
          symbol,
          price:      basePrice,
          change:     mockChange,
          changeRate: mockChangeRate,
          stale:      !isValidPrice(basePrice),
          source:     'mock',
        }

        logger.debug({ symbol }, '배치 조회 캐시 미스 — mock 반환')
      }
    }

    reply.header('X-Data-Source', Object.values(data).every((d) => d.source === 'cache') ? 'cache' : 'mixed')
    return reply.send({ data, count: symbols.length })
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

    // 1순위: in-memory priceService (실시간 폴링 결과)
    const livePrice = getPrice(symbol) ?? getPrice(`${symbol}.KS`)
    if (livePrice) {
      const data = {
        symbol:     livePrice.symbol,
        assetType:  livePrice.assetType,
        price:      livePrice.price,
        prevClose:  null,
        change:     null,
        changeRate: livePrice.changeRate,
        ts:         livePrice.updatedAt,
        stale:      false,
      }
      return reply.send({ data })
    }

    // 2순위: Redis 캐시
    try {
      const [cached] = await Promise.all([
        getPriceFromCache(app.redis, [symbol]),
      ])
      if (cached[symbol]) {
        return reply.send({ data: cached[symbol] })
      }
    } catch {
      // Redis 미연결 시 무시
    }

    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: `종목 ${symbol}의 가격 정보를 찾을 수 없습니다.`,
    })
  })
}

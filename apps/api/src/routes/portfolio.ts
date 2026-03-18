import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getPriceFromCache, getCryptoPricesFromCache } from '../lib/priceCache'

/**
 * 포트폴리오 API (Phase 0)
 *
 * Phase 0에서는 포트폴리오 데이터를 클라이언트 localStorage에서 관리합니다.
 * 이 엔드포인트는 여러 종목 가격을 한 번에 조회하는 배치 조회 역할을 합니다.
 * 인증 불필요 — 가격 정보는 공개 데이터입니다.
 *
 * Phase 1에서 JWT 인증 + IDOR 방지 로직과 함께 서버사이드 포트폴리오 저장 구현 예정.
 */

const PortfolioSummaryQuerySchema = z.object({
  symbols: z.string().transform((v) => v.split(',')).pipe(
    z.array(z.string().min(1).max(20)).min(1).max(50)
  ),
})

export async function portfolioRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/portfolios?symbols=005930,KRW-BTC,KRW-ETH
   *
   * 클라이언트가 보유 종목 심볼 목록을 전달하면 현재 가격을 일괄 반환합니다.
   * 인증 없이 동작하며 캐시 미스 시 mock 데이터를 반환합니다 (Phase 0).
   *
   * 응답:
   * {
   *   data: {
   *     '005930':  { symbol, price, changeRate, stale, source },
   *     'KRW-BTC': { symbol, price, changeRate, stale, source },
   *   },
   *   count: 2
   * }
   */
  app.get('/', async (req, reply) => {
    const parsed = PortfolioSummaryQuerySchema.safeParse(req.query)

    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'symbols 파라미터가 필요합니다. 예: ?symbols=005930,KRW-BTC',
      })
    }

    const { symbols } = parsed.data

    const cryptoSymbols = symbols.filter((s) => s.startsWith('KRW-'))
    const stockSymbols  = symbols.filter((s) => !s.startsWith('KRW-'))

    // 병렬 캐시 조회 (N+1 방지)
    const [stockCached, cryptoCached] = await Promise.all([
      stockSymbols.length > 0
        ? getPriceFromCache(app.redis, stockSymbols)
        : Promise.resolve({} as Record<string, unknown>),
      cryptoSymbols.length > 0
        ? getCryptoPricesFromCache(app.redis, cryptoSymbols)
        : Promise.resolve({} as Record<string, unknown>),
    ])

    // Phase 0 mock 기준가 (캐시 미스 시 사용)
    const BASE_PRICES: Record<string, number> = {
      '005930':   78_400,
      '000660':  198_000,
      '373220':  420_000,
      '207940':  850_000,
      '005380':  195_000,
      '035420':  180_000,
      'KRW-BTC': 94_500_000,
      'KRW-ETH':  4_820_000,
      'KRW-XRP':        850,
      'KRW-SOL':    185_000,
    }

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
        data[symbol] = {
          symbol,
          price:      typeof c['price']      === 'number' ? c['price']      : Number(c['price'] ?? 0),
          change:     typeof c['change']     === 'number' ? c['change']     : null,
          changeRate: typeof c['changeRate'] === 'number' ? c['changeRate'] : null,
          stale:      typeof c['stale']      === 'boolean' ? c['stale']    : false,
          source:     'cache',
        }
      } else {
        // 캐시 미스 — mock 가격 반환 (Phase 0)
        const basePrice      = BASE_PRICES[symbol] ?? 50_000
        const mockChange     = Math.round((Math.random() - 0.5) * basePrice * 0.02)
        const mockChangeRate = Math.round((mockChange / basePrice) * 10_000) / 100

        data[symbol] = {
          symbol,
          price:      basePrice,
          change:     mockChange,
          changeRate: mockChangeRate,
          stale:      false,
          source:     'mock',
        }
      }
    }

    reply.header('X-Data-Source', Object.values(data).every((d) => d.source === 'cache') ? 'cache' : 'mixed')
    return reply.send({ data, count: symbols.length })
  })
}

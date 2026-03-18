import type { FastifyInstance } from 'fastify'
import { logger } from '../lib/logger'

// ─── 타입 정의 ────────────────────────────────────────────────────────────

interface IndexValue {
  value: number
  change: number
  changeRate: number
}

interface MarketIndicesResponse {
  data: {
    kospi: IndexValue
    kosdaq: IndexValue
    btcDominance: IndexValue
  }
  updatedAt: string
  source: 'live' | 'mock'
}

// ─── Mock 데이터 ──────────────────────────────────────────────────────────

const MOCK_KOSPI: IndexValue = { value: 2612.35, change: 18.42, changeRate: 0.71 }
const MOCK_KOSDAQ: IndexValue = { value: 871.54, change: -3.21, changeRate: -0.37 }
const MOCK_BTC_DOMINANCE: IndexValue = { value: 52.3, change: 0.8, changeRate: 1.55 }

const REDIS_KEY_BTC_DOMINANCE = 'market:btc_dominance'
const BTC_DOMINANCE_TTL = 300 // 초

// ─── BTC 도미넌스 조회 ────────────────────────────────────────────────────

interface CoinGeckoGlobalResponse {
  data: {
    market_cap_percentage: Record<string, number>
  }
}

async function fetchBtcDominance(redis: FastifyInstance['redis']): Promise<IndexValue> {
  // 캐시 확인
  const cached = await redis.get(REDIS_KEY_BTC_DOMINANCE)
  if (cached) {
    try {
      return JSON.parse(cached) as IndexValue
    } catch {
      // 파싱 실패 시 새로 조회
    }
  }

  // CoinGecko API 호출 (타임아웃 5초)
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5_000)

    const res = await fetch('https://api.coingecko.com/api/v3/global', {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      throw new Error(`CoinGecko API 오류: ${res.status}`)
    }

    const json = (await res.json()) as CoinGeckoGlobalResponse
    const btcPct = json.data.market_cap_percentage.btc ?? MOCK_BTC_DOMINANCE.value

    const result: IndexValue = {
      value: Math.round(btcPct * 100) / 100,
      change: MOCK_BTC_DOMINANCE.change,
      changeRate: MOCK_BTC_DOMINANCE.changeRate,
    }

    // Redis 캐싱 (TTL 300초)
    await redis.setex(REDIS_KEY_BTC_DOMINANCE, BTC_DOMINANCE_TTL, JSON.stringify(result))

    return result
  } catch (err) {
    logger.warn({ err }, 'BTC 도미넌스 API 호출 실패 — 캐시 또는 mock 반환')

    // 실패 시 캐시 재확인 (위에서 이미 없음이 확인됐으므로 mock 반환)
    return MOCK_BTC_DOMINANCE
  }
}

// ─── 라우트 등록 ─────────────────────────────────────────────────────────

/**
 * 시장 지수 API
 *
 * GET /api/v1/market/indices
 *
 * 응답: { data: { kospi, kosdaq, btcDominance }, updatedAt, source }
 *
 * Phase 0: 코스피/코스닥은 KIS API 미승인으로 mock 반환
 * Phase 1: KIS API 연동 후 live 데이터 제공 예정
 */
export async function marketRoutes(app: FastifyInstance) {
  app.get('/indices', async (_req, reply) => {
    const btcDominance = await fetchBtcDominance(app.redis)

    const response: MarketIndicesResponse = {
      data: {
        kospi: MOCK_KOSPI,
        kosdaq: MOCK_KOSDAQ,
        btcDominance,
      },
      updatedAt: new Date().toISOString(),
      source: 'mock',
    }

    reply.header('X-Data-Source', 'mock')

    return reply.send(response)
  })
}

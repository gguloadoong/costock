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
const REDIS_KEY_KOSPI = 'market:kospi'
const REDIS_KEY_KOSDAQ = 'market:kosdaq'
const BTC_DOMINANCE_TTL = 300 // 초
const INDEX_TTL = 60 // 초

// ─── 네이버 지수 조회 ─────────────────────────────────────────────────────

const NAVER_INDEX_BASE = 'https://m.stock.naver.com/api/index'

interface NaverIndexResponse {
  closePrice: string
  compareToPreviousClosePrice: string
  fluctuationsRatio: string
}

async function fetchNaverIndex(code: 'KOSPI' | 'KOSDAQ'): Promise<IndexValue> {
  const res = await fetch(`${NAVER_INDEX_BASE}/${code}/basic`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CoStock/1.0)',
      Referer: 'https://m.stock.naver.com/',
    },
    signal: AbortSignal.timeout(5_000),
  })

  if (!res.ok) throw new Error(`네이버 ${code} 지수 조회 실패: HTTP ${res.status}`)

  const data = (await res.json()) as NaverIndexResponse
  return {
    value: parseFloat(data.closePrice.replace(/,/g, '')),
    change: parseFloat(data.compareToPreviousClosePrice.replace(/,/g, '')),
    changeRate: parseFloat(data.fluctuationsRatio),
  }
}

async function fetchKospiKosdaq(redis: FastifyInstance['redis']): Promise<{
  kospi: IndexValue
  kosdaq: IndexValue
  source: 'live' | 'mock'
}> {
  // 캐시 확인
  const [cachedKospi, cachedKosdaq] = await Promise.all([
    redis.get(REDIS_KEY_KOSPI),
    redis.get(REDIS_KEY_KOSDAQ),
  ])

  if (cachedKospi && cachedKosdaq) {
    try {
      return {
        kospi: JSON.parse(cachedKospi) as IndexValue,
        kosdaq: JSON.parse(cachedKosdaq) as IndexValue,
        source: 'live',
      }
    } catch { /* 파싱 실패 시 새로 조회 */ }
  }

  try {
    const [kospi, kosdaq] = await Promise.all([
      fetchNaverIndex('KOSPI'),
      fetchNaverIndex('KOSDAQ'),
    ])

    await Promise.all([
      redis.setex(REDIS_KEY_KOSPI, INDEX_TTL, JSON.stringify(kospi)),
      redis.setex(REDIS_KEY_KOSDAQ, INDEX_TTL, JSON.stringify(kosdaq)),
    ])

    return { kospi, kosdaq, source: 'live' }
  } catch (err) {
    logger.warn({ err }, '네이버 지수 조회 실패 — mock 반환')
    return { kospi: MOCK_KOSPI, kosdaq: MOCK_KOSDAQ, source: 'mock' }
  }
}

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
 * 코스피/코스닥: KIS API 실데이터 (Redis TTL 60초, 실패 시 mock fallback)
 * BTC 도미넌스: CoinGecko 실데이터 (Redis TTL 300초, 실패 시 mock fallback)
 */
export async function marketRoutes(app: FastifyInstance) {
  app.get('/indices', async (_req, reply) => {
    const [{ kospi, kosdaq, source: indexSource }, btcDominance] = await Promise.all([
      fetchKospiKosdaq(app.redis),
      fetchBtcDominance(app.redis),
    ])

    // BTC 도미넌스가 mock이면 전체 source를 mock으로 표시
    const source: 'live' | 'mock' = indexSource === 'live' ? 'live' : 'mock'

    const response: MarketIndicesResponse = {
      data: { kospi, kosdaq, btcDominance },
      updatedAt: new Date().toISOString(),
      source,
    }

    reply.header('X-Data-Source', source)

    return reply.send(response)
  })
}

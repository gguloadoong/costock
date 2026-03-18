import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { logger } from '../lib/logger'

// ─── 쿼리 스키마 ─────────────────────────────────────────────────────────

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(100),
})

// ─── 타입 정의 ────────────────────────────────────────────────────────────

interface Instrument {
  symbol: string
  name: string
  assetType: 'stock' | 'crypto'
  exchange: string
}

interface SearchResult extends Instrument {
  market: string
  currentPrice?: number
  changeRate?: number
  exchange: string
}

// ─── KRX 주요 종목 인메모리 목록 (정적 — Phase 0) ────────────────────────
//
// Phase 1에서 KRX 공개 API 또는 DB 조회로 교체 예정
// 현재는 코스피 시가총액 상위 50개 + 주요 코스닥 종목

const KRX_STOCKS: Instrument[] = [
  { symbol: '005930', name: '삼성전자', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '000660', name: 'SK하이닉스', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '373220', name: 'LG에너지솔루션', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '207940', name: '삼성바이오로직스', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '005380', name: '현대차', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '035420', name: 'NAVER', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '000270', name: '기아', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '051910', name: 'LG화학', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '006400', name: '삼성SDI', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '028260', name: '삼성물산', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '105560', name: 'KB금융', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '055550', name: '신한지주', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '035720', name: '카카오', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '012330', name: '현대모비스', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '066570', name: 'LG전자', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '003550', name: 'LG', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '096770', name: 'SK이노베이션', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '034730', name: 'SK', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '017670', name: 'SK텔레콤', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '086790', name: '하나금융지주', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '316140', name: '우리금융지주', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '003490', name: '대한항공', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '032830', name: '삼성생명', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '011200', name: 'HMM', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '010950', name: 'S-Oil', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '009150', name: '삼성전기', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '011780', name: '금호석유', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '033780', name: 'KT&G', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '004020', name: '현대제철', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '018260', name: '삼성에스디에스', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '030200', name: 'KT', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '047050', name: '포스코인터내셔널', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '034020', name: '두산에너빌리티', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '068270', name: '셀트리온', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '091990', name: '셀트리온헬스케어', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '329180', name: 'HD현대중공업', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '267250', name: 'HD현대', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '011070', name: 'LG이노텍', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '009830', name: '한화솔루션', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '000810', name: '삼성화재', assetType: 'stock', exchange: 'KOSPI' },
  { symbol: '086280', name: '현대글로비스', assetType: 'stock', exchange: 'KOSPI' },
  // 코스닥 주요 종목
  { symbol: '247540', name: '에코프로비엠', assetType: 'stock', exchange: 'KOSDAQ' },
  { symbol: '086520', name: '에코프로', assetType: 'stock', exchange: 'KOSDAQ' },
  { symbol: '196170', name: '알테오젠', assetType: 'stock', exchange: 'KOSDAQ' },
  { symbol: '263750', name: '펄어비스', assetType: 'stock', exchange: 'KOSDAQ' },
  { symbol: '041510', name: 'SM엔터테인먼트', assetType: 'stock', exchange: 'KOSDAQ' },
  { symbol: '035900', name: 'JYP Ent.', assetType: 'stock', exchange: 'KOSDAQ' },
  { symbol: '122870', name: '와이지엔터테인먼트', assetType: 'stock', exchange: 'KOSDAQ' },
  { symbol: '293490', name: '카카오게임즈', assetType: 'stock', exchange: 'KOSDAQ' },
  { symbol: '259960', name: '크래프톤', assetType: 'stock', exchange: 'KOSDAQ' },
  { symbol: '112040', name: '위메이드', assetType: 'stock', exchange: 'KOSDAQ' },
]

// ─── 주요 코인 목록 ──────────────────────────────────────────────────────

const CRYPTO_LIST: Instrument[] = [
  { symbol: 'KRW-BTC', name: '비트코인', assetType: 'crypto', exchange: 'UPBIT' },
  { symbol: 'KRW-ETH', name: '이더리움', assetType: 'crypto', exchange: 'UPBIT' },
  { symbol: 'KRW-XRP', name: '리플', assetType: 'crypto', exchange: 'UPBIT' },
  { symbol: 'KRW-SOL', name: '솔라나', assetType: 'crypto', exchange: 'UPBIT' },
  { symbol: 'KRW-DOGE', name: '도지코인', assetType: 'crypto', exchange: 'UPBIT' },
  { symbol: 'KRW-ADA', name: '에이다', assetType: 'crypto', exchange: 'UPBIT' },
  { symbol: 'KRW-AVAX', name: '아발란체', assetType: 'crypto', exchange: 'UPBIT' },
  { symbol: 'KRW-DOT', name: '폴카닷', assetType: 'crypto', exchange: 'UPBIT' },
  { symbol: 'KRW-MATIC', name: '폴리곤', assetType: 'crypto', exchange: 'UPBIT' },
  { symbol: 'KRW-LINK', name: '체인링크', assetType: 'crypto', exchange: 'UPBIT' },
  { symbol: 'KRW-SHIB', name: '시바이누', assetType: 'crypto', exchange: 'UPBIT' },
  { symbol: 'KRW-TRX', name: '트론', assetType: 'crypto', exchange: 'UPBIT' },
  { symbol: 'KRW-ATOM', name: '코스모스', assetType: 'crypto', exchange: 'UPBIT' },
  { symbol: 'KRW-ETC', name: '이더리움클래식', assetType: 'crypto', exchange: 'UPBIT' },
  { symbol: 'KRW-BCH', name: '비트코인캐시', assetType: 'crypto', exchange: 'UPBIT' },
]

// ─── 전체 목록 (주식 + 코인) ─────────────────────────────────────────────

const ALL_INSTRUMENTS: Instrument[] = [...KRX_STOCKS, ...CRYPTO_LIST]

// ─── 검색 로직 ───────────────────────────────────────────────────────────

/**
 * 종목명 또는 심볼에서 쿼리 매칭
 * - 종목명: 부분 일치 (contains)
 * - 심볼: 앞부분 일치 (startsWith) + 부분 일치 (contains)
 * - 대소문자 무시
 * - 최대 20개 반환
 */
function searchInstruments(q: string): Instrument[] {
  const query = q.toLowerCase().trim()
  if (!query) return []

  const exact: Instrument[] = []
  const startsWith: Instrument[] = []
  const contains: Instrument[] = []

  for (const item of ALL_INSTRUMENTS) {
    const nameLower = item.name.toLowerCase()
    const symbolLower = item.symbol.toLowerCase()

    if (nameLower === query || symbolLower === query) {
      exact.push(item)
    } else if (nameLower.startsWith(query) || symbolLower.startsWith(query)) {
      startsWith.push(item)
    } else if (nameLower.includes(query) || symbolLower.includes(query)) {
      contains.push(item)
    }
  }

  return [...exact, ...startsWith, ...contains].slice(0, 20)
}

// ─── 라우트 등록 ─────────────────────────────────────────────────────────

/**
 * 통합 검색 API
 *
 * GET /api/v1/instruments/search?q=삼성전자
 *
 * 응답: { data: [{ symbol, name, assetType, exchange, currentPrice?, changeRate? }], meta: { total, query } }
 *
 * Phase 0: 인메모리 정적 목록에서 검색 (currentPrice/changeRate 미포함)
 * Phase 1: 실시간 가격 병렬 조회 후 응답에 포함 예정
 */
export async function searchRoutes(app: FastifyInstance) {
  app.get('/search', async (req, reply) => {
    const parsed = SearchQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'q 파라미터가 필요합니다 (예: ?q=삼성)' })
    }
    const { q } = parsed.data

    const results = searchInstruments(q)

    logger.debug({ q, count: results.length }, '통합 검색 실행')

    const data: SearchResult[] = results.map((item) => ({
      symbol: item.symbol,
      name: item.name,
      assetType: item.assetType,
      market: item.exchange,
      exchange: item.exchange,
    }))

    return reply.send({ data, meta: { total: data.length, query: q } })
  })
}

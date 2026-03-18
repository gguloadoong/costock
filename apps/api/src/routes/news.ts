import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { logger } from '../lib/logger'

// ─── 쿼리 스키마 ─────────────────────────────────────────────────────────

const NewsQuerySchema = z.object({
  symbol: z.string().min(1).max(20),
  limit: z.coerce.number().int().min(1).max(20).default(5),
})

// ─── 타입 정의 ────────────────────────────────────────────────────────────

interface NewsItem {
  id: string
  title: string
  source: string
  publishedAt: string
  url: string
  summary?: string
}

// ─── 종목 이름 매핑 ───────────────────────────────────────────────────────

const SYMBOL_NAMES: Record<string, string> = {
  '005930': '삼성전자',
  '000660': 'SK하이닉스',
  '373220': 'LG에너지솔루션',
  '207940': '삼성바이오로직스',
  '005380': '현대차',
  '035420': 'NAVER',
  '000270': '기아',
  '051910': 'LG화학',
  '006400': '삼성SDI',
  '028260': '삼성물산',
  '105560': 'KB금융',
  '055550': '신한지주',
  '035720': '카카오',
  '012330': '현대모비스',
  '066570': 'LG전자',
  'KRW-BTC': '비트코인',
  'KRW-ETH': '이더리움',
  'KRW-XRP': '리플',
  'KRW-SOL': '솔라나',
  'KRW-DOGE': '도지코인',
  'KRW-ADA': '에이다',
  'KRW-AVAX': '아발란체',
  'KRW-DOT': '폴카닷',
  'KRW-MATIC': '폴리곤',
  'KRW-LINK': '체인링크',
}

// ─── 뉴스 제목 템플릿 ─────────────────────────────────────────────────────

const STOCK_TEMPLATES = [
  '{name}, 기관 매수세 유입에 강세',
  '{name} 주가 전망... 목표가 상향',
  '외국인·기관 동반 순매수 {name}',
  '{name}, 거래량 급증...이유는?',
  '{name} 52주 신고가 경신 도전',
  '{name}, 실적 기대감에 상승세 지속',
  '{name} 대규모 자사주 매입 발표',
  '증권사, {name} 투자의견 "매수" 유지',
  '{name}, 2분기 실적 시장 예상 상회',
  '{name} 주요 계약 체결...주가 반응은?',
]

const CRYPTO_TEMPLATES = [
  '{name}, 글로벌 거래소 급등세',
  '{name} 고래 지갑 이동...대규모 매집?',
  '{name} 온체인 분석: 강세 신호 포착',
  '{name}, 기관 투자자 유입 확대',
  '{name} 네트워크 업그레이드 완료...가격 상승',
  '{name} 거래량 급증, 단기 돌파 가능성',
  '{name}, 글로벌 규제 완화 수혜 기대',
  '{name} ETF 승인 기대감에 반등',
]

const SOURCES = ['네이버 금융', '연합뉴스', '한국경제', '매일경제', '이데일리']

// ─── mock 뉴스 생성 ───────────────────────────────────────────────────────

function generateMockNews(symbol: string, limit: number): NewsItem[] {
  const isCrypto = symbol.startsWith('KRW-')
  const name = SYMBOL_NAMES[symbol] ?? symbol
  const templates = isCrypto ? CRYPTO_TEMPLATES : STOCK_TEMPLATES

  const naverUrl = isCrypto
    ? `https://m.search.naver.com/search.naver?query=${encodeURIComponent(name + ' 코인 뉴스')}`
    : `https://finance.naver.com/item/news.nhn?code=${symbol}`

  const items: NewsItem[] = []

  for (let i = 0; i < limit; i++) {
    const template = templates[i % templates.length]!
    const title = template.replace('{name}', name)
    const source = SOURCES[i % SOURCES.length]!
    // 현재 시각 기준 0~8시간 랜덤 이전
    const offsetMs = Math.floor(Math.random() * 8 * 60 * 60 * 1000)
    const publishedAt = new Date(Date.now() - offsetMs).toISOString()

    items.push({
      id: `${symbol}-${i}-${Date.now()}`,
      title,
      source,
      publishedAt,
      url: naverUrl,
    })
  }

  return items
}

// ─── 라우트 등록 ─────────────────────────────────────────────────────────

/**
 * 뉴스 API
 *
 * GET /api/v1/news?symbol=005930&limit=5
 *
 * 응답: { data: NewsItem[], naverUrl: string }
 *
 * Phase 0: symbol 기반 mock 생성 + Naver Finance 링크 제공
 * Phase 1: Naver Finance RSS 또는 뉴스 API 연동 예정
 */
export async function newsRoutes(app: FastifyInstance) {
  app.get('/news', async (req, reply) => {
    const parsed = NewsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'symbol 파라미터가 필요합니다 (예: ?symbol=005930)',
      })
    }

    const { symbol, limit } = parsed.data
    const isCrypto = symbol.startsWith('KRW-')
    const name = SYMBOL_NAMES[symbol] ?? symbol

    const naverUrl = isCrypto
      ? `https://m.search.naver.com/search.naver?query=${encodeURIComponent(name + ' 코인 뉴스')}`
      : `https://finance.naver.com/item/news.nhn?code=${symbol}`

    const data = generateMockNews(symbol, limit)

    logger.debug({ symbol, limit, count: data.length }, '뉴스 조회')

    return reply.send({ data, naverUrl })
  })
}

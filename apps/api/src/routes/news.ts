import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { logger } from '../lib/logger'

// ─── 쿼리 스키마 ─────────────────────────────────────────────────────────

const NewsQuerySchema = z.object({
  symbol: z.string().min(1).max(20),
  category: z.enum(['시황', '기업', '산업', '글로벌']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

// ─── 타입 정의 ────────────────────────────────────────────────────────────

interface NewsItem {
  id: string
  title: string
  source: string
  publishedAt: string
  url: string
  symbol: string
  category: '시황' | '기업' | '산업' | '글로벌'
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

// ─── 풍부한 mock 뉴스 데이터 ─────────────────────────────────────────────────

interface MockNewsData {
  title: string
  category: '시황' | '기업' | '산업' | '글로벌'
  source: string
  symbols: string[] // 관련 종목들
}

const MOCK_NEWS_DATABASE: MockNewsData[] = [
  // 기업 뉴스
  { title: '삼성전자, 2분기 실적 시장 예상치 상회... HBM 수요 급증', category: '기업', source: '한국경제', symbols: ['005930'] },
  { title: 'SK하이닉스 D램 가격 상승세 지속... 향후 수급 개선 예상', category: '기업', source: '매일경제', symbols: ['000660'] },
  { title: 'NAVER, AI 검색 시장 점유율 확대... 광고 매출 급증', category: '기업', source: '이데일리', symbols: ['035420'] },
  { title: '카카오, 게임·금융 연계 생태계 확대 추진', category: '기업', source: '연합뉴스', symbols: ['035720'] },
  { title: '현대차 인도 법인 IPO 성공... 시가총액 30조원', category: '기업', source: '서울경제', symbols: ['005380'] },
  { title: 'LG에너지솔루션, 전고체배터리 시제품 공개', category: '기업', source: '한국경제', symbols: ['373220'] },
  { title: '삼성바이오로직스 바이오신약 임상시험 성공', category: '기업', source: '의약일보', symbols: ['207940'] },
  { title: 'KB금융, 1분기 영업이익 2조 돌파', category: '기업', source: '매일경제', symbols: ['105560'] },

  // 시황 뉴스
  { title: '코스피 2,800선 회복... 외국인 순매수 전환', category: '시황', source: '매일경제', symbols: [] },
  { title: '미 연준 금리 동결 시사... 원/달러 환율 하락', category: '시황', source: '서울경제', symbols: [] },
  { title: '코스닥, 나스닥 강세에 동반 상승', category: '시황', source: '이데일리', symbols: [] },
  { title: '기관 순매수 3천억 규모... 월중 평균 상회', category: '시황', source: '한국경제', symbols: [] },

  // 산업 뉴스
  { title: '2차전지 섹터 강세... POSCO홀딩스·에코프로 동반 상승', category: '산업', source: '연합뉴스', symbols: ['005490', '086520'] },
  { title: 'EV 부품업체 수주 호조... 공급망 다변화 진행중', category: '산업', source: '투데이에너지', symbols: ['005380'] },
  { title: '반도체 수출 4개월 연속 증가... 회복세 명확', category: '산업', source: '연합뉴스', symbols: ['005930', '000660'] },

  // 글로벌 뉴스
  { title: '비트코인 9만 달러 돌파, 기관 매수세 지속', category: '글로벌', source: '코인데스크', symbols: ['KRW-BTC'] },
  { title: '이더리움 ETF 자금 유입 사상 최대', category: '글로벌', source: '블록미디어', symbols: ['KRW-ETH'] },
  { title: 'Fed 금리 인상 일시 중단... 암호화폐 시장 호재', category: '글로벌', source: '크립토스페셜', symbols: ['KRW-BTC', 'KRW-ETH'] },
  { title: '아마존 클라우드 수익 성장... 나스닥 주도', category: '글로벌', source: '로이터', symbols: [] },
]

const SOURCES = ['네이버 금융', '연합뉴스', '한국경제', '매일경제', '이데일리', '서울경제', '블록미디어', '의약일보']

// ─── mock 뉴스 생성 ───────────────────────────────────────────────────────

function generateMockNews(symbol: string, category?: string, limit: number = 10): NewsItem[] {
  const isCrypto = symbol.startsWith('KRW-')
  const name = SYMBOL_NAMES[symbol] ?? symbol

  const naverUrl = isCrypto
    ? `https://m.search.naver.com/search.naver?query=${encodeURIComponent(name + ' 코인 뉴스')}`
    : `https://finance.naver.com/item/news.nhn?code=${symbol}`

  // 해당 심볼 또는 카테고리와 관련된 뉴스 필터링
  let filteredNews = MOCK_NEWS_DATABASE.filter((news) => {
    const matchesSymbol = news.symbols.includes(symbol) || news.symbols.length === 0
    const matchesCategory = !category || news.category === category
    return matchesSymbol && matchesCategory
  })

  // 부족하면 같은 카테고리의 다른 뉴스 추가
  if (filteredNews.length < limit && category) {
    const additionalNews = MOCK_NEWS_DATABASE.filter(
      (news) => news.category === category && !filteredNews.includes(news)
    )
    filteredNews = [...filteredNews, ...additionalNews]
  }

  // 부족하면 모든 뉴스에서 추가
  if (filteredNews.length < limit) {
    const allOtherNews = MOCK_NEWS_DATABASE.filter((news) => !filteredNews.includes(news))
    filteredNews = [...filteredNews, ...allOtherNews]
  }

  const items: NewsItem[] = []

  for (let i = 0; i < Math.min(limit, filteredNews.length); i++) {
    const newsData = filteredNews[i]!
    // 현재 시각 기준 0~8시간 랜덤 이전
    const offsetMs = Math.floor(Math.random() * 8 * 60 * 60 * 1000)
    const publishedAt = new Date(Date.now() - offsetMs).toISOString()

    items.push({
      id: `${symbol}-${i}-${Date.now()}`,
      title: newsData.title,
      source: newsData.source,
      publishedAt,
      url: naverUrl,
      symbol,
      category: newsData.category,
    })
  }

  return items
}

// ─── 라우트 등록 ─────────────────────────────────────────────────────────

/**
 * 뉴스 API
 *
 * GET /api/v1/news?symbol=005930&category=기업&limit=10
 *
 * 응답: { data: NewsItem[], meta: { total: number } }
 *
 * Phase 0: symbol 기반 mock 생성 + 카테고리 필터링
 * Phase 1: Naver Finance RSS 또는 뉴스 API 연동 예정
 */
export async function newsRoutes(app: FastifyInstance) {
  app.get('/news', async (req, reply) => {
    const parsed = NewsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'symbol 파라미터가 필수입니다 (예: ?symbol=005930&category=기업&limit=10)',
      })
    }

    const { symbol, category, limit } = parsed.data

    const data = generateMockNews(symbol, category, limit)

    logger.debug({ symbol, category, limit, count: data.length }, '뉴스 조회')

    return reply.send({ data, meta: { total: data.length } })
  })
}

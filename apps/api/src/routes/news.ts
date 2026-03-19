import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { logger } from '../lib/logger'

// ─── 쿼리 스키마 ─────────────────────────────────────────────────────────

const NewsQuerySchema = z.object({
  symbol: z.string().min(1).max(20),
  category: z.enum(['시황', '기업', '산업', '글로벌']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

const NewsAllQuerySchema = z.object({
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

// ─── In-memory 캐시 (Redis 없이 동작) ────────────────────────────────────

const RSS_CACHE = new Map<string, { items: NewsItem[]; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5분

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

// ─── 카테고리 자동 분류 ───────────────────────────────────────────────────

const GLOBAL_KEYWORDS = ['미국', '나스닥', '연준', 'fed', '달러', '글로벌', '뉴욕', '중국', '유럽', '일본', '월가', '국제', 'imf']
const INDUSTRY_KEYWORDS = ['반도체', '배터리', '전기차', 'ev', '2차전지', '바이오', 'ai', '인공지능', '자동차', '철강', '화학', '건설', '금융주', '섹터']

function detectCategory(title: string, symbol: string): '시황' | '기업' | '산업' | '글로벌' {
  const lower = title.toLowerCase()

  if (GLOBAL_KEYWORDS.some((k) => lower.includes(k))) return '글로벌'
  if (INDUSTRY_KEYWORDS.some((k) => lower.includes(k))) return '산업'

  // 종목명이 제목에 포함되면 기업 뉴스
  const symbolName = SYMBOL_NAMES[symbol]
  if (symbolName && lower.includes(symbolName.toLowerCase())) return '기업'

  return '시황'
}

// ─── RSS XML 파서 ─────────────────────────────────────────────────────────

interface RssItem {
  title: string
  link: string
  pubDate: string
  author: string
  description?: string
}

function extractCdata(xml: string, tag: string): string {
  // CDATA 형태: <tag><![CDATA[...]]></tag>
  const cdataMatch = xml.match(new RegExp(`<${tag}>[\\s]*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>[\\s]*<\\/${tag}>`))
  if (cdataMatch?.[1]) return cdataMatch[1].trim()

  // 일반 텍스트 형태: <tag>...</tag>
  const plainMatch = xml.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`))
  return plainMatch?.[1]?.trim() ?? ''
}

function parseRssXml(xml: string): RssItem[] {
  const items: RssItem[] = []

  // <item> ... </item> 블록 추출
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match: RegExpExecArray | null

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1] ?? ''

    const title = extractCdata(block, 'title')
    const link = extractCdata(block, 'link') || extractCdata(block, 'originallink')
    const pubDate = extractCdata(block, 'pubDate') || extractCdata(block, 'pubdate')
    const author = extractCdata(block, 'author') || extractCdata(block, 'source') || '네이버 금융'
    const description = extractCdata(block, 'description') || undefined

    if (title && link) {
      items.push({ title, link, pubDate, author, ...(description ? { description } : {}) })
    }
  }

  return items
}

// ─── 코인데스크 코리아 RSS 가져오기 ──────────────────────────────────────

const COINDESK_KR_RSS = 'https://www.coindeskkorea.com/feed/'
const COINDESK_CACHE_KEY = '__coindesk__'

async function fetchCoinDeskRss(symbol: string, limit: number): Promise<NewsItem[] | null> {
  // KRW-* 심볼에만 적용
  if (!symbol.startsWith('KRW-')) return null

  // 캐시 확인 (피드 전체를 하나의 키로 캐싱)
  const cached = RSS_CACHE.get(COINDESK_CACHE_KEY)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items.slice(0, limit)
  }

  const res = await fetch(COINDESK_KR_RSS, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CoStock/1.0; +https://costock.kr)',
      Accept: 'application/rss+xml, application/xml, text/xml',
    },
    signal: AbortSignal.timeout(5_000),
  })

  if (!res.ok) {
    logger.warn({ symbol, status: res.status }, '코인데스크 코리아 RSS fetch 실패')
    return null
  }

  // EUC-KR 또는 UTF-8 처리 (네이버 RSS 패턴 재사용)
  const buffer = await res.arrayBuffer()
  let text: string
  try {
    text = new TextDecoder('euc-kr').decode(buffer)
    // EUC-KR 디코딩이 의미 없을 경우(UTF-8 피드) UTF-8으로 재시도
    if (text.includes('â€') || text.includes('Ã')) {
      text = new TextDecoder('utf-8').decode(buffer)
    }
  } catch {
    text = new TextDecoder('utf-8').decode(buffer)
  }

  const rssItems = parseRssXml(text)
  if (rssItems.length === 0) return null

  const newsItems: NewsItem[] = rssItems.map((item, i) => ({
    id: `coindesk-rss-${i}-${Date.now()}`,
    title: item.title,
    source: item.author || '코인데스크 코리아',
    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    url: item.link,
    symbol,
    category: detectCategory(item.title, symbol),
    ...(item.description ? { summary: item.description } : {}),
  }))

  RSS_CACHE.set(COINDESK_CACHE_KEY, { items: newsItems, expiresAt: Date.now() + CACHE_TTL_MS })

  logger.debug({ symbol, count: newsItems.length }, '코인데스크 코리아 RSS 뉴스 로드')

  return newsItems.slice(0, limit)
}

// ─── 네이버 Finance RSS 가져오기 ──────────────────────────────────────────

const NAVER_RSS_BASE = 'https://finance.naver.com/rss/news.nhn'

async function fetchNaverStockRss(symbol: string, limit: number): Promise<NewsItem[] | null> {
  // 국내 주식만 (6자리 숫자 종목코드)
  if (!/^\d{6}$/.test(symbol)) return null

  // 캐시 확인
  const cached = RSS_CACHE.get(symbol)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items.slice(0, limit)
  }

  const url = `${NAVER_RSS_BASE}?code=${symbol}`

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CoStock/1.0; +https://costock.kr)',
      Accept: 'application/rss+xml, application/xml, text/xml',
    },
    signal: AbortSignal.timeout(5_000),
  })

  if (!res.ok) {
    logger.warn({ symbol, status: res.status }, '네이버 RSS fetch 실패')
    return null
  }

  // 네이버 금융 RSS는 EUC-KR 인코딩 → TextDecoder로 디코딩
  const buffer = await res.arrayBuffer()
  let text: string
  try {
    text = new TextDecoder('euc-kr').decode(buffer)
  } catch {
    text = new TextDecoder('utf-8').decode(buffer)
  }

  const rssItems = parseRssXml(text)
  if (rssItems.length === 0) return null

  const newsItems: NewsItem[] = rssItems.map((item, i) => ({
    id: `${symbol}-rss-${i}-${Date.now()}`,
    title: item.title,
    source: item.author || '네이버 금융',
    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    url: item.link,
    symbol,
    category: detectCategory(item.title, symbol),
    ...(item.description ? { summary: item.description } : {}),
  }))

  RSS_CACHE.set(symbol, { items: newsItems, expiresAt: Date.now() + CACHE_TTL_MS })

  logger.debug({ symbol, count: newsItems.length }, '네이버 RSS 뉴스 로드')

  return newsItems.slice(0, limit)
}

// ─── Mock 뉴스 데이터 (RSS 실패 시 폴백 + 코인) ───────────────────────────

interface MockNewsData {
  title: string
  category: '시황' | '기업' | '산업' | '글로벌'
  source: string
  symbols: string[]
}

const MOCK_NEWS_DATABASE: MockNewsData[] = [
  // 기업
  { title: '삼성전자, 2분기 실적 시장 예상치 상회... HBM 수요 급증', category: '기업', source: '한국경제', symbols: ['005930'] },
  { title: 'SK하이닉스 D램 가격 상승세 지속... 향후 수급 개선 예상', category: '기업', source: '매일경제', symbols: ['000660'] },
  { title: 'NAVER, AI 검색 시장 점유율 확대... 광고 매출 급증', category: '기업', source: '이데일리', symbols: ['035420'] },
  { title: '카카오, 게임·금융 연계 생태계 확대 추진', category: '기업', source: '연합뉴스', symbols: ['035720'] },
  { title: '현대차 인도 법인 IPO 성공... 시가총액 30조원', category: '기업', source: '서울경제', symbols: ['005380'] },
  { title: 'LG에너지솔루션, 전고체배터리 시제품 공개', category: '기업', source: '한국경제', symbols: ['373220'] },
  { title: '삼성바이오로직스 바이오신약 임상시험 성공', category: '기업', source: '의약일보', symbols: ['207940'] },
  { title: 'KB금융, 1분기 영업이익 2조 돌파', category: '기업', source: '매일경제', symbols: ['105560'] },
  // 시황
  { title: '코스피 2,800선 회복... 외국인 순매수 전환', category: '시황', source: '매일경제', symbols: [] },
  { title: '미 연준 금리 동결 시사... 원/달러 환율 하락', category: '시황', source: '서울경제', symbols: [] },
  { title: '코스닥, 나스닥 강세에 동반 상승', category: '시황', source: '이데일리', symbols: [] },
  { title: '기관 순매수 3천억 규모... 월중 평균 상회', category: '시황', source: '한국경제', symbols: [] },
  // 산업
  { title: '2차전지 섹터 강세... POSCO홀딩스·에코프로 동반 상승', category: '산업', source: '연합뉴스', symbols: [] },
  { title: '반도체 수출 4개월 연속 증가... 회복세 명확', category: '산업', source: '연합뉴스', symbols: ['005930', '000660'] },
  // 글로벌 (코인 포함)
  { title: '비트코인 9만 달러 돌파, 기관 매수세 지속', category: '글로벌', source: '코인데스크', symbols: ['KRW-BTC'] },
  { title: '이더리움 ETF 자금 유입 사상 최대', category: '글로벌', source: '블록미디어', symbols: ['KRW-ETH'] },
  { title: 'Fed 금리 인상 일시 중단... 암호화폐 시장 호재', category: '글로벌', source: '크립토스페셜', symbols: ['KRW-BTC', 'KRW-ETH'] },
  { title: '솔라나 DEX 거래량 신고점... DeFi 생태계 활성화', category: '글로벌', source: '블록미디어', symbols: ['KRW-SOL'] },
  { title: '리플 SEC 소송 최종 합의... XRP 가격 급등', category: '글로벌', source: '코인데스크', symbols: ['KRW-XRP'] },
]

function generateMockNews(symbol: string, category: string | undefined, limit: number): NewsItem[] {
  const isCrypto = symbol.startsWith('KRW-')
  const naverUrl = isCrypto
    ? `https://m.search.naver.com/search.naver?query=${encodeURIComponent((SYMBOL_NAMES[symbol] ?? symbol) + ' 코인 뉴스')}`
    : `https://finance.naver.com/item/news.nhn?code=${symbol}`

  let pool = MOCK_NEWS_DATABASE.filter((n) => {
    const matchSymbol = n.symbols.includes(symbol) || n.symbols.length === 0
    const matchCategory = !category || n.category === category
    return matchSymbol && matchCategory
  })

  if (pool.length < limit) {
    pool = [...pool, ...MOCK_NEWS_DATABASE.filter((n) => !pool.includes(n))]
  }

  return pool.slice(0, limit).map((n, i) => ({
    id: `${symbol}-mock-${i}-${Date.now()}`,
    title: n.title,
    source: n.source,
    publishedAt: new Date(Date.now() - Math.floor(Math.random() * 8 * 60 * 60 * 1000)).toISOString(),
    url: naverUrl,
    symbol,
    category: n.category,
  }))
}

// ─── 라우트 등록 ─────────────────────────────────────────────────────────

// 전체 뉴스용 대표 코인·주식 심볼
const FEATURED_COIN_SYMBOLS = ['KRW-BTC', 'KRW-ETH', 'KRW-SOL', 'KRW-XRP']
const FEATURED_STOCK_SYMBOLS = ['005930', '000660', '035420', '005380']

/**
 * 뉴스 API
 *
 * GET /api/v1/news                              — 전체 최신 뉴스 (코인+주식 혼합)
 * GET /api/v1/news?symbol=005930&limit=10       — 특정 종목 뉴스
 * GET /api/v1/news?symbol=005930&category=기업  — 카테고리 필터
 *
 * 데이터 소스 우선순위:
 *   1. 코인데스크 코리아 RSS (KRW-* 심볼, 5분 캐시)
 *   2. 네이버 Finance RSS (국내 주식 6자리 코드, 5분 캐시)
 *   3. Mock 데이터 폴백 (RSS 실패 시)
 */
export async function newsRoutes(app: FastifyInstance) {
  // ── GET /news (symbol 없이 전체 최신 뉴스) ──────────────────────────────
  app.get('/news', async (req, reply) => {
    // symbol 파라미터가 있으면 아래 심볼별 핸들러로 위임 (Fastify는 동일 경로 중복 등록 불가이므로
    // 하나의 핸들러에서 분기 처리)
    const query = req.query as Record<string, string>
    if (query.symbol) {
      // ── 심볼 지정 뉴스 ──────────────────────────────────────────────────
      const parsed = NewsQuerySchema.safeParse(query)
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'symbol 파라미터가 올바르지 않습니다 (예: ?symbol=005930&limit=10)',
        })
      }

      const { symbol, category, limit } = parsed.data

      let data: NewsItem[] | null = null
      if (symbol.startsWith('KRW-')) {
        try {
          data = await fetchCoinDeskRss(symbol, limit)
        } catch (err) {
          logger.warn({ symbol, err }, '코인데스크 RSS 오류 — Mock 폴백')
        }
      }

      if (!data || data.length === 0) {
        try {
          data = await fetchNaverStockRss(symbol, limit)
        } catch (err) {
          logger.warn({ symbol, err }, '네이버 RSS 오류 — Mock 폴백')
        }
      }

      if (!data || data.length === 0) {
        data = generateMockNews(symbol, category, limit)
      }

      if (category) {
        data = data.filter((n) => n.category === category)
        if (data.length === 0) {
          data = generateMockNews(symbol, category, limit)
        }
      }

      return reply.send({ data, meta: { total: data.length } })
    }

    // ── 전체 뉴스 (symbol 없음) ─────────────────────────────────────────
    const allParsed = NewsAllQuerySchema.safeParse(query)
    const limit = allParsed.success ? allParsed.data.limit : 10

    // 코인 뉴스: 코인데스크 RSS (BTC 대표 피드) + Mock 폴백
    let coinNews: NewsItem[] = []
    try {
      const rssItems = await fetchCoinDeskRss('KRW-BTC', 20)
      if (rssItems && rssItems.length > 0) {
        coinNews = rssItems
      }
    } catch (err) {
      logger.warn({ err }, '전체뉴스 — 코인데스크 RSS 오류, Mock 폴백')
    }

    if (coinNews.length === 0) {
      // Mock 코인 뉴스: 대표 심볼 순회하여 수집
      for (const sym of FEATURED_COIN_SYMBOLS) {
        coinNews.push(...generateMockNews(sym, undefined, 2))
      }
    }

    // 주식 뉴스: 네이버 RSS (삼성전자 대표) + Mock 폴백
    let stockNews: NewsItem[] = []
    try {
      const rssItems = await fetchNaverStockRss('005930', 20)
      if (rssItems && rssItems.length > 0) {
        stockNews = rssItems
      }
    } catch (err) {
      logger.warn({ err }, '전체뉴스 — 네이버 RSS 오류, Mock 폴백')
    }

    if (stockNews.length === 0) {
      for (const sym of FEATURED_STOCK_SYMBOLS) {
        stockNews.push(...generateMockNews(sym, undefined, 2))
      }
    }

    // 코인 + 주식 혼합 후 publishedAt 내림차순 정렬
    const merged = [...coinNews, ...stockNews].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )

    // 중복 title 제거 (RSS 피드가 같은 기사를 여러 심볼로 반환하는 경우)
    const seen = new Set<string>()
    const deduped: NewsItem[] = []
    for (const item of merged) {
      if (!seen.has(item.title)) {
        seen.add(item.title)
        deduped.push(item)
      }
    }

    const data = deduped.slice(0, limit)

    return reply.send({
      data,
      updatedAt: new Date().toISOString(),
      meta: { total: data.length },
    })
  })
}


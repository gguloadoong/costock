import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getHantooToken, HANTOO_BASE, resetHantooToken } from '../lib/hantooToken'
import { logger } from '../lib/logger'

// ─── 쿼리 스키마 ─────────────────────────────────────────────────────────

const PriceQuerySchema = z.object({
  symbols: z
    .string()
    .min(1)
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(z.string().min(1).max(20)).min(1).max(20)),
})

const ChartQuerySchema = z.object({
  symbol: z.string().min(1).max(20),
  period: z.enum(['D', 'W', 'M']).default('D'),
})

const InvestorQuerySchema = z.object({
  symbol: z.string().min(1).max(20),
})

// ─── 타입 정의 ────────────────────────────────────────────────────────────

interface StockPrice {
  symbol: string
  price: number
  change: number
  changePct: number
  volume: number
  marketCap: number
  high52w: number | null
  low52w: number | null
  source: 'hantoo' | 'naver'
}

interface StockCandle {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface InvestorData {
  symbol: string
  date: string
  foreign: number
  institution: number
  individual: number
}

// ─── 한국투자증권 단일 종목 가격 조회 ────────────────────────────────────

async function fetchHantooPrice(symbol: string, token: string): Promise<StockPrice> {
  const url = new URL(`${HANTOO_BASE}/uapi/domestic-stock/v1/quotations/inquire-price`)
  url.searchParams.set('FID_COND_MRKT_DIV_CODE', 'J')
  url.searchParams.set('FID_INPUT_ISCD', symbol)

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      appkey: process.env.HANTOO_APP_KEY ?? '',
      appsecret: process.env.HANTOO_APP_SECRET ?? '',
      tr_id: 'FHKST01010100',
      custtype: 'P',
    },
    signal: AbortSignal.timeout(5000),
  })

  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`)

  const data = (await res.json()) as {
    rt_cd: string
    msg1: string
    output: Record<string, string>
  }

  if (data.rt_cd !== '0') throw new Error(`${symbol}: ${data.msg1}`)

  const o = data.output
  const price = parseInt(o['stck_prpr'] ?? '0', 10)
  if (!price) throw new Error(`${symbol}: 가격 없음`)

  return {
    symbol,
    price,
    change: parseInt(o['prdy_vrss'] ?? '0', 10),
    changePct: parseFloat(o['prdy_ctrt'] ?? '0'),
    volume: parseInt(o['acml_vol'] ?? '0', 10),
    marketCap: (parseInt(o['hts_avls'] ?? '0', 10) || 0) * 100_000_000,
    high52w: parseInt(o['d250_hgpr'] ?? '0', 10) || null,
    low52w: parseInt(o['d250_lwpr'] ?? '0', 10) || null,
    source: 'hantoo',
  }
}

// ─── 네이버 단일 종목 가격 조회 (KIS 미설정 시 fallback) ─────────────────

const NAVER_BASE = 'https://m.stock.naver.com/api/stock'

async function fetchNaverPrice(symbol: string): Promise<StockPrice> {
  const res = await fetch(`${NAVER_BASE}/${symbol}/basic`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      Referer: 'https://m.stock.naver.com/',
    },
    signal: AbortSignal.timeout(5000),
  })

  if (!res.ok) throw new Error(`${symbol}: 네이버 HTTP ${res.status}`)

  const data = (await res.json()) as Record<string, unknown>

  const toNum = (s: unknown): number =>
    parseFloat((String(s ?? '')).replace(/,/g, '')) || 0

  return {
    symbol,
    price: toNum(data['closePrice']),
    change: toNum(data['compareToPreviousClosePrice']),
    changePct: toNum(data['fluctuationsRatio']),
    volume: toNum(data['accumulatedTradingVolume']),
    marketCap: 0,
    high52w: null,
    low52w: null,
    source: 'naver',
  }
}

// ─── 한국투자증권 차트(OHLCV) 조회 ──────────────────────────────────────

async function fetchHantooChart(
  symbol: string,
  period: 'D' | 'W' | 'M',
  token: string,
): Promise<StockCandle[]> {
  // 조회 기간: 오늘 ~ 1년 전
  const today = new Date()
  const endDate = formatDate(today)
  const startDate = formatDate(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()))

  const url = new URL(`${HANTOO_BASE}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`)
  url.searchParams.set('FID_COND_MRKT_DIV_CODE', 'J')
  url.searchParams.set('FID_INPUT_ISCD', symbol)
  url.searchParams.set('FID_INPUT_DATE_1', startDate)
  url.searchParams.set('FID_INPUT_DATE_2', endDate)
  url.searchParams.set('FID_PERIOD_DIV_CODE', period)
  url.searchParams.set('FID_ORG_ADJ_PRC', '0')

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      appkey: process.env.HANTOO_APP_KEY ?? '',
      appsecret: process.env.HANTOO_APP_SECRET ?? '',
      tr_id: 'FHKST03010100',
      custtype: 'P',
    },
    signal: AbortSignal.timeout(5000),
  })

  if (!res.ok) throw new Error(`차트 조회 실패: HTTP ${res.status}`)

  const data = (await res.json()) as {
    rt_cd: string
    msg1: string
    output2?: Array<Record<string, string>>
  }

  if (data.rt_cd !== '0') throw new Error(`차트 조회 실패: ${data.msg1}`)

  return (data.output2 ?? []).map((row) => ({
    date: row['stck_bsop_date'] ?? '',
    open: parseInt(row['stck_oprc'] ?? '0', 10),
    high: parseInt(row['stck_hgpr'] ?? '0', 10),
    low: parseInt(row['stck_lwpr'] ?? '0', 10),
    close: parseInt(row['stck_clpr'] ?? '0', 10),
    volume: parseInt(row['acml_vol'] ?? '0', 10),
  }))
}

// ─── 한국투자증권 투자자 동향 조회 ───────────────────────────────────────

async function fetchHantooInvestor(symbol: string, token: string): Promise<InvestorData> {
  const url = new URL(`${HANTOO_BASE}/uapi/domestic-stock/v1/quotations/inquire-investor`)
  url.searchParams.set('FID_COND_MRKT_DIV_CODE', 'J')
  url.searchParams.set('FID_INPUT_ISCD', symbol)

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      appkey: process.env.HANTOO_APP_KEY ?? '',
      appsecret: process.env.HANTOO_APP_SECRET ?? '',
      tr_id: 'FHKST01010900',
      custtype: 'P',
    },
    signal: AbortSignal.timeout(5000),
  })

  if (!res.ok) throw new Error(`투자자 조회 실패: HTTP ${res.status}`)

  const data = (await res.json()) as {
    rt_cd: string
    msg1: string
    output?: Array<Record<string, string>>
  }

  if (data.rt_cd !== '0') throw new Error(`투자자 조회 실패: ${data.msg1}`)

  const latest = data.output?.[0] ?? {}

  return {
    symbol,
    date: latest['stck_bsop_date'] ?? '',
    foreign: parseInt(latest['frgn_ntby_qty'] ?? '0', 10),
    institution: parseInt(latest['orgn_ntby_qty'] ?? '0', 10),
    individual: parseInt(latest['indv_ntby_qty'] ?? '0', 10),
  }
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

// ─── KIS 설정 여부 확인 ──────────────────────────────────────────────────

function isHantooConfigured(): boolean {
  return Boolean(process.env.HANTOO_APP_KEY && process.env.HANTOO_APP_SECRET)
}

// ─── 크로스에셋 연관 종목 매핑 ───────────────────────────────────────────

interface RelatedAsset {
  symbol: string
  name: string
  reason: string
  assetType: 'stock' | 'coin'
}

const CRYPTO_TO_STOCKS: Record<string, { symbol: string; name: string; reason: string }[]> = {
  'KRW-BTC': [
    { symbol: '323280', name: '두나무', reason: '업비트 운영사' },
    { symbol: '226340', name: '비덴트', reason: '빗썸 지분 보유' },
    { symbol: '175140', name: '인터파크홀딩스', reason: '가상자산 사업' },
  ],
  'KRW-ETH': [
    { symbol: '323280', name: '두나무', reason: '이더리움 거래량 1위' },
    { symbol: '950170', name: '크래프톤', reason: '블록체인 게임' },
  ],
  'KRW-XRP': [
    { symbol: '226340', name: '비덴트', reason: '리플 연계 사업' },
  ],
}

const STOCK_TO_CRYPTO: Record<string, { symbol: string; name: string; reason: string }[]> = {
  '323280': [
    { symbol: 'KRW-BTC', name: '비트코인', reason: '업비트 주요 거래 코인' },
    { symbol: 'KRW-ETH', name: '이더리움', reason: '업비트 2위 거래량' },
  ],
  '005930': [
    { symbol: 'KRW-BTC', name: '비트코인', reason: '반도체-가상화폐 동조화' },
  ],
}

const RelatedQuerySchema = z.object({
  symbol: z.string().min(1).max(20),
})

// ─── 라우트 등록 ─────────────────────────────────────────────────────────

/**
 * 주식 데이터 API
 *
 * GET /api/v1/stocks/price?symbols=005930,000660   — 복수 종목 현재가 (최대 20개)
 * GET /api/v1/stocks/chart?symbol=005930&period=D  — 일봉/주봉/월봉 OHLCV
 * GET /api/v1/stocks/investor?symbol=005930        — 투자자 동향
 */
export async function stockRoutes(app: FastifyInstance) {
  /**
   * 복수 종목 현재가 조회
   * - KIS 설정 시: 한국투자증권 API (병렬 조회)
   * - KIS 미설정 시: 네이버 fallback 자동 전환
   * - 개별 종목 실패 시 해당 항목만 error 필드로 응답
   */
  app.get('/price', async (req, reply) => {
    const { symbols } = PriceQuerySchema.parse(req.query)

    const useHantoo = isHantooConfigured()

    if (useHantoo) {
      let token: string
      try {
        token = await getHantooToken()
      } catch (err) {
        logger.warn(
          { err: { message: (err as Error).message } },
          '한투 토큰 발급 실패 — 네이버 fallback',
        )
        // 토큰 실패 시 전체 네이버 fallback
        return reply.send(await fetchAllNaver(symbols))
      }

      const results = await Promise.allSettled(
        symbols.map((symbol) => fetchHantooPrice(symbol, token)),
      )

      return reply.send(buildPriceResponse(symbols, results))
    }

    // KIS 미설정: 네이버 fallback
    logger.info('HANTOO_APP_KEY 미설정 — 네이버 fallback 사용')
    return reply.send(await fetchAllNaver(symbols))
  })

  /**
   * OHLCV 차트 조회
   * period: D=일봉, W=주봉, M=월봉
   * KIS 미설정 시 503
   */
  app.get('/chart', async (req, reply) => {
    const { symbol, period } = ChartQuerySchema.parse(req.query)

    if (!isHantooConfigured()) {
      return reply.status(503).send({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'HANTOO_APP_KEY / HANTOO_APP_SECRET 환경변수가 설정되지 않았습니다.',
      })
    }

    let token: string
    try {
      token = await getHantooToken()
    } catch (err) {
      logger.error({ err: { message: (err as Error).message } }, '한투 토큰 발급 실패')
      return reply.status(503).send({
        statusCode: 503,
        error: 'Service Unavailable',
        message: '한국투자증권 인증 실패. 잠시 후 다시 시도해주세요.',
      })
    }

    try {
      const candles = await fetchHantooChart(symbol, period, token)
      return reply.send({ symbol, period, data: candles, count: candles.length })
    } catch (err) {
      const message = (err as Error).message
      logger.error({ err: { message }, symbol, period }, '한투 차트 조회 실패')
      // 토큰 만료 가능성 → 캐시 초기화
      resetHantooToken()
      return reply.status(502).send({
        statusCode: 502,
        error: 'Bad Gateway',
        message: `차트 데이터 조회 실패: ${message}`,
      })
    }
  })

  /**
   * 투자자 동향 조회
   * KIS 미설정 시 503
   */
  app.get('/investor', async (req, reply) => {
    const { symbol } = InvestorQuerySchema.parse(req.query)

    if (!isHantooConfigured()) {
      return reply.status(503).send({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'HANTOO_APP_KEY / HANTOO_APP_SECRET 환경변수가 설정되지 않았습니다.',
      })
    }

    let token: string
    try {
      token = await getHantooToken()
    } catch (err) {
      logger.error({ err: { message: (err as Error).message } }, '한투 토큰 발급 실패')
      return reply.status(503).send({
        statusCode: 503,
        error: 'Service Unavailable',
        message: '한국투자증권 인증 실패. 잠시 후 다시 시도해주세요.',
      })
    }

    try {
      const investor = await fetchHantooInvestor(symbol, token)
      return reply.send({ data: investor })
    } catch (err) {
      const message = (err as Error).message
      logger.error({ err: { message }, symbol }, '한투 투자자 조회 실패')
      resetHantooToken()
      return reply.status(502).send({
        statusCode: 502,
        error: 'Bad Gateway',
        message: `투자자 동향 조회 실패: ${message}`,
      })
    }
  })

  /**
   * 크로스에셋 연관 종목 조회
   * GET /api/v1/stocks/related?symbol=KRW-BTC  — 코인 → 관련 주식
   * GET /api/v1/stocks/related?symbol=005930   — 주식 → 관련 코인
   */
  app.get('/related', async (req, reply) => {
    const parsed = RelatedQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'symbol 파라미터가 필수입니다 (예: ?symbol=KRW-BTC)',
      })
    }

    const { symbol } = parsed.data
    let related: RelatedAsset[] = []

    if (symbol.startsWith('KRW-')) {
      // 코인 → 관련 주식
      related = (CRYPTO_TO_STOCKS[symbol] ?? []).map((item) => ({
        ...item,
        assetType: 'stock' as const,
      }))
    } else {
      // 주식 → 관련 코인
      related = (STOCK_TO_CRYPTO[symbol] ?? []).map((item) => ({
        ...item,
        assetType: 'coin' as const,
      }))
    }

    return reply.send({ data: { related } })
  })
}

// ─── 내부 헬퍼 ───────────────────────────────────────────────────────────

async function fetchAllNaver(
  symbols: string[],
): Promise<{ data: Array<StockPrice | { symbol: string; error: string }>; count: number; source: string }> {
  const results = await Promise.allSettled(symbols.map(fetchNaverPrice))
  const data = symbols.map((symbol, i) => {
    const result = results[i]
    if (result === undefined || result.status === 'rejected') {
      return { symbol, error: result?.status === 'rejected' ? (result.reason as Error).message : '조회 실패' }
    }
    return result.value
  })
  return { data, count: data.length, source: 'naver' }
}

function buildPriceResponse(
  symbols: string[],
  results: PromiseSettledResult<StockPrice>[],
): { data: Array<StockPrice | { symbol: string; error: string }>; count: number } {
  const data = symbols.map((symbol, i) => {
    const result = results[i]
    if (result === undefined || result.status === 'rejected') {
      return {
        symbol,
        error: result?.status === 'rejected' ? (result.reason as Error).message : '조회 실패',
      }
    }
    return result.value
  })
  return { data, count: data.length }
}

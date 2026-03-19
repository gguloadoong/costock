/**
 * PriceService — 실시간 가격 수집 서비스
 *
 * 커버리지:
 *   - 국내주식/ETF: 한국투자증권(KIS) API (30초 폴링)
 *   - 미국주식/ETF: yahoo-finance2 v3 (30초 폴링)
 *   - 코인:         업비트 REST API (5초 폴링)
 *
 * 이벤트:
 *   priceEventEmitter.emit('price_update', PriceData[])
 */

import { EventEmitter } from 'events'
import YahooFinance from 'yahoo-finance2'
import { logger } from './logger'
import { getHantooToken, HANTOO_BASE } from './hantooToken'

// yahoo-finance2 v3 인스턴스
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

// ─── 설정 ──────────────────────────────────────────────────────────────────

const STOCK_POLL_INTERVAL_MS  = 30_000
const CRYPTO_POLL_INTERVAL_MS =  5_000
const FETCH_TIMEOUT_MS        =  5_000
const ANOMALY_THRESHOLD       =  0.30

// ─── 타입 ──────────────────────────────────────────────────────────────────

export type AssetType = 'stock_kr' | 'stock_us' | 'etf_kr' | 'etf_us' | 'crypto'

export interface PriceData {
  symbol:     string
  price:      number
  changeRate: number
  currency:   string
  assetType:  AssetType
  updatedAt:  string
}

// ─── 심볼 분류 ─────────────────────────────────────────────────────────────

// 국내주식 — KIS 6자리 코드 → symbol (.KS)
const KR_STOCKS: Record<string, { symbol: string; assetType: AssetType }> = {
  '005930': { symbol: '005930.KS', assetType: 'stock_kr' }, // 삼성전자
  '000660': { symbol: '000660.KS', assetType: 'stock_kr' }, // SK하이닉스
  '035720': { symbol: '035720.KS', assetType: 'stock_kr' }, // 카카오
  '035420': { symbol: '035420.KS', assetType: 'stock_kr' }, // NAVER
  '005380': { symbol: '005380.KS', assetType: 'stock_kr' }, // 현대차
  '373220': { symbol: '373220.KS', assetType: 'stock_kr' }, // LG에너지솔루션
  '068270': { symbol: '068270.KS', assetType: 'stock_kr' }, // 셀트리온
  '069500': { symbol: '069500.KS', assetType: 'etf_kr'   }, // KODEX 200
  '229200': { symbol: '229200.KS', assetType: 'etf_kr'   }, // KODEX 코스닥150
  '360750': { symbol: '360750.KS', assetType: 'etf_kr'   }, // TIGER 미국S&P500
}

// 미국주식/ETF — yahoo-finance2
const YAHOO_SYMBOLS: Record<string, AssetType> = {
  'NVDA':  'stock_us',
  'AAPL':  'stock_us',
  'MSFT':  'stock_us',
  'TSLA':  'stock_us',
  'META':  'stock_us',
  'AMZN':  'stock_us',
  'GOOGL': 'stock_us',
  'SPY':   'etf_us',
  'QQQ':   'etf_us',
  'TQQQ':  'etf_us',
  'SOXL':  'etf_us',
}

// 업비트 코인
const UPBIT_MARKETS = ['KRW-BTC', 'KRW-ETH', 'KRW-SOL', 'KRW-XRP']

interface UpbitTickerItem {
  market:             string
  trade_price:        number
  signed_change_rate: number
}

// ─── In-Memory 가격 캐시 ──────────────────────────────────────────────────

const priceMap = new Map<string, PriceData>()

// ─── 이벤트 이미터 ────────────────────────────────────────────────────────

export const priceEventEmitter = new EventEmitter()
priceEventEmitter.setMaxListeners(1000)

// ─── 이상값 검사 ──────────────────────────────────────────────────────────

function isValidPrice(symbol: string, newPrice: number): boolean {
  if (newPrice <= 0) return false
  const existing = priceMap.get(symbol)
  if (existing && existing.price > 0) {
    const delta = Math.abs(newPrice - existing.price) / existing.price
    if (delta > ANOMALY_THRESHOLD) {
      logger.warn({ symbol, newPrice, prevPrice: existing.price }, '이상값 필터: ±30% 초과')
      return false
    }
  }
  return true
}

// ─── KIS 국내주식/ETF 가격 갱신 ──────────────────────────────────────────

interface KisQuoteResponse {
  output?: { stck_prpr?: string; prdy_ctrt?: string }
}

async function fetchKrStockPrices(): Promise<void> {
  let token: string
  try {
    token = await getHantooToken()
  } catch (err) {
    logger.warn({ err: { message: (err as Error).message } }, 'KIS 토큰 실패 — 이전 캐시 유지')
    return
  }

  const appKey    = process.env.HANTOO_APP_KEY    ?? ''
  const appSecret = process.env.HANTOO_APP_SECRET ?? ''

  const results = await Promise.all(
    Object.entries(KR_STOCKS).map(async ([iscd, meta]) => {
      try {
        const url = new URL(`${HANTOO_BASE}/uapi/domestic-stock/v1/quotations/inquire-price`)
        url.searchParams.set('FID_COND_MRKT_DIV_CODE', 'J')
        url.searchParams.set('FID_INPUT_ISCD', iscd)

        const res = await fetch(url.toString(), {
          headers: {
            'content-type':  'application/json; charset=utf-8',
            'authorization': `Bearer ${token}`,
            'appkey':         appKey,
            'appsecret':      appSecret,
            'tr_id':          'FHKST01010100',
          },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        })

        if (!res.ok) return null

        const data = (await res.json()) as KisQuoteResponse
        const price      = parseFloat((data.output?.stck_prpr ?? '').replace(/,/g, ''))
        const changeRate = parseFloat(data.output?.prdy_ctrt ?? '0')

        if (!isValidPrice(meta.symbol, price)) return null

        const priceData: PriceData = {
          symbol:     meta.symbol,
          price,
          changeRate: Math.round(changeRate * 100) / 100,
          currency:   'KRW',
          assetType:  meta.assetType,
          updatedAt:  new Date().toISOString(),
        }
        priceMap.set(meta.symbol, priceData)
        return priceData
      } catch {
        return null
      }
    }),
  )

  const valid = results.filter((r): r is PriceData => r !== null)
  if (valid.length > 0) {
    priceEventEmitter.emit('price_update', valid)
    logger.debug({ count: valid.length }, 'KIS 국내주식/ETF 가격 갱신 완료')
  }
}

// ─── yahoo-finance2 미국주식/ETF 가격 갱신 ────────────────────────────────

async function fetchUsStockPrices(): Promise<void> {
  const symbols = Object.keys(YAHOO_SYMBOLS)

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await (yf.quote as any)(symbols, {}, { validateResult: false }) as unknown
    const quotes = Array.isArray(raw) ? raw : [raw]
    const results: PriceData[] = []

    for (const quote of quotes) {
      const symbol = typeof quote?.symbol === 'string' ? (quote.symbol as string) : null
      if (!symbol) continue

      const assetType = YAHOO_SYMBOLS[symbol]
      if (!assetType) continue

      const price      = typeof quote.regularMarketPrice         === 'number' ? (quote.regularMarketPrice as number)         : 0
      const changeRate = typeof quote.regularMarketChangePercent === 'number' ? (quote.regularMarketChangePercent as number) : 0
      const currency   = typeof quote.currency === 'string' ? (quote.currency as string) : 'USD'

      if (!isValidPrice(symbol, price)) continue

      const data: PriceData = {
        symbol,
        price,
        changeRate: Math.round(changeRate * 100) / 100,
        currency,
        assetType,
        updatedAt:  new Date().toISOString(),
      }

      priceMap.set(symbol, data)
      results.push(data)
    }

    if (results.length > 0) {
      priceEventEmitter.emit('price_update', results)
      logger.debug({ count: results.length }, '미국주식/ETF 가격 갱신 완료')
    }
  } catch (err) {
    logger.warn({ err: { message: (err as Error).message } }, 'yahoo-finance2 가격 조회 실패')
  }
}

// ─── 업비트 코인 가격 갱신 ────────────────────────────────────────────────

async function fetchCryptoPrices(): Promise<void> {
  try {
    const res = await fetch(
      `https://api.upbit.com/v1/ticker?markets=${UPBIT_MARKETS.join(',')}`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    )

    if (!res.ok) return

    const data = (await res.json()) as UpbitTickerItem[]
    const results: PriceData[] = []

    for (const item of data) {
      const price      = item.trade_price
      const changeRate = Math.round(item.signed_change_rate * 10_000) / 100

      if (!isValidPrice(item.market, price)) continue

      const priceData: PriceData = {
        symbol:    item.market,
        price,
        changeRate,
        currency:  'KRW',
        assetType: 'crypto',
        updatedAt: new Date().toISOString(),
      }
      priceMap.set(item.market, priceData)
      results.push(priceData)
    }

    if (results.length > 0) {
      priceEventEmitter.emit('price_update', results)
    }
  } catch (err) {
    logger.warn({ err: { message: (err as Error).message } }, '업비트 REST 가격 조회 실패')
  }
}

// ─── 공개 API ─────────────────────────────────────────────────────────────

export function getPrice(symbol: string): PriceData | undefined {
  return priceMap.get(symbol)
}

export function getAllPrices(): PriceData[] {
  return [...priceMap.values()]
}

// ─── 서비스 시작 / 종료 ──────────────────────────────────────────────────

let krTimer:     ReturnType<typeof setInterval> | null = null
let usTimer:     ReturnType<typeof setInterval> | null = null
let cryptoTimer: ReturnType<typeof setInterval> | null = null

export function startPriceService(): void {
  if (krTimer || usTimer || cryptoTimer) return

  void fetchKrStockPrices()
  void fetchUsStockPrices()
  void fetchCryptoPrices()

  krTimer     = setInterval(() => { void fetchKrStockPrices() }, STOCK_POLL_INTERVAL_MS)
  usTimer     = setInterval(() => { void fetchUsStockPrices() }, STOCK_POLL_INTERVAL_MS)
  cryptoTimer = setInterval(() => { void fetchCryptoPrices()  }, CRYPTO_POLL_INTERVAL_MS)

  logger.info('PriceService 시작 (KIS + yahoo-finance2 + 업비트)')
}

export function stopPriceService(): void {
  if (krTimer)     { clearInterval(krTimer);     krTimer     = null }
  if (usTimer)     { clearInterval(usTimer);     usTimer     = null }
  if (cryptoTimer) { clearInterval(cryptoTimer); cryptoTimer = null }
  logger.info('PriceService 종료')
}

import type { Redis } from 'ioredis'
import { logger } from './logger'

// ─── 캐시 키 / TTL 상수 ────────────────────────────────────────────────────

const CACHE_PREFIX_CRYPTO = 'price:crypto:'   // S1-002: 업비트 전용 키 스키마
const CACHE_PREFIX_LEGACY = 'price:v1:'       // 기존 주식 캐시 (하위 호환)

const CRYPTO_CACHE_TTL_SECONDS = 30           // 코인: 24h 운영, 30초 TTL
const STOCK_CACHE_TTL_SECONDS  = 3            // 주식: 장중 TTL
const STOCK_STALE_TTL_SECONDS  = 60           // 주식: 장 마감 후 TTL

const STALE_THRESHOLD_MS = 5_000              // 5초 무갱신 → stale 판정
const ANOMALY_THRESHOLD  = 0.30               // ±30% 급변 → 캐시 저장 거부

// ─── 타입 정의 ────────────────────────────────────────────────────────────

export interface CryptoPricePayload {
  symbol:     string
  price:      number
  change:     number
  changeRate: number
  volume24h:  number
  timestamp:  number   // Unix ms
  source:     'upbit' | 'bithumb'
}

export interface CachedCryptoPrice extends CryptoPricePayload {
  cachedAt: number     // 캐시 저장 시각 (Unix ms)
  stale:    boolean    // 5초 이상 갱신 없음
}

// ─── 이상값 검사 ──────────────────────────────────────────────────────────

/**
 * 캐시 저장 전 이상값 검사
 *
 * 거부 조건:
 *   1. price <= 0 (0원, 음수)
 *   2. 직전 캐시 대비 ±30% 초과 급변
 *
 * 이상값 발생 시 false 반환 → 호출부에서 캐시 저장 건너뜀
 */
function isValidPrice(
  symbol: string,
  newPrice: number,
  cachedPrice: number | null,
): boolean {
  if (newPrice <= 0) {
    logger.warn({ symbol, price: newPrice }, '이상값 필터: 가격 0 이하 — 캐시 저장 거부')
    return false
  }

  if (cachedPrice !== null && cachedPrice > 0) {
    const changeRate = Math.abs(newPrice - cachedPrice) / cachedPrice
    if (changeRate > ANOMALY_THRESHOLD) {
      logger.warn(
        { symbol, newPrice, cachedPrice, changeRate: changeRate.toFixed(4) },
        `이상값 필터: ±30% 초과 급변 — 캐시 저장 거부`,
      )
      return false
    }
  }

  return true
}

// ─── 업비트 (코인) 캐시 ───────────────────────────────────────────────────

/**
 * 업비트 가격 캐시 저장
 *
 * - 키: price:crypto:{symbol}  (예: price:crypto:BTC-KRW)
 * - TTL: 30초
 * - 이상값(0원, 음수, ±30% 급변) → 저장 거부
 * - 기존 캐시 조회 후 이상값 비교 (Redis GET → 검증 → SET)
 */
export async function setCryptoPriceCache(
  redis: Redis,
  payload: CryptoPricePayload,
): Promise<boolean> {
  const { symbol, price } = payload
  const key = `${CACHE_PREFIX_CRYPTO}${symbol}`

  try {
    // 직전 캐시 조회 — 이상값 비교 기준
    const existing = await redis.get(key)
    let cachedPrice: number | null = null
    if (existing !== null) {
      try {
        const parsed = JSON.parse(existing) as CachedCryptoPrice
        cachedPrice = parsed.price ?? null
      } catch {
        // 파싱 실패 시 기준값 없음으로 처리
      }
    }

    if (!isValidPrice(symbol, price, cachedPrice)) {
      return false  // 이상값 — 캐시 저장 거부
    }

    const cached: CachedCryptoPrice = {
      ...payload,
      cachedAt: Date.now(),
      stale: false,
    }

    await redis.set(key, JSON.stringify(cached), 'EX', CRYPTO_CACHE_TTL_SECONDS)
    return true
  } catch (err) {
    logger.warn(
      { err: { message: (err as Error).message }, symbol },
      'Redis 코인 가격 캐시 저장 실패',
    )
    return false
  }
}

/**
 * 업비트 가격 캐시 조회
 *
 * - stale 감지: cachedAt 기준 5초 경과 시 stale: true 로 오버라이드
 * - 캐시 미스: null 반환
 */
export async function getCryptoPriceFromCache(
  redis: Redis,
  symbol: string,
): Promise<CachedCryptoPrice | null> {
  const key = `${CACHE_PREFIX_CRYPTO}${symbol}`

  try {
    const raw = await redis.get(key)
    if (raw === null) return null

    const cached = JSON.parse(raw) as CachedCryptoPrice

    // stale 감지: 마지막 캐시 저장 후 5초 초과
    const ageMs = Date.now() - (cached.cachedAt ?? 0)
    if (ageMs > STALE_THRESHOLD_MS) {
      cached.stale = true
    }

    return cached
  } catch (err) {
    logger.warn(
      { err: { message: (err as Error).message }, symbol },
      'Redis 코인 가격 캐시 조회 실패',
    )
    return null
  }
}

/**
 * 복수 심볼 업비트 가격 캐시 일괄 조회 (MGET — N+1 방지)
 *
 * stale 감지 적용 포함
 * 캐시 미스 심볼은 null 반환
 */
export async function getCryptoPricesFromCache(
  redis: Redis,
  symbols: string[],
): Promise<Record<string, CachedCryptoPrice | null>> {
  if (symbols.length === 0) return {}

  const keys = symbols.map((s) => `${CACHE_PREFIX_CRYPTO}${s}`)

  try {
    const values = await redis.mget(...keys)
    const result: Record<string, CachedCryptoPrice | null> = {}
    const now = Date.now()

    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i]
      const raw = values[i]
      if (symbol === undefined) continue

      if (raw === null || raw === undefined) {
        result[symbol] = null
        continue
      }

      try {
        const cached = JSON.parse(raw) as CachedCryptoPrice
        // stale 감지
        const ageMs = now - (cached.cachedAt ?? 0)
        if (ageMs > STALE_THRESHOLD_MS) {
          cached.stale = true
        }
        result[symbol] = cached
      } catch {
        result[symbol] = null
      }
    }

    return result
  } catch (err) {
    logger.warn(
      { err: { message: (err as Error).message } },
      'Redis 코인 가격 MGET 실패 — 전체 캐시 미스 처리',
    )
    return Object.fromEntries(symbols.map((s) => [s, null]))
  }
}

// ─── 기존 주식 캐시 (하위 호환 유지) ─────────────────────────────────────

/**
 * 복수 심볼 가격 캐시 조회 (Redis MGET — N+1 방지)
 * 기존 주식 가격 조회용 — 업비트는 getCryptoPriceFromCache 사용
 */
export async function getPriceFromCache(
  redis: Redis,
  symbols: string[],
): Promise<Record<string, unknown | null>> {
  if (symbols.length === 0) return {}

  const keys = symbols.map((s) => `${CACHE_PREFIX_LEGACY}${s}`)

  try {
    const values = await redis.mget(...keys)
    const result: Record<string, unknown | null> = {}

    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i]
      const raw = values[i]
      if (symbol === undefined) continue

      if (raw === null || raw === undefined) {
        result[symbol] = null
      } else {
        try {
          result[symbol] = JSON.parse(raw)
        } catch {
          result[symbol] = null
        }
      }
    }

    return result
  } catch (err) {
    logger.warn(
      { err: { message: (err as Error).message } },
      'Redis 캐시 조회 실패 — DB 폴백',
    )
    return Object.fromEntries(symbols.map((s) => [s, null]))
  }
}

/**
 * 가격 캐시 저장 (Redis pipeline — 라운드트립 최소화)
 * 기존 주식 가격 저장용 — 업비트는 setCryptoPriceCache 사용
 */
export async function setPriceCache(
  redis: Redis,
  prices: Record<string, unknown>,
): Promise<void> {
  if (Object.keys(prices).length === 0) return

  try {
    const pipeline = redis.pipeline()
    const ttl = isStockMarketOpen() ? STOCK_CACHE_TTL_SECONDS : STOCK_STALE_TTL_SECONDS

    for (const [symbol, data] of Object.entries(prices)) {
      const key = `${CACHE_PREFIX_LEGACY}${symbol}`
      pipeline.set(key, JSON.stringify(data), 'EX', ttl)
    }

    await pipeline.exec()
  } catch (err) {
    logger.warn(
      { err: { message: (err as Error).message } },
      'Redis 캐시 저장 실패',
    )
  }
}

/**
 * 한국 주식 장 운영 시간 여부 (KST 09:00 ~ 15:30, 월~금)
 * 코인은 24시간 운영 — 이 함수를 사용하지 않음
 */
function isStockMarketOpen(): boolean {
  const now = new Date()
  const kstHours   = (now.getUTCHours() + 9) % 24
  const kstMinutes = now.getUTCMinutes()
  const kstTime    = kstHours * 100 + kstMinutes

  const day = now.getUTCDay()
  const isWeekday = day >= 1 && day <= 5  // 월~금

  return isWeekday && kstTime >= 900 && kstTime <= 1530
}

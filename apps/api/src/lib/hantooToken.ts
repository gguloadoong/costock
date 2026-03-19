import { logger } from './logger'

// ─── 한국투자증권 OAuth 토큰 캐시 ────────────────────────────────────────

export const HANTOO_BASE = 'https://openapi.koreainvestment.com:9443'

// 만료 10분 전에 미리 갱신 (KIS 알림 중복 방지 안전 마진)
const REFRESH_MARGIN_MS = 10 * 60 * 1000

let cachedToken: string | null = null
let tokenExpiry = 0

// 동시 다발 요청 시 토큰 중복 발급 방지용 in-flight promise
let inflightRequest: Promise<string> | null = null

/**
 * 한국투자증권 OAuth2 액세스 토큰 발급 (with 인메모리 캐시)
 *
 * - 만료 10분 전에 자동 갱신 (KIS 카카오톡 알림 중복 방지)
 * - 동시 요청 시 단일 발급 보장 (in-flight promise deduplication)
 * - 타임아웃: 8초 (외부 API 호출)
 * - 서버 재시작 시 새로 발급 (인메모리 캐시이므로 자동)
 * - API 키 미설정 시 에러 throw → 호출부에서 503 fallback
 */
export async function getHantooToken(): Promise<string> {
  const now = Date.now()

  // 유효한 캐시가 있으면 즉시 반환 (만료 10분 전 이전까지)
  if (cachedToken !== null && now < tokenExpiry - REFRESH_MARGIN_MS) {
    return cachedToken
  }

  // 이미 발급 요청 중이면 같은 promise를 공유 (중복 발급 방지)
  if (inflightRequest !== null) {
    return inflightRequest
  }

  inflightRequest = _issueToken()
  try {
    const token = await inflightRequest
    return token
  } finally {
    inflightRequest = null
  }
}

async function _issueToken(): Promise<string> {
  const now = Date.now()

  const appKey = process.env.HANTOO_APP_KEY
  const appSecret = process.env.HANTOO_APP_SECRET

  if (!appKey || !appSecret) {
    throw new Error('HANTOO_APP_KEY / HANTOO_APP_SECRET 환경변수가 설정되지 않았습니다.')
  }

  const res = await fetch(`${HANTOO_BASE}/oauth2/tokenP`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      appkey: appKey,
      appsecret: appSecret,
    }),
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) {
    throw new Error(`한투 토큰 발급 실패: HTTP ${res.status}`)
  }

  const data = (await res.json()) as {
    access_token?: string
    expires_in?: number
  }

  if (!data.access_token) {
    throw new Error('한투 토큰 응답에 access_token이 없습니다.')
  }

  const expiresIn = data.expires_in ?? 86400
  cachedToken = data.access_token
  tokenExpiry = now + expiresIn * 1000

  const expiresAt = new Date(tokenExpiry).toISOString()
  logger.info(
    { expiresIn, expiresAt, refreshMarginMin: REFRESH_MARGIN_MS / 60_000 },
    '한투 토큰 발급 완료 — 다음 갱신: 만료 10분 전',
  )

  return cachedToken
}

/**
 * 캐시된 토큰 강제 초기화 (테스트 / 에러 복구용)
 *
 * 주의: API 응답 오류(rt_cd !== '0') 등 토큰과 무관한 에러에서는
 * 호출하지 말 것 — 불필요한 재발급으로 KIS 카카오톡 알림 유발
 */
export function resetHantooToken(): void {
  cachedToken = null
  tokenExpiry = 0
  inflightRequest = null
  logger.warn('한투 토큰 캐시 강제 초기화 — 다음 요청 시 재발급')
}

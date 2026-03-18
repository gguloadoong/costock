import { logger } from './logger'

// ─── 한국투자증권 OAuth 토큰 캐시 ────────────────────────────────────────

export const HANTOO_BASE = 'https://openapi.koreainvestment.com:9443'

let cachedToken: string | null = null
let tokenExpiry = 0

/**
 * 한국투자증권 OAuth2 액세스 토큰 발급 (with 인메모리 캐시)
 *
 * - 만료 1분 전에 자동 갱신
 * - 타임아웃: 8초 (외부 API 호출)
 * - API 키 미설정 시 에러 throw → 호출부에서 503 fallback
 */
export async function getHantooToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken !== null && now < tokenExpiry - 60_000) {
    return cachedToken
  }

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

  cachedToken = data.access_token
  tokenExpiry = now + (data.expires_in ?? 86400) * 1000

  logger.info({ expiresIn: data.expires_in ?? 86400 }, '한투 토큰 발급 완료')

  return cachedToken
}

/**
 * 캐시된 토큰 강제 초기화 (테스트 / 에러 복구용)
 */
export function resetHantooToken(): void {
  cachedToken = null
  tokenExpiry = 0
}

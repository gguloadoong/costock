import pino, { type LoggerOptions } from 'pino'

/**
 * 구조화된 로거 (pino 기반)
 *
 * 민감 데이터 마스킹 규칙:
 * - password, token, secret, authorization: 완전 마스킹
 * - email: 로깅 허용 (이슈 추적 목적)
 * - 사용자 투자 데이터(포트폴리오, 잔고): 절대 로깅 금지
 */
const options: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      'apiKey',
      '*.password',
      '*.token',
      '*.secret',
      '*.apiKey',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
  base: {
    service: 'costock-api',
    env: process.env.NODE_ENV ?? 'development',
  },
}

// exactOptionalPropertyTypes: transport은 undefined 불가 — 개발 환경에서만 조건부 할당
if (process.env.NODE_ENV === 'development') {
  options.transport = {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' },
  }
}

export const logger = pino(options)

import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { logger } from '../lib/logger'

/**
 * 글로벌 에러 핸들러
 *
 * 원칙:
 * - 프로덕션: 클라이언트에 스택 트레이스/내부 경로 절대 노출 금지
 * - 개발: 디버깅을 위해 상세 에러 포함
 * - 모든 5xx는 Sentry로 전송 (추후 연동)
 */
export function errorHandler(
  err: FastifyError,
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const isDev = process.env.NODE_ENV === 'development'

  // ─── Zod 유효성 검사 에러 ────────────────────────────────────
  if (err instanceof ZodError) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Validation Error',
      message: '입력값이 올바르지 않습니다.',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    })
  }

  // ─── JWT 인증 에러 ───────────────────────────────────────────
  if (err.statusCode === 401) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: '인증이 필요합니다.',
    })
  }

  // ─── Rate Limit 에러 ────────────────────────────────────────
  if (err.statusCode === 429) {
    return reply.status(429).send({
      statusCode: 429,
      error: 'Too Many Requests',
      message: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
    })
  }

  // ─── 4xx 클라이언트 에러 ────────────────────────────────────
  if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
    return reply.status(err.statusCode).send({
      statusCode: err.statusCode,
      error: err.name,
      message: err.message,
    })
  }

  // ─── 5xx 서버 에러 ──────────────────────────────────────────
  // 구조화된 로그 (스택 포함) — 서버 내부에서만, 클라이언트 미전달
  logger.error({
    err: {
      message: err.message,
      stack: err.stack,
      code: err.code,
    },
    req: {
      method: req.method,
      url: req.url,
      // IP 로깅: 장애 추적 목적
      ip: req.ip,
    },
  }, '처리되지 않은 서버 에러')

  return reply.status(500).send({
    statusCode: 500,
    error: 'Internal Server Error',
    // 프로덕션: 일반 메시지만. 개발: 실제 에러 메시지
    message: isDev ? err.message : '서버 내부 오류가 발생했습니다.',
    // 개발 환경에서만 스택 트레이스 노출
    ...(isDev && { stack: err.stack }),
  })
}

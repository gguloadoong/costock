import type { FastifyInstance } from 'fastify'

/**
 * 포트폴리오 API (스텁 — Phase 0)
 * Phase 1에서 JWT 인증 + IDOR 방지 로직과 함께 구현
 */
export async function portfolioRoutes(app: FastifyInstance) {
  app.get('/', async (_req, reply) => {
    return reply.status(501).send({ message: 'Phase 1에서 구현 예정' })
  })
}

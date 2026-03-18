import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  nickname: z.string().min(2).max(50).optional(),
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

/**
 * 인증 API (스텁 — Phase 0)
 * bcrypt 해싱, JWT 발급은 Phase 1에서 구현
 */
export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (req, reply) => {
    RegisterSchema.parse(req.body)
    // TODO: Phase 1 — bcrypt 해싱 후 DB 저장
    return reply.status(501).send({ message: 'Phase 1에서 구현 예정' })
  })

  app.post('/login', async (req, reply) => {
    LoginSchema.parse(req.body)
    // TODO: Phase 1 — 비밀번호 검증 후 JWT 발급
    return reply.status(501).send({ message: 'Phase 1에서 구현 예정' })
  })
}

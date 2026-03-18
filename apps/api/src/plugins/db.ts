import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { Pool } from 'pg'
import { logger } from '../lib/logger'

declare module 'fastify' {
  interface FastifyInstance {
    db: Pool
  }
}

/**
 * PostgreSQL 커넥션 풀 플러그인
 *
 * - 커넥션 풀: min 2 / max 10 (Fargate 0.5vCPU 기준 적정값)
 * - statement_timeout: 10초 (장기 쿼리 차단)
 * - idle_in_transaction_session_timeout: 30초
 */
export const dbPlugin = fp(async (app: FastifyInstance) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    min: 2,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,  // 5초 내 연결 실패 시 에러
    statement_timeout: 10_000,
    options: '-c idle_in_transaction_session_timeout=30000',
  })

  // 기동 시 연결 확인
  try {
    const client = await pool.connect()
    await client.query('SELECT 1')
    client.release()
    logger.info('PostgreSQL 연결 확인 완료')
  } catch (err) {
    logger.error({ err: { message: (err as Error).message } }, 'PostgreSQL 연결 실패')
    throw err
  }

  app.decorate('db', pool)

  app.addHook('onClose', async () => {
    await pool.end()
    logger.info('PostgreSQL 커넥션 풀 종료')
  })
})

import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { Redis } from 'ioredis'
import { logger } from '../lib/logger'

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis
  }
}

/**
 * Redis 클라이언트 플러그인
 *
 * 역할별 DB 분리 (프로덕션 Redis Cluster 기준):
 * DB 0: 세션
 * DB 1: 가격 캐시 (본 플러그인)
 * DB 2: Rate Limit 카운터
 * DB 3: WebSocket 구독 목록
 */
export const redisPlugin = fp(async (app: FastifyInstance) => {
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    db: 1,  // 가격 캐시 전용 DB
    maxRetriesPerRequest: 3,
    connectTimeout: 5_000,
    lazyConnect: false,
    // 재연결 전략: 지수 백오프 (최대 30초)
    retryStrategy: (times) => {
      const delay = Math.min(times * 200, 30_000)
      logger.warn({ attempt: times, delayMs: delay }, 'Redis 재연결 시도')
      return delay
    },
  })

  redis.on('connect', () => logger.info('Redis 연결 수립'))
  redis.on('error', (err) => logger.error({ err: { message: err.message } }, 'Redis 에러'))
  redis.on('close', () => logger.warn('Redis 연결 종료'))

  app.decorate('redis', redis)

  app.addHook('onClose', async () => {
    await redis.quit()
    logger.info('Redis 연결 종료')
  })
})

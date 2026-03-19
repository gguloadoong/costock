import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import jwt from '@fastify/jwt'
import websocket from '@fastify/websocket'
import { Redis } from 'ioredis'

import { priceRoutes } from './routes/price'
import { portfolioRoutes } from './routes/portfolio'
import { authRoutes } from './routes/auth'
import { wsRoutes } from './routes/ws'
import { stockRoutes } from './routes/stock'
import { searchRoutes } from './routes/search'
import { marketRoutes } from './routes/market'
import { newsRoutes } from './routes/news'
import { traderRoutes, notificationRoutes } from './routes/traders'
import { dbPlugin } from './plugins/db'
import { redisPlugin } from './plugins/redis'
import { errorHandler } from './middleware/errorHandler'
import { logger } from './lib/logger'
import { startTraderEngine, stopTraderEngine } from './lib/traderEngine'
import { startPriceService, stopPriceService } from './lib/priceService'
import { startNotificationService, stopNotificationService } from './lib/notificationService'

const PORT = Number(process.env.PORT ?? 3000)
const HOST = process.env.HOST ?? '0.0.0.0'

export const app = Fastify({
  // pino logger 옵션 — exactOptionalPropertyTypes 우회를 위해 타입 단언 사용
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    redact: ['req.headers.authorization', 'body.password', 'body.token'],
    ...(process.env.NODE_ENV === 'development' && {
      transport: { target: 'pino-pretty', options: { colorize: true } },
    }),
  } as Parameters<typeof Fastify>[0]['logger'],
  // JSON Schema 기반 직렬화 (Fastify 성능 핵심)
  ajv: {
    customOptions: {
      removeAdditional: true,
      coerceTypes: 'array',
      useDefaults: true,
    },
  },
  trustProxy: true,
})

async function buildApp() {
  // ─── 플러그인 등록 ───────────────────────────────────────────

  await app.register(helmet, {
    contentSecurityPolicy: false, // API 서버는 CSP 불필요
  })

  await app.register(cors, {
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3001'],
    credentials: true,
  })

  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    redis: new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379'),
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
    }),
  })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET!, // 런타임에 없으면 즉시 crash — 의도적
    sign: {
      expiresIn: '24h',
      algorithm: 'HS256',
    },
  })

  await app.register(websocket)

  // DB / Redis 커넥션 플러그인
  await app.register(dbPlugin)
  await app.register(redisPlugin)

  // ─── 글로벌 에러 핸들러 ─────────────────────────────────────
  app.setErrorHandler(errorHandler)

  // ─── 라우트 등록 ────────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/api/v1/auth' })
  await app.register(priceRoutes, { prefix: '/api/v1/prices' })
  await app.register(portfolioRoutes, { prefix: '/api/v1/portfolios' })
  await app.register(wsRoutes, { prefix: '/ws' })
  await app.register(stockRoutes, { prefix: '/api/v1/stocks' })
  await app.register(searchRoutes, { prefix: '/api/v1/instruments' })
  await app.register(marketRoutes, { prefix: '/api/v1/market' })
  await app.register(newsRoutes, { prefix: '/api/v1' })
  await app.register(traderRoutes, { prefix: '/api/v1/traders' })
  await app.register(notificationRoutes, { prefix: '/api/v1/notifications' })

  // 헬스체크 (로드밸런서 타겟 그룹 헬스체크용)
  app.get('/health', { logLevel: 'silent' }, async () => {
    const services: { database: 'ok' | 'error'; redis: 'ok' | 'error' } = {
      database: 'ok',
      redis: 'ok',
    }

    // DB ping
    try {
      const client = await app.db.connect()
      await client.query('SELECT 1')
      client.release()
    } catch {
      services.database = 'error'
    }

    // Redis ping
    try {
      await app.redis.ping()
    } catch {
      services.redis = 'error'
    }

    const degraded = services.database === 'error' || services.redis === 'error'

    return {
      status: degraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.1.0',
      services,
    }
  })

  return app
}

async function start() {
  try {
    const server = await buildApp()
    startPriceService()
    startTraderEngine()
    await startNotificationService()

    // JWT_SECRET 환경변수 미설정 시 기동 거부
    if (!process.env.JWT_SECRET) {
      logger.error('JWT_SECRET 환경변수가 설정되지 않았습니다. 서버를 종료합니다.')
      process.exit(1)
    }

    await server.listen({ port: PORT, host: HOST })
    logger.info(`CoStock API 서버 기동: http://${HOST}:${PORT}`)
  } catch (err) {
    logger.error({ err }, 'API 서버 기동 실패')
    process.exit(1)
  }
}

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`${signal} 수신 — Graceful shutdown 시작`)
  stopPriceService()
  stopTraderEngine()
  stopNotificationService()
  await app.close()
  logger.info('서버 종료 완료')
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

start()

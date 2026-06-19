import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import { initDb, persistDb } from './db/index.js'
import { authMiddleware } from './routes/auth.js'
import authRouter from './routes/auth.js'
import novelRoutes from './routes/novels.js'
import writingStyleRoutes from './routes/writingStyles.js'

dotenv.config()

const PORT = parseInt(process.env.PORT || '3002', 10)
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

async function main() {
  await initDb()

  const app = express()

  // Rate limiting
  const generalLimiter = rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests' },
  })
  const aiLimiter = rateLimit({
    windowMs: 60_000,
    max: 10,
    message: { error: 'AI rate limit exceeded' },
  })

  // Middleware
  app.use(cors({ origin: CORS_ORIGIN, credentials: true }))
  app.use(express.json({ limit: '10mb' }))
  app.use(generalLimiter)
  app.use(authMiddleware)

  // Routes
  app.get('/', (_req, res) => {
    res.json({ name: 'NovelWrite Server', version: '0.1.1-alpha', status: 'running' })
  })

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  app.use('/api/auth', authRouter)
  app.use('/api/novels', novelRoutes)
  app.use('/api/writing-styles', writingStyleRoutes)

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Server Error]', err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  })

  // 自动落盘：每 30s 将内存数据写入磁盘
  const persistInterval = setInterval(() => persistDb(), 30_000)

  // 优雅关闭
  const shutdown = () => {
    clearInterval(persistInterval)
    persistDb()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  app.listen(PORT, () => {
    console.log(`NovelWrite server running on http://localhost:${PORT}`)
    console.log(`CORS origin: ${CORS_ORIGIN}`)
    console.log(`Auto-persist: every 30s`)
  })
}

main().catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})

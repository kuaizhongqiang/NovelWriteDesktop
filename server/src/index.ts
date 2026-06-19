import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { initDb } from './db/index.js'
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

  // Middleware
  app.use(cors({ origin: CORS_ORIGIN, credentials: true }))
  app.use(express.json({ limit: '10mb' }))
  app.use(authMiddleware)

  // Routes
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

  app.listen(PORT, () => {
    console.log(`NovelWrite server running on http://localhost:${PORT}`)
    console.log(`CORS origin: ${CORS_ORIGIN}`)
  })
}

main().catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})

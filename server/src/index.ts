import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { initDb, persistDb } from './db/index.js'
import { authMiddleware } from './routes/auth.js'
import authRouter from './routes/auth.js'
import novelRoutes from './routes/novels.js'
import writingStyleRoutes from './routes/writingStyles.js'
import aiRoutes from './routes/ai.js'
import { ensurePasswordInitialized } from './db/password.js'
import { getCookieSecret } from './db/session.js'

dotenv.config()

const PORT = parseInt(process.env.PORT || '3002', 10)
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

// 前端构建产物路径 (相对于 server/dist/)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webDist = path.resolve(__dirname, '../static')

async function main() {
  await initDb()

  // 首次启动自动生成密码
  const initialPassword = ensurePasswordInitialized()
  if (initialPassword) {
    console.log('')
    console.log('  ╔══════════════════════════════════════════╗')
    console.log('  ║  NovelWrite 首次启动                     ║')
    console.log(`  ║  初始密码: ${initialPassword.padEnd(22)}║`)
    console.log('  ║  请复制保存，登录后建议修改密码           ║')
    console.log('  ╚══════════════════════════════════════════╝')
    console.log('')
  }

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

  // 安全中间件（顺序很重要）
  app.use((_req, res, next) => {
    // CSP: 限制资源加载来源，防止 XSS
    // connect-src 必须包含前端实际域名（从 CORS_ORIGIN 取），不能写死
    const frontendOrigin = CORS_ORIGIN.replace(/\/$/, '')
    // API 自身地址（前端不通过反代时直连用）
    const apiOrigin = `http://localhost:${PORT}`
    const origins = [...new Set(['self', frontendOrigin, apiOrigin])]
    const connectSrc = `connect-src ${origins.join(' ')}`
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        connectSrc,
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    )
    // 其他安全头
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('X-XSS-Protection', '0') // 已废弃但兼容旧浏览器
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    next()
  })

  // CORS: 动态回显请求来源（支持反代场景）
  // 安全约束：不信任任意 origin，只回显与配置匹配的来源
  const corsLogger = process.env.DEBUG ? console.log : () => {}
  app.use(cors({
    origin: (origin, callback) => {
      // 无 origin（curl/服务器请求）放行
      if (!origin) return callback(null, true)
      corsLogger(`[CORS] Request from: ${origin}, configured: ${CORS_ORIGIN}`)
      // 明确配置的来源
      if (origin === CORS_ORIGIN) return callback(null, true)
      // localhost 开发来源
      if (origin.startsWith('http://localhost:')) return callback(null, true)
      corsLogger(`[CORS] Allowing dynamic origin: ${origin}`)
      callback(null, origin) // 反代场景：信任客户端传过来的 origin
    },
    credentials: true,
  }))
  app.use(express.json({ limit: '10mb' }))
  app.use(cookieParser(getCookieSecret()))
  app.use(generalLimiter)

  // 静态文件（在 auth 之前，公开访问）
  app.use(express.static(webDist))

  // Auth 中间件（API 路由需要认证）
  app.use(authMiddleware)

  // API 路由
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })
  app.use('/api/auth', authRouter)
  app.use('/api/novels', novelRoutes)
  app.use('/api/writing-styles', writingStyleRoutes)
  app.use('/api/ai', aiLimiter, aiRoutes)

  // SPA fallback: 非 API 请求返回 index.html
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json({ error: 'Not found' })
      return
    }
    res.sendFile(path.join(webDist, 'index.html'))
  })

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
    console.log(`Static files: ${webDist}`)
    console.log(`Auto-persist: every 30s`)
  })
}

main().catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})

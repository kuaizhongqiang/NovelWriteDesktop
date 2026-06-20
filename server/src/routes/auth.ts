/**
 * 认证路由（Cookie Session + 密码登录）
 *
 * 兼容旧 Bearer token（API Key），双通道认证。
 */
import { Router, type Request, type Response, type NextFunction } from 'express'
import crypto from 'crypto'
import { getDb } from '../db/index.js'
import { queryFirst } from '../db/query.js'
import { createSession, validateSession, deleteSession, getCookieName } from '../db/session.js'
import { verifyPassword, getStoredHash, changePassword } from '../db/password.js'

const router = Router()
const API_KEY_PREFIX = 'nw_'

// ============ 公开路径 ============

const PUBLIC_PATHS = ['/', '/login', '/api/health', '/api/auth/login', '/api/auth/logout', '/api/auth/status']

// ============ 认证中间件（Cookie 优先，Bearer 降级） ============

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (PUBLIC_PATHS.includes(req.path)) {
    next()
    return
  }

  // 1. 检查 Cookie Session
  if (req.signedCookies?.[getCookieName()]) {
    const sessionId = req.signedCookies[getCookieName()]
    if (validateSession(sessionId)) {
      next()
      return
    }
  }

  // 2. 降级：Bearer Token（兼容旧 API Key）
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const keyHash = crypto.createHash('sha256').update(token).digest('hex')
    const key = queryFirst<{ revoked: number }>('SELECT revoked FROM auth_keys WHERE key_hash = ?', [keyHash])
    if (key && !key.revoked) {
      next()
      return
    }
  }

  res.status(401).json({ error: 'Unauthorized' })
}

// ============ POST /api/auth/login ============

router.post('/login', (req: Request, res: Response) => {
  const { password } = req.body
  console.log(`[Auth] Login attempt from origin: ${req.headers.origin || 'unknown'}`)
  if (!password || typeof password !== 'string') {
    console.log('[Auth] Missing password in request body')
    res.status(400).json({ error: 'Password is required' })
    return
  }

  const stored = getStoredHash()
  console.log(`[Auth] Password hash ${stored ? 'found' : 'NOT FOUND'} in DB`)
  if (!stored || !verifyPassword(password, stored)) {
    console.log('[Auth] Password verification FAILED')
    console.log(`[Auth] Request headers:`, JSON.stringify(req.headers))
    res.status(401).json({ error: 'Invalid password' })
    return
  }
  console.log('[Auth] Password verification OK')

  const sessionId = createSession()
  res.cookie(getCookieName(), sessionId, {
    signed: true,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  })
  res.json({ ok: true })
})

// ============ POST /api/auth/logout ============

router.post('/logout', (req: Request, res: Response) => {
  const sessionId = req.signedCookies?.[getCookieName()]
  if (sessionId) {
    deleteSession(sessionId)
  }
  res.clearCookie(getCookieName(), { path: '/' })
  res.json({ ok: true })
})

// ============ GET /api/auth/status ============

router.get('/status', (req: Request, res: Response) => {
  const sessionId = req.signedCookies?.[getCookieName()]
  const loggedIn = !!sessionId && validateSession(sessionId)
  res.json({ loggedIn })
})

// ============ POST /api/auth/change-password ============

router.post('/change-password', async (req: Request, res: Response) => {
  const { oldPassword, newPassword } = req.body
  if (!oldPassword || !newPassword) {
    res.status(400).json({ error: 'oldPassword and newPassword are required' })
    return
  }
  if (typeof newPassword !== 'string' || newPassword.length < 4) {
    res.status(400).json({ error: 'New password must be at least 4 characters' })
    return
  }

  const ok = await changePassword(oldPassword, newPassword)
  if (!ok) {
    res.status(401).json({ error: 'Invalid old password' })
    return
  }
  res.json({ ok: true })
})

// ============ 工具函数（CLI 使用） ============

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

function generateApiKey(): string {
  return API_KEY_PREFIX + crypto.randomBytes(32).toString('hex')
}

export { generateApiKey, hashKey }
export default router

import { Router, type Request, type Response, type NextFunction } from 'express'
import crypto from 'crypto'
import { getDb } from '../db/index.js'
import { queryFirst } from '../db/query.js'

const router = Router()

const API_KEY_PREFIX = 'nw_'

// ============ 工具函数 ============

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

function generateApiKey(): string {
  return API_KEY_PREFIX + crypto.randomBytes(32).toString('hex')
}

// ============ 参数化查询 ============

interface AuthKeyRow {
  id: string
  name: string
  revoked: number
  [key: string]: unknown
}

function findKeyByHash(keyHash: string): AuthKeyRow | null {
  return queryFirst<AuthKeyRow>(
    'SELECT id, name, revoked FROM auth_keys WHERE key_hash = ?',
    [keyHash],
  )
}

function updateLastUsed(id: string): void {
  const db = getDb()
  db.run("UPDATE auth_keys SET last_used_at = datetime('now') WHERE id = ?", [id])
}

// ============ 认证中间件 ============

const PUBLIC_PATHS = ['/', '/api/health', '/api/auth/login']

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (PUBLIC_PATHS.includes(req.path)) {
    next()
    return
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return
  }

  const token = authHeader.slice(7)
  const keyHash = hashKey(token)
  const key = findKeyByHash(keyHash)

  if (!key) {
    res.status(401).json({ error: 'Invalid API key' })
    return
  }

  if (key.revoked) {
    res.status(401).json({ error: 'API key has been revoked' })
    return
  }

  // 更新最后使用时间（不持久化——由 30s 定时器兜底）
  updateLastUsed(key.id)
  next()
}

// ============ 登录 ============

router.post('/login', (req: Request, res: Response) => {
  const { key } = req.body
  if (!key || typeof key !== 'string') {
    res.status(400).json({ error: 'Missing key in request body' })
    return
  }

  const keyHash = hashKey(key)
  const keyData = findKeyByHash(keyHash)

  if (!keyData) {
    res.status(401).json({ error: 'Invalid API key' })
    return
  }

  if (keyData.revoked) {
    res.status(401).json({ error: 'API key has been revoked' })
    return
  }

  updateLastUsed(keyData.id)

  res.json({ ok: true, id: keyData.id, name: keyData.name })
})

export { generateApiKey, hashKey }
export default router

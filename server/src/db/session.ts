/**
 * HTTP Session 管理器（与 AI Session 独立）
 *
 * Cookie-based session store，24h过期。
 */
import crypto from 'crypto'

interface SessionData {
  createdAt: number
  lastActivityAt: number
}

const sessions = new Map<string, SessionData>()
const SESSION_TTL_MS = 24 * 60 * 60 * 1000
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000
const SESSION_COOKIE = 'nw_session'

let cleanupTimer: ReturnType<typeof setInterval> | null = null
let cookieSecret = process.env.SESSION_SECRET || 'novelwrite-default-secret'

function startCleanup() {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [id, data] of sessions) {
      if (now - data.lastActivityAt > SESSION_TTL_MS) sessions.delete(id)
    }
  }, CLEANUP_INTERVAL_MS)
}

export function setCookieSecret(secret: string) {
  cookieSecret = secret
}

export function getCookieSecret(): string {
  return cookieSecret
}

export function getCookieName(): string {
  return SESSION_COOKIE
}

export function createSession(): string {
  startCleanup()
  const id = crypto.randomBytes(32).toString('hex')
  sessions.set(id, { createdAt: Date.now(), lastActivityAt: Date.now() })
  return id
}

export function validateSession(id: string): boolean {
  const s = sessions.get(id)
  if (!s) return false
  if (Date.now() - s.lastActivityAt > SESSION_TTL_MS) {
    sessions.delete(id)
    return false
  }
  s.lastActivityAt = Date.now()
  return true
}

export function deleteSession(id: string): void {
  sessions.delete(id)
}

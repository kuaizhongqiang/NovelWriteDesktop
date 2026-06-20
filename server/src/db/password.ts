/**
 * 密码管理（Node.js 内置 crypto.scryptSync）
 *
 * 首次启动自动生成随机密码，console 醒目输出。
 */
import crypto from 'crypto'
import { getDb } from './index.js'

const SALT_LENGTH = 16
const KEY_LENGTH = 64

// ============ 密码哈希 ============

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex')
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const derived = crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex')
  return derived === hash
}

// ============ 数据库操作 ============

export function getStoredHash(): string | null {
  const db = getDb()
  const stmt = db.prepare('SELECT password_hash FROM admin_password WHERE id = 1')
  stmt.bind([])
  if (stmt.step()) {
    const row = stmt.getAsObject() as { password_hash: string }
    stmt.free()
    return row.password_hash
  }
  stmt.free()
  return null
}

export function savePasswordHash(hash: string): void {
  const db = getDb()
  const now = new Date().toISOString()
  const existing = getStoredHash()
  if (existing) {
    db.run('UPDATE admin_password SET password_hash = ?, updated = ? WHERE id = 1', [hash, now])
  } else {
    db.run('INSERT INTO admin_password (id, password_hash, created, updated) VALUES (1, ?, ?, ?)', [hash, now, now])
  }
}

export function changePassword(oldPassword: string, newPassword: string): boolean {
  const stored = getStoredHash()
  if (!stored) return false
  if (!verifyPassword(oldPassword, stored)) return false
  savePasswordHash(hashPassword(newPassword))
  return true
}

// ============ 首次启动 ============

export function generateRandomPassword(): string {
  // 格式: xxxx-xxxx-xxxx (可读性强)
  const part1 = crypto.randomBytes(3).toString('hex')
  const part2 = crypto.randomBytes(3).toString('hex')
  const part3 = crypto.randomBytes(3).toString('hex')
  return `${part1}-${part2}-${part3}`
}

export function ensurePasswordInitialized(): string | null {
  if (getStoredHash()) return null
  const password = generateRandomPassword()
  const hash = hashPassword(password)
  savePasswordHash(hash)
  return password
}

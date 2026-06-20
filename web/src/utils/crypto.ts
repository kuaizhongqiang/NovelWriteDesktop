/**
 * Web Crypto API AES-GCM 加密工具
 * 用于 localStorage 用户创作数据加密
 *
 * 密钥派生: PBKDF2 → AES-GCM-256
 * 密钥缓存: sessionStorage（仅当前会话）
 * 加密粒度: 全量 AllData JSON 序列化后加密
 */

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const PBKDF2_ITERATIONS = 600_000
const SALT_LENGTH = 16
const IV_LENGTH = 12

// 模块级密钥缓存（不清除到磁盘）
let cachedKey: CryptoKey | null = null

const SESSION_KEY = 'novelwrite-crypto-pass'

// ============ 公开 API ============

/** 是否有加密密钥（已解锁） */
export function isUnlocked(): boolean {
  return cachedKey !== null
}

/** 检查 sessionStorage 中是否有缓存的密码（无需再次输入） */
export function hasSessionPassphrase(): boolean {
  return !!sessionStorage.getItem(SESSION_KEY)
}

/** 使用密码解锁（从 sessionStorage 恢复或新密码） */
export async function unlock(passphrase: string): Promise<void> {
  const salt = new Uint8Array(SALT_LENGTH)
  crypto.getRandomValues(salt)
  cachedKey = await deriveKey(passphrase, salt)

  // 缓存到 sessionStorage
  const packed = packKeyMaterial(passphrase, salt)
  sessionStorage.setItem(SESSION_KEY, packed)
}

/** 尝试从 sessionStorage 恢复密钥 */
export async function tryRestoreFromSession(): Promise<boolean> {
  const packed = sessionStorage.getItem(SESSION_KEY)
  if (!packed) return false

  try {
    const { passphrase, salt } = unpackKeyMaterial(packed)
    cachedKey = await deriveKey(passphrase, salt)
    return true
  } catch {
    sessionStorage.removeItem(SESSION_KEY)
    return false
  }
}

/** 锁定（清除密钥缓存） */
export function lock(): void {
  cachedKey = null
  sessionStorage.removeItem(SESSION_KEY)
}

/** 加密 JSON 字符串 → base64 编码密文 */
export async function encryptJson(plaintext: string): Promise<string> {
  const key = requireKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH)).slice()
  const encoded = new TextEncoder().encode(plaintext).slice()

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded,
  )

  return packCiphertext(iv, new Uint8Array(ciphertext))
}

/** 解密 base64 编码密文 → JSON 字符串 */
export async function decryptJson(packed: string): Promise<string> {
  const key = requireKey()
  const { iv, ciphertext } = unpackCiphertext(packed)

  const decoded = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: iv.slice() },
    key,
    ciphertext.slice(),
  )

  return new TextDecoder().decode(decoded)
}

// ============ 内部实现 ============

/** PBKDF2 派生 AES-GCM 密钥 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase).slice(),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.slice(),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  )
}

function requireKey(): CryptoKey {
  if (!cachedKey) throw new Error('Encryption key not available. Call unlock() first.')
  return cachedKey
}

// ============ 序列化格式 ============

const PACK_DELIMITER = ':'

/** 将密码材料打包为单字符串（存入 sessionStorage） */
function packKeyMaterial(passphrase: string, salt: Uint8Array): string {
  return `1${PACK_DELIMITER}${toHex(salt)}${PACK_DELIMITER}${btoa(passphrase)}`
}

function unpackKeyMaterial(packed: string): { passphrase: string; salt: Uint8Array } {
  const parts = packed.split(PACK_DELIMITER)
  if (parts.length !== 3) throw new Error('Invalid key material format')
  return {
    salt: fromHex(parts[1]),
    passphrase: atob(parts[2]),
  }
}

/** 将密文打包为可存储字符串 */
function packCiphertext(iv: Uint8Array, ciphertext: Uint8Array): string {
  return `1${PACK_DELIMITER}${toHex(iv)}${PACK_DELIMITER}${toBase64(ciphertext)}`
}

function unpackCiphertext(packed: string): { iv: Uint8Array; ciphertext: Uint8Array } {
  const parts = packed.split(PACK_DELIMITER)
  if (parts.length !== 3) throw new Error('Invalid ciphertext format')
  return {
    iv: fromHex(parts[1]),
    ciphertext: fromBase64(parts[2]),
  }
}

// ============ 底层编码工具 ============

function toHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

function toBase64(buf: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i])
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const buf = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i)
  return buf
}

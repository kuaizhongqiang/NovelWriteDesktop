/**
 * 加密工具测试
 *
 * 注意：Web Crypto API (crypto.subtle) 在 happy-dom 中不可用，
 * 测试 setup 提供了基础 mock 用于模块加载验证。
 * 完整的加密解密测试需要在浏览器环境中进行。
 */
import { describe, it, expect, beforeEach } from 'vitest'

beforeEach(() => {
  sessionStorage.clear()
  // 清除模块级缓存
  if (typeof globalThis !== 'undefined') {
    // 通过重新导入来重置模块状态
  }
})

describe('Crypto module', () => {
  it('should export expected API', async () => {
    const mod = await import('../utils/crypto')
    expect(mod.isUnlocked).toBeDefined()
    expect(mod.hasSessionPassphrase).toBeDefined()
    expect(mod.tryRestoreFromSession).toBeDefined()
    expect(mod.unlock).toBeDefined()
    expect(mod.lock).toBeDefined()
    expect(mod.encryptJson).toBeDefined()
    expect(mod.decryptJson).toBeDefined()
  })

  it('should start locked', async () => {
    const { isUnlocked } = await import('../utils/crypto')
    expect(isUnlocked()).toBe(false)
  })

  it('should have no session passphrase initially', async () => {
    const { hasSessionPassphrase } = await import('../utils/crypto')
    expect(hasSessionPassphrase()).toBe(false)
  })

  it('should set session passphrase on unlock', async () => {
    const { unlock, hasSessionPassphrase, isUnlocked } = await import('../utils/crypto')
    await unlock('test-passphrase')
    expect(isUnlocked()).toBe(true)
    expect(hasSessionPassphrase()).toBe(true)
  })

  it('should clear session on lock', async () => {
    const { unlock, lock, isUnlocked, hasSessionPassphrase } = await import('../utils/crypto')
    await unlock('test-passphrase')
    expect(isUnlocked()).toBe(true)

    lock()
    expect(isUnlocked()).toBe(false)
    expect(hasSessionPassphrase()).toBe(false)
  })

  it('should fail restore when no session exists', async () => {
    const { tryRestoreFromSession } = await import('../utils/crypto')
    const result = await tryRestoreFromSession()
    expect(result).toBe(false)
  })

  it('should encrypt and decrypt as round-trip', async () => {
    const { unlock, encryptJson, decryptJson } = await import('../utils/crypto')
    await unlock('test-passphrase')

    const original = JSON.stringify({ hello: 'world' })
    const encrypted = await encryptJson(original)
    expect(encrypted).toBeTruthy()
    expect(typeof encrypted).toBe('string')

    const decrypted = await decryptJson(encrypted)
    expect(decrypted).toBe(original)
  })
})

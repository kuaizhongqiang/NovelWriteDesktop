/**
 * Vitest 全局测试 setup
 * 为 happy-dom 环境补充 Web Crypto API (crypto.subtle)
 */

// happy-dom 不提供 Web Crypto API 中的 subtle
if (typeof crypto !== 'undefined' && !crypto.subtle) {
  Object.defineProperty(crypto, 'subtle', {
    value: {
      async encrypt(_algorithm: unknown, _key: unknown, data: BufferSource) {
        return data as ArrayBuffer
      },
      async decrypt(_algorithm: unknown, _key: unknown, data: BufferSource) {
        return data as ArrayBuffer
      },
      async importKey(
        _format: string,
        _keyData: BufferSource,
        _algorithm: unknown,
        _extractable: boolean,
        _keyUsages: string[],
      ): Promise<CryptoKey> {
        return { type: 'secret', extractable: false, algorithm: { name: 'PBKDF2' }, usages: ['deriveKey'] } as CryptoKey
      },
      async deriveKey(
        _algorithm: unknown,
        _baseKey: CryptoKey,
        derivedKeyType: unknown,
        _extractable: boolean,
        _keyUsages: string[],
      ): Promise<CryptoKey> {
        return { type: 'secret', extractable: false, algorithm: derivedKeyType as Algorithm, usages: ['encrypt', 'decrypt'] } as CryptoKey
      },
    },
    writable: true,
    configurable: true,
  })
}

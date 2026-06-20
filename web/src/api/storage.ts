/**
 * 数据存储抽象层
 * 统一 localStorage（离线模式）与 HTTP API（在线模式）的接口
 *
 * 当前实现: LocalStorageAdapter（纯前端模式）
 * 未来可扩展: HttpApiAdapter（服务端存储）
 */
import type { AllData } from '@/types'
import { loadFromStorage, saveToStorage } from '@/types'
import { reportWarning } from '@/utils/errorReporter'

// localStorage 典型容量上限（各浏览器不同）
const STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 // 5MB 保守估计

// 警告阈值：达到 80% 容量时报警
const WARN_THRESHOLD = 0.8

// ============ 抽象接口 ============

export interface DataAdapter {
  /** 加载全部数据（应用启动时调用） */
  loadAllData(): Promise<AllData | null>
  /** 保存全部数据（变更时调用） */
  saveAllData(data: AllData): Promise<void>
  /** 当前是否可用 */
  isAvailable(): boolean
  /** 获取存储说明（用于调试/监控） */
  getInfo(): string
  /** 获取存储用量信息 */
  getUsage(): StorageUsage
}

export interface StorageUsage {
  /** 已用字节数 */
  usedBytes: number
  /** 预估容量上限字节数 */
  quotaBytes: number
  /** 使用百分比 (0-1) */
  ratio: number
  /** 可读字符串 */
  formatted: string
}

// ============ LocalStorage 实现 ============

export const localStorageAdapter: DataAdapter = {
  async loadAllData() {
    return loadFromStorage()
  },

  async saveAllData(data: AllData) {
    await saveToStorage(data)
    // 保存后检查容量
    checkCapacity()
  },

  isAvailable() {
    try {
      const testKey = '__novelwrite_test__'
      localStorage.setItem(testKey, '1')
      localStorage.removeItem(testKey)
      return true
    } catch {
      return false
    }
  },

  getInfo() {
    const usage = calculateUsage()
    return `localStorage (${usage.formatted})`
  },

  getUsage() {
    return calculateUsage()
  },
}

// ============ HTTP API 实现（预留） ============

// TODO: 后续实现 HttpApiAdapter
// export const httpApiAdapter: DataAdapter = { ... }

// ============ 当前活跃适配器 ============

let activeAdapter: DataAdapter = localStorageAdapter

export function getAdapter(): DataAdapter {
  return activeAdapter
}

export function setAdapter(adapter: DataAdapter): void {
  activeAdapter = adapter
}

// ============ 容量监控 ============

/** 计算当前 localStorage 用量 */
function calculateUsage(): StorageUsage {
  let usedBytes = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const val = localStorage.getItem(key)
        usedBytes += (key.length + (val?.length ?? 0)) * 2 // UTF-16
      }
    }
  } catch { /* ignore */ }

  const ratio = STORAGE_QUOTA_BYTES > 0 ? Math.min(1, usedBytes / STORAGE_QUOTA_BYTES) : 0

  return {
    usedBytes,
    quotaBytes: STORAGE_QUOTA_BYTES,
    ratio,
    formatted: `${formatBytes(usedBytes)} / ${formatBytes(STORAGE_QUOTA_BYTES)} (${(ratio * 100).toFixed(0)}%)`,
  }
}

/** 检查容量并在接近上限时报警 */
let lastWarnTime = 0
const WARN_COOLDOWN_MS = 60_000 // 每分钟最多报警一次

function checkCapacity() {
  const usage = calculateUsage()
  if (usage.ratio >= WARN_THRESHOLD) {
    const now = Date.now()
    if (now - lastWarnTime > WARN_COOLDOWN_MS) {
      lastWarnTime = now
      reportWarning(
        '存储空间不足',
        `已使用 ${usage.formatted}，请考虑清理旧数据或启用服务端存储。`,
      )
    }
  }
}

// ============ 工具函数 ============

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

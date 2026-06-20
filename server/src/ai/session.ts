/**
 * AI Session 管理
 *
 * Append-Only 策略：消息只追加不重排不裁剪，保持 KV Cache prefix 一致。
 * 超时清理：24h 无活动自动过期。
 */
import type { Session, ChatMessage, SessionStats } from './types.js'
import { createId } from '../types/index.js'

// ============ 会话存储 ============

const sessions = new Map<string, Session>()

const SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24h
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000  // 每 10min 清理过期
const MAX_MESSAGES_PER_SESSION = 200      // 单会话消息上限（防止内存泄漏）

// 启动定期清理
let cleanupTimer: ReturnType<typeof setInterval> | null = null

function startCleanup() {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [id, session] of sessions) {
      if (now - session.lastActivityAt > SESSION_TTL_MS) {
        session.status = 'expired'
        sessions.delete(id)
      }
    }
  }, CLEANUP_INTERVAL_MS)
}

// ============ 公开 API ============

export function createSession(novelId: string): Session {
  startCleanup()
  const session: Session = {
    id: createId(),
    status: 'active',
    novelId,
    messages: [],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    abortController: null,
    stats: {
      roundCount: 0,
      totalTokens: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalReasoningTokens: 0,
      promptCacheHitTokens: 0,
      promptCacheMissTokens: 0,
    },
  }
  sessions.set(session.id, session)
  return session
}

export function getSession(id: string): Session | undefined {
  const session = sessions.get(id)
  if (session) {
    session.lastActivityAt = Date.now()
  }
  return session
}

export function deleteSession(id: string): void {
  const session = sessions.get(id)
  if (session?.abortController) {
    session.abortController.abort()
  }
  sessions.delete(id)
}

export function setSessionAbortController(id: string, controller: AbortController | null): void {
  const session = sessions.get(id)
  if (session) {
    session.abortController = controller
  }
}

export function addMessage(id: string, message: ChatMessage): void {
  const session = sessions.get(id)
  if (session) {
    session.messages.push(message)
    // 防内存泄漏：超限时移除最早的 system 之外的消息
    if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
      const toRemove = session.messages.length - MAX_MESSAGES_PER_SESSION
      // 保留第一条（通常是 system prompt），移除后续多余消息
      const keepSystem = session.messages[0].role === 'system'
      const removeStart = keepSystem ? 1 : 0
      session.messages.splice(removeStart, toRemove)
    }
    session.lastActivityAt = Date.now()
  }
}

export function updateStats(id: string, delta: Partial<SessionStats>): void {
  const session = sessions.get(id)
  if (session) {
    const s = session.stats
    if (delta.totalTokens) s.totalTokens += delta.totalTokens
    if (delta.totalPromptTokens) s.totalPromptTokens += delta.totalPromptTokens
    if (delta.totalCompletionTokens) s.totalCompletionTokens += delta.totalCompletionTokens
    if (delta.totalReasoningTokens) s.totalReasoningTokens += delta.totalReasoningTokens
    if (delta.promptCacheHitTokens) s.promptCacheHitTokens += delta.promptCacheHitTokens
    if (delta.promptCacheMissTokens) s.promptCacheMissTokens += delta.promptCacheMissTokens
    s.roundCount++
  }
}

export function getAllSessions(): Session[] {
  return Array.from(sessions.values())
}

export function createSystemPrompt(novelId?: string): string {
  return `你是 NovelWrite 的 AI 写作助手，帮助用户创作中文小说。

当前${novelId ? '正在操作小说 ID: ' + novelId : '未选择特定小说'}。

## 能力
1. 回答写作相关问题（情节建议、角色发展、世界构建等）
2. 执行小说数据操作（通过 tool calling 修改大纲、角色、章节等）
3. 分析当前写作数据并提供改进建议

## Tool 操作规范
- 修改前先用 get_* 工具读取当前数据
- 使用 patch_chapter_content 进行局部修改，非全量重写
- 删除操作需用户二次确认
- 数组操作使用 id 定位元素，不使用数组索引
- 修改后通知用户变更内容

## 回复风格
- 中文回复
- 推理过程在 reasoning 中展示（用户可见）
- 最终回答简洁有用`
}

/**
 * 获取会话统计（用于前端展示）
 */
export function getSessionStats(session: Session) {
  const s = session.stats
  const cacheHitRatio = (s.totalPromptTokens > 0 && s.promptCacheHitTokens > 0)
    ? (s.promptCacheHitTokens / (s.promptCacheHitTokens + s.promptCacheMissTokens)).toFixed(2)
    : '0.00'
  const contextTokens = estimateContextTokens(session.messages)

  return {
    totalTokens: s.totalTokens,
    cacheHitTokens: s.promptCacheHitTokens,
    cacheMissTokens: s.promptCacheMissTokens,
    cacheHitRatio: parseFloat(cacheHitRatio),
    reasoningTokens: s.totalReasoningTokens,
    contextTokens,
    roundCount: s.roundCount,
  }
}

function estimateContextMessages(messages: ChatMessage[]): number {
  // 粗略估算：每消息 ~200 token
  return messages.reduce((sum, m) => sum + 200 + (m.content?.length ?? 0) / 2, 0)
}

function estimateContextTokens(messages: ChatMessage[]): number {
  return Math.round(estimateContextMessages(messages))
}

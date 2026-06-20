/**
 * AI Agent 前端 API 客户端
 *
 * 管理 SSE 连接、会话状态、流式渲染。
 * 认证由 Cookie Session 自动管理。
 */
import { API_BASE } from './index'

// ============ 类型 ============

export interface ChatContext {
  page?: string
  novelId?: string
  currentChapterId?: string
}

export interface SSEEvent {
  type: 'reasoning' | 'tool_call' | 'mutation' | 'content' | 'error' | 'done'
  [key: string]: unknown
}

export type SSEHandler = (event: SSEEvent) => void

export interface SessionStats {
  totalTokens: number
  cacheHitTokens: number
  cacheMissTokens: number
  cacheHitRatio: number
  reasoningTokens: number
  contextTokens: number
  roundCount: number
}

// ============ SSE 客户端 ============

export class AIClient {
  private abortController: AbortController | null = null
  private sessionId: string | null = null
  private onEvent: SSEHandler

  constructor(onEvent: SSEHandler) {
    this.onEvent = onEvent
  }

  getSessionId(): string | null {
    return this.sessionId
  }

  /** 开始新会话 */
  newSession(): string {
    this.sessionId = crypto.randomUUID()
    return this.sessionId
  }

  /** 发送消息 */
  async send(message: string, context: ChatContext): Promise<void> {
    if (!this.sessionId) {
      this.newSession()
    }

    this.abortController = new AbortController()

    try {
      const response = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          sessionId: this.sessionId,
          context,
        }),
        credentials: 'include',
        signal: this.abortController.signal,
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Request failed' }))
        this.onEvent({ type: 'error', error: body.error || `HTTP ${response.status}` })
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        this.onEvent({ type: 'error', error: 'Response stream unavailable' })
        return
      }

      await this.readStream(reader)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      this.onEvent({ type: 'error', error: (err as Error).message })
    }
  }

  /** 取消当前请求 */
  cancel(): void {
    this.abortController?.abort()
    this.abortController = null
  }

  /** 清理会话（服务端） */
  async clearSession(): Promise<void> {
    if (!this.sessionId) return
    this.cancel()
    try {
      await fetch(`${API_BASE}/ai/session/${this.sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
    } catch { /* ignore */ }
    this.sessionId = null
  }

  /** 获取会话统计 */
  async getStats(): Promise<SessionStats | null> {
    if (!this.sessionId) return null
    try {
      const res = await fetch(`${API_BASE}/ai/session/${this.sessionId}/stats`, { credentials: 'include' })
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  }

  private async readStream(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (!data) continue

          try {
            const event = JSON.parse(data) as SSEEvent
            this.onEvent(event)
          } catch { /* skip malformed */ }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}

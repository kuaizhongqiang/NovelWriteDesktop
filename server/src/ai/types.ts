/**
 * AI Agent 共享类型定义
 */

// ============ Session 相关 ============

export type SessionStatus = 'active' | 'cancelling' | 'idle' | 'expired'

export interface Session {
  id: string
  status: SessionStatus
  novelId: string
  messages: ChatMessage[]
  createdAt: number
  lastActivityAt: number
  abortController: AbortController | null
  stats: SessionStats
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
  reasoning_content?: string
}

export interface SessionStats {
  roundCount: number
  totalTokens: number
  totalPromptTokens: number
  totalCompletionTokens: number
  totalReasoningTokens: number
  promptCacheHitTokens: number
  promptCacheMissTokens: number
}

// ============ Tool Calling ============

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required: string[]
  }
}

// ============ SSE 事件 ============

export type SSEEventType = 'reasoning' | 'tool_call' | 'mutation' | 'content' | 'error' | 'done'

export interface SSEEvent {
  type: SSEEventType
  [key: string]: unknown
}

// ============ 上下文 ============

export interface ChatContext {
  page?: string           // write | settings | roles | outline | style | read
  novelId?: string
  currentChapterId?: string
}

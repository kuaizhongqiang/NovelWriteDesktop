/**
 * DeepSeek API 集成
 *
 * OpenAI 兼容格式，支持 streaming + thinking mode + tool calling。
 * KV Cache 命中优化：system prompt 固定，messages 只追加不重排。
 */
import type { ChatMessage, ToolCall, ToolDefinition } from './types.js'
import { getAllToolDefinitions } from './tools.js'

const API_BASE = process.env.DEEPSEEK_ENDPOINT || 'https://api.deepseek.com/v1/chat/completions'
const API_KEY = process.env.DEEPSEEK_API_KEY || ''
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'

// ============ 请求 ============

interface DeepSeekRequest {
  model: string
  messages: ChatMessage[]
  tools?: ToolDefinition[]
  stream: boolean
  thinking?: { type: 'enabled' | 'disabled' }
  reasoning_effort?: 'low' | 'high' | 'max'
}

// ============ 流式响应 ============

interface StreamChunk {
  content?: string
  reasoning_content?: string
  tool_calls?: ToolCall[]
  finish_reason?: string | null
}

interface UsageInfo {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  prompt_cache_hit_tokens?: number
  prompt_cache_miss_tokens?: number
  reasoning_tokens?: number
}

// ============ Callback 类型 ============

export interface StreamCallbacks {
  onReasoning: (text: string) => void
  onToolCall: (toolCall: ToolCall) => void
  onContent: (text: string) => void
  onUsage: (usage: UsageInfo) => void
  onError: (error: Error) => void
  onDone: () => void
}

// ============ Tool 定义（固定，确保 cache 命中） ============

let cachedToolDefinitions: ToolDefinition[] | null = null

function getTools(): ToolDefinition[] {
  if (!cachedToolDefinitions) {
    cachedToolDefinitions = getAllToolDefinitions()
  }
  return cachedToolDefinitions
}

// ============ 主调用函数 ============

export async function chat(
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  abortSignal?: AbortSignal,
): Promise<void> {
  if (!API_KEY) {
    callbacks.onError(new Error('DEEPSEEK_API_KEY 未配置'))
    return
  }

  const body: DeepSeekRequest = {
    model: MODEL,
    messages,
    tools: getTools(),
    stream: true,
    reasoning_effort: 'high',
  }

  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: abortSignal,
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      if (response.status === 401 || response.status === 402) {
        callbacks.onError(new Error('API 认证失败或余额不足'))
      } else {
        callbacks.onError(new Error(`API 错误 (${response.status}): ${errBody.slice(0, 200)}`))
      }
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      callbacks.onError(new Error('响应流不可读'))
      return
    }

    await parseSSEStream(reader, callbacks, abortSignal)
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      callbacks.onDone()
      return
    }
    callbacks.onError(err instanceof Error ? err : new Error(String(err)))
  }
}

// ============ SSE 流解析 ============

async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: StreamCallbacks,
  abortSignal?: AbortSignal,
): Promise<void> {
  const decoder = new TextDecoder()
  let buffer = ''
  let currentToolCalls: Map<number, ToolCall> = new Map()

  try {
    while (true) {
      if (abortSignal?.aborted) break

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // 最后不完整行留到下次

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()

        if (data === '[DONE]') {
          callbacks.onDone()
          return
        }

        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta
          const finish = parsed.choices?.[0]?.finish_reason
          const usage = parsed.usage

          if (usage) {
            callbacks.onUsage(usage)
          }

          if (!delta) continue

          // reasoning_content
          if (delta.reasoning_content) {
            callbacks.onReasoning(delta.reasoning_content)
          }

          // content
          if (delta.content) {
            callbacks.onContent(delta.content)
          }

          // tool_calls
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0
              if (!currentToolCalls.has(idx)) {
                currentToolCalls.set(idx, {
                  id: tc.id || '',
                  type: 'function',
                  function: { name: tc.function?.name || '', arguments: tc.function?.arguments || '' },
                })
              } else {
                const existing = currentToolCalls.get(idx)!
                if (tc.function?.name) existing.function.name += tc.function.name
                if (tc.function?.arguments) existing.function.arguments += tc.function.arguments
              }
            }
          }

          // 完成时发出累积的 tool_calls
          if (finish === 'tool_calls') {
            for (const tc of currentToolCalls.values()) {
              if (tc.id && tc.function.name) {
                callbacks.onToolCall(tc)
              }
            }
            currentToolCalls.clear()
          }
        } catch {
          // 跳过无法解析的行
        }
      }
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      throw err
    }
  } finally {
    reader.releaseLock()
  }
}

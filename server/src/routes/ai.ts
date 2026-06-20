/**
 * AI Agent 路由
 *
 * POST   /api/ai/chat           — SSE 流式聊天
 * DELETE /api/ai/session/:id    — 停止/删除会话
 * GET    /api/ai/session/:id/stats — 会话统计
 */
import { Router, type Request, type Response } from 'express'
import { createSession, getSession, deleteSession, addMessage, updateStats, getSessionStats, createSystemPrompt, setSessionAbortController } from '../ai/session.js'
import { chat } from '../ai/deepseek.js'
import { executeToolCall } from '../ai/tools.js'
import type { ChatMessage, ToolCall } from '../ai/types.js'

const router = Router()

// Session 限流：最多 100 个并发 AI 会话
const MAX_SESSIONS = 100
let activeSessions = 0

// ============ POST /api/ai/chat — SSE 流式聊天 ============

router.post('/chat', (req: Request, res: Response) => {
  const { message, sessionId, context } = req.body

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'message is required' })
    return
  }

  // 获取或创建 Session
  let session = sessionId ? getSession(sessionId) : undefined
  const isNew = !session
  const novelId = context?.novelId || ''

  if (isNew) {
    if (activeSessions >= MAX_SESSIONS) {
      res.status(429).json({ error: 'Too many active sessions' })
      return
    }
    session = createSession(novelId)
    activeSessions++

    // 添加 system prompt（确保每次完全一致，维持 cache prefix）
    addMessage(session.id, { role: 'system', content: createSystemPrompt(novelId || undefined) })
  }

  if (!session) {
    res.status(500).json({ error: 'Failed to create session' })
    return
  }

  // 添加用户消息
  addMessage(session.id, { role: 'user', content: message })

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  // AbortController 用于取消
  const abortController = new AbortController()
  setSessionAbortController(session.id, abortController)

  // 客户端断开时取消
  req.on('close', () => {
    abortController.abort()
    if (session) {
      setSessionAbortController(session.id, null)
      session.status = 'idle'
    }
  })

  // 收集本次 tool 调用结果
  let roundToolCalls: ToolCall[] = []

  // 启动递归对话
  chatLoop(session.id, abortController.signal)

  async function chatLoop(sessionId: string, signal: AbortSignal): Promise<void> {
    const sess = getSession(sessionId)
    if (!sess) {
      sendSSE(res, { type: 'error', error: 'Session not found' })
      res.end()
      return
    }

    await chat(sess.messages, {
      onReasoning: (text) => {
        sendSSE(res, { type: 'reasoning', content: text })
      },
      onToolCall: (toolCall) => {
        roundToolCalls.push(toolCall)
        sendSSE(res, {
          type: 'tool_call',
          name: toolCall.function.name,
          args: toolCall.function.arguments,
        })
      },
      onContent: (text) => {
        sendSSE(res, { type: 'content', text })
      },
      onUsage: (usage) => {
        updateStats(sessionId, {
          totalTokens: usage.total_tokens,
          totalPromptTokens: usage.prompt_tokens,
          totalCompletionTokens: usage.completion_tokens,
          totalReasoningTokens: usage.reasoning_tokens,
          promptCacheHitTokens: usage.prompt_cache_hit_tokens,
          promptCacheMissTokens: usage.prompt_cache_miss_tokens,
        })
      },
      onError: (err) => {
        sendSSE(res, { type: 'error', error: err.message })
        res.end()
      },
      onDone: async () => {
        // 如果有 tool_calls 需要执行
        if (roundToolCalls.length > 0) {
          const results = []
          for (const tc of roundToolCalls) {
            try {
              const result = await executeToolCall(tc)
              results.push({ tool_call_id: tc.id, result })
              sendSSE(res, {
                type: 'mutation',
                tool: tc.function.name,
                status: 'success',
              })
            } catch (err) {
              results.push({ tool_call_id: tc.id, error: (err as Error).message })
              sendSSE(res, {
                type: 'mutation',
                tool: tc.function.name,
                status: 'error',
                error: (err as Error).message,
              })
            }
          }

          // 将 tool_calls 和 results 加入消息历史
          const assistantMsg: ChatMessage = {
            role: 'assistant',
            content: '',
            tool_calls: roundToolCalls,
          }
          addMessage(sessionId, assistantMsg)

          for (const r of results) {
            addMessage(sessionId, {
              role: 'tool',
              content: JSON.stringify(r.result ?? { error: r.error }),
              tool_call_id: r.tool_call_id,
            })
          }

          // 清空本轮，进入下一轮递归
          roundToolCalls = []
          await chatLoop(sessionId, signal)
          return
        }

        // 无 tool_call，对话结束
        // 保存 assistant response 到消息历史（content 已经在 onContent 中流式发送完毕）
        addMessage(sessionId, { role: 'assistant', content: '' })

        const stats = getSessionStats(sess)
        sendSSE(res, { type: 'done', usage: stats })
        res.end()
      },
    }, signal)
  }
})

// ============ DELETE /api/ai/session/:id ============

router.delete('/session/:id', (req: Request, res: Response) => {
  const id = req.params.id as string
  const session = getSession(id)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }
  deleteSession(id)
  activeSessions = Math.max(0, activeSessions - 1)
  res.json({ ok: true })
})

// ============ GET /api/ai/session/:id/stats ============

router.get('/session/:id/stats', (req: Request, res: Response) => {
  const id = req.params.id as string
  const session = getSession(id)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }
  res.json(getSessionStats(session))
})

// ============ 辅助 ============

function sendSSE(res: Response, data: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

export default router

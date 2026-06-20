<script setup lang="ts">
/**
 * AgentBar — AI 写作助手聊天面板
 *
 * Props/Events 协议见 docs/05-agent-bar.md
 */
import { AIClient, type SSEEvent, type SessionStats } from '@/api/ai'
import { useAllDataStore } from '@/stores/allData'

const props = defineProps<{
  collapsed: boolean
  novelId?: string | null
  currentPage?: string | null
}>()

const emit = defineEmits<{
  toggle: []
}>()

const store = useAllDataStore()
const message = useMessage()

// ============ 状态 ============

const inputText = ref('')
const messages = ref<ChatBubble[]>([])
const status = ref<'idle' | 'loading' | 'streaming'>('idle')
const stats = ref<SessionStats | null>(null)

// 当前正在接收的流式消息
const currentStreaming = ref<{
  reasoning: string
  content: string
  toolCalls: ToolCallDisplay[]
} | null>(null)

interface ToolCallDisplay {
  name: string
  args: string
  status: 'pending' | 'success' | 'error'
  error?: string
}

interface ChatBubble {
  id: string
  role: 'user' | 'agent'
  content: string
  reasoning?: string
  toolCalls?: ToolCallDisplay[]
  timestamp: Date
}

// ============ AI 客户端 ============

const client = new AIClient(handleSSEEvent)

function handleSSEEvent(event: SSEEvent) {
  switch (event.type) {
    case 'reasoning':
      if (!currentStreaming.value) startNewAgentBubble()
      currentStreaming.value!.reasoning += (event.content as string || '')
      break

    case 'tool_call':
      if (!currentStreaming.value) startNewAgentBubble()
      currentStreaming.value!.toolCalls.push({
        name: event.name as string,
        args: typeof event.args === 'string' ? event.args : JSON.stringify(event.args),
        status: 'pending',
      })
      break

    case 'mutation':
      // 更新最后一个 tool_call 的状态
      const tcs = currentStreaming.value?.toolCalls
      if (tcs && tcs.length > 0) {
        const last = tcs[tcs.length - 1]
        last.status = event.status === 'success' ? 'success' : 'error'
        if (event.error) last.error = event.error as string
      }
      // 应用 mutation 到 store
      // 当前 tool 操作由服务端直接写 DB，前端在下次读取时自动刷新
      // 但如果需要即时更新可以触发 store.reloadFromStorage()
      break

    case 'content':
      if (!currentStreaming.value) startNewAgentBubble()
      currentStreaming.value!.content += (event.text as string || '')
      break

    case 'error':
      if (currentStreaming.value) {
        finalizeAgentBubble()
      }
      messages.value.push({
        id: crypto.randomUUID(),
        role: 'agent',
        content: '',
        toolCalls: [{ name: 'error', args: '', status: 'error', error: event.error as string }],
        timestamp: new Date(),
      })
      status.value = 'idle'
      message.error(event.error as string || 'AI 响应出错')
      break

    case 'done':
      if (currentStreaming.value) {
        finalizeAgentBubble()
      }
      if (event.usage) {
        stats.value = event.usage as SessionStats
      }
      status.value = 'idle'
      break
  }
}

function startNewAgentBubble() {
  currentStreaming.value = { reasoning: '', content: '', toolCalls: [] }
  status.value = 'streaming'
}

function finalizeAgentBubble() {
  if (!currentStreaming.value) return
  const bubble: ChatBubble = {
    id: crypto.randomUUID(),
    role: 'agent',
    content: currentStreaming.value.content,
    reasoning: currentStreaming.value.reasoning || undefined,
    toolCalls: currentStreaming.value.toolCalls.length > 0 ? currentStreaming.value.toolCalls : undefined,
    timestamp: new Date(),
  }
  messages.value.push(bubble)
  currentStreaming.value = null
}

// ============ 操作 ============

async function handleSend() {
  const text = inputText.value.trim()
  if (!text || status.value !== 'idle') return

  inputText.value = ''
  messages.value.push({
    id: crypto.randomUUID(),
    role: 'user',
    content: text,
    timestamp: new Date(),
  })
  status.value = 'loading'

  await client.send(text, {
    page: props.currentPage || undefined,
    novelId: props.novelId || undefined,
  })

  // 发送完成后刷新 store 数据（确保 mutation 已落地）
  await store.reloadFromStorage()
}

function handleNewSession() {
  client.clearSession()
  messages.value = []
  stats.value = null
  currentStreaming.value = null
  status.value = 'idle'
  message.success('已创建新对话')
}

function handleCancel() {
  client.cancel()
  if (currentStreaming.value) {
    finalizeAgentBubble()
  }
  status.value = 'idle'
  message.info('已停止生成')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

// 组件卸载时清理
onUnmounted(() => {
  client.cancel()
})
</script>

<template>
  <n-layout-sider
    bordered
    :width="340"
    :collapsed-width="36"
    :collapsed="collapsed"
    show-trigger="bar"
    style="display: flex; flex-direction: column;"
    @collapse="emit('toggle')"
    @expand="emit('toggle')"
  >
    <!-- 头部 -->
    <div style="padding: 12px 16px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--nw-border);">
      <span style="font-size: 18px;">🤖</span>
      <span v-if="!collapsed" style="font-size: 14px; font-weight: 600; flex: 1;">
        AI 写作助手
      </span>
      <n-button
        v-if="!collapsed"
        size="tiny"
        quaternary
        @click="handleNewSession"
        title="新建对话"
      >
        + 新对话
      </n-button>
    </div>

    <!-- 对话区域 -->
    <div
      v-if="!collapsed"
      style="flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px;"
    >
      <!-- 空状态 -->
      <div
        v-if="messages.length === 0 && status === 'idle'"
        style="text-align: center; padding: 40px 0; color: var(--nw-text-muted); font-size: 13px;"
      >
        <p>💡 我可以帮你：</p>
        <ul style="text-align: left; margin-top: 12px; line-height: 1.8;">
          <li>修改章节标题或内容</li>
          <li>调整角色设定</li>
          <li>优化大纲结构</li>
          <li>提供写作建议</li>
        </ul>
      </div>

      <!-- 消息列表 -->
      <template v-for="msg in messages" :key="msg.id">
        <!-- 用户消息 -->
        <div v-if="msg.role === 'user'" style="display: flex; justify-content: flex-end;">
          <div style="max-width: 85%; background: var(--nw-accent-light); color: var(--nw-accent); padding: 8px 12px; border-radius: 12px 12px 4px 12px; font-size: 13px; white-space: pre-wrap; word-break: break-word;">
            {{ msg.content }}
          </div>
        </div>

        <!-- Agent 消息 -->
        <div v-else style="display: flex; flex-direction: column; gap: 4px;">
          <!-- 推理过程 -->
          <div
            v-if="msg.reasoning"
            style="background: var(--nw-bg-secondary); border-radius: 8px; padding: 8px 12px; font-size: 12px; color: var(--nw-text-muted); border-left: 3px solid var(--nw-text-light);"
          >
            <div style="font-weight: 600; margin-bottom: 4px;">🔍 推理中</div>
            <div style="white-space: pre-wrap; word-break: break-word; line-height: 1.6;">
              {{ msg.reasoning }}
            </div>
          </div>

          <!-- 工具调用 -->
          <div
            v-for="tc in msg.toolCalls"
            :key="tc.name"
            style="background: var(--nw-bg-secondary); border-radius: 8px; padding: 8px 12px; font-size: 12px; border-left: 3px solid var(--nw-accent);"
          >
            <div style="display: flex; align-items: center; gap: 4px; font-weight: 600; color: var(--nw-text);">
              🔧 {{ tc.name }}
              <n-spin v-if="tc.status === 'pending'" size="small" style="margin-left: auto;" />
              <span v-else-if="tc.status === 'success'" style="margin-left: auto; color: #52c41a;">✅</span>
              <span v-else style="margin-left: auto; color: #ff4d4f;">❌</span>
            </div>
            <div v-if="tc.args && tc.args !== '{}'" style="margin-top: 4px; color: var(--nw-text-muted); font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-word;">
              {{ tc.args.slice(0, 200) }}{{ tc.args.length > 200 ? '...' : '' }}
            </div>
            <div v-if="tc.error" style="margin-top: 4px; color: #ff4d4f;">
              {{ tc.error }}
            </div>
          </div>

          <!-- 文本回复 -->
          <div
            v-if="msg.content"
            style="background: var(--nw-card-bg); border: 1px solid var(--nw-border); border-radius: 8px; padding: 8px 12px; font-size: 13px; color: var(--nw-text); white-space: pre-wrap; word-break: break-word; line-height: 1.7;"
          >
            {{ msg.content }}
          </div>
        </div>
      </template>

      <!-- 流式加载中 -->
      <div v-if="status === 'loading'" style="display: flex; justify-content: flex-start;">
        <div style="background: var(--nw-bg-secondary); border-radius: 12px 12px 12px 4px; padding: 12px;">
          <n-spin size="small" />
        </div>
      </div>

      <!-- 流式推理中 -->
      <div
        v-if="currentStreaming && currentStreaming.reasoning"
        style="background: var(--nw-bg-secondary); border-radius: 8px; padding: 8px 12px; font-size: 12px; color: var(--nw-text-muted); border-left: 3px solid var(--nw-text-light);"
      >
        <div style="font-weight: 600; margin-bottom: 4px;">🔍 推理中</div>
        <div style="white-space: pre-wrap; word-break: break-word; line-height: 1.6;">
          {{ currentStreaming.reasoning }}
        </div>
      </div>

      <!-- 流式工具调用 -->
      <div
        v-for="tc in currentStreaming?.toolCalls"
        :key="tc.name + tc.status"
        style="background: var(--nw-bg-secondary); border-radius: 8px; padding: 8px 12px; font-size: 12px; border-left: 3px solid var(--nw-accent);"
      >
        <div style="display: flex; align-items: center; gap: 4px; font-weight: 600;">
          🔧 {{ tc.name }}
          <n-spin v-if="tc.status === 'pending'" size="small" style="margin-left: auto;" />
          <span v-else-if="tc.status === 'success'" style="margin-left: auto; color: #52c41a;">✅</span>
          <span v-else style="margin-left: auto; color: #ff4d4f;">❌</span>
        </div>
        <div v-if="tc.args && tc.args !== '{}'" style="margin-top: 4px; color: var(--nw-text-muted); font-family: monospace; font-size: 11px;">
          {{ tc.args.slice(0, 200) }}
        </div>
      </div>

      <!-- 流式内容 -->
      <div
        v-if="currentStreaming && currentStreaming.content"
        style="background: var(--nw-card-bg); border: 1px solid var(--nw-border); border-radius: 8px; padding: 8px 12px; font-size: 13px; color: var(--nw-text); white-space: pre-wrap; word-break: break-word; line-height: 1.7;"
      >
        {{ currentStreaming.content }}
        <n-spin v-if="status === 'streaming' && !currentStreaming.toolCalls.length" size="small" style="display: inline; margin-left: 4px;" />
      </div>
    </div>

    <!-- 底部统计 + 输入 -->
    <div v-if="!collapsed" style="border-top: 1px solid var(--nw-border);">
      <!-- 统计 -->
      <div
        v-if="stats"
        style="padding: 6px 12px; font-size: 11px; color: var(--nw-text-muted); display: flex; gap: 8px; flex-wrap: wrap; border-bottom: 1px solid var(--nw-border);"
      >
        <span>轮次 {{ stats.roundCount }}</span>
        <span>上下文 {{ (stats.contextTokens / 1000).toFixed(1) }}K tokens</span>
        <span v-if="stats.cacheHitRatio > 0">
          🗳️ 缓存 {{ (stats.cacheHitRatio * 100).toFixed(0) }}%
        </span>
      </div>

      <!-- 输入区 -->
      <div style="padding: 8px 12px; display: flex; gap: 8px;">
        <n-input
          v-model:value="inputText"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 4 }"
          placeholder="输入写作指令..."
          :disabled="status !== 'idle'"
          @keydown="handleKeydown"
        />
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <n-button
            size="small"
            type="primary"
            :loading="status === 'loading'"
            :disabled="status === 'streaming' || !inputText.trim()"
            @click="handleSend"
          >
            发送
          </n-button>
          <n-button
            v-if="status === 'loading' || status === 'streaming'"
            size="small"
            type="error"
            secondary
            @click="handleCancel"
          >
            停止
          </n-button>
        </div>
      </div>
    </div>
  </n-layout-sider>
</template>

# Agent Bar 组件协议

> 定义 Agent Bar 与页面之间的 Props/Events/Slots 接口协议。
> 对应 04-server.md 中的 AI Agent 设计，作为前端的交互层规范。

## 组件位置

`web/src/components/AgentBar.vue`（待创建，当前为占位）

## Props

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `collapsed` | `boolean` | `false` | 是否折叠 |
| `novelId` | `string \| null` | `null` | 当前小说 ID（用于 tool context） |
| `currentPage` | `string \| null` | `null` | 当前页面名（write/settings/roles/outline/style/read） |
| `currentChapterId` | `string \| null` | `null` | 编辑器中当前章节 ID（写作页专用） |

## Events

| Event | Payload | 触发时机 |
|-------|---------|---------|
| `send` | `{ message: string }` | 用户发送消息 |
| `newSession` | — | 用户点击"新建对话" |
| `cancel` | — | 用户点击"停止生成" |
| `toggle` | — | 用户展开/折叠 Agent Bar |

## 内部状态

Agent Bar 自行管理以下状态（不暴露到父组件）：

| 状态 | 类型 | 说明 |
|------|------|------|
| `sessionId` | `string \| null` | 当前会话 ID，由新建对话时生成 |
| `messages` | `Message[]` | 消息列表（见下方 Message 类型） |
| `status` | `'idle' \| 'loading' \| 'streaming' \| 'error'` | 当前连接状态 |
| `stats` | `SessionStats \| null` | 会话统计数据 |

## 数据类型

```typescript
// 消息
interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: Date
  // agent 消息特有的内部结构
  reasoning?: string           // 🔍 推理过程
  toolCalls?: ToolCall[]       // 🔧 工具调用
}

interface ToolCall {
  name: string
  args: Record<string, unknown>
  result?: unknown
  error?: string
}

// 会话统计
interface SessionStats {
  totalTokens: number
  cacheHitTokens: number
  cacheMissTokens: number
  cacheHitRatio: number
  reasoningTokens: number
  contextTokens: number
  roundCount: number
}
```

## SSE 协议映射

Agent Bar 消费服务端 `POST /api/ai/chat` 的 SSE 流，映射如下：

| SSE event | → Agent Bar 行为 |
|-----------|-----------------|
| `reasoning` | 追加到当前 agent 消息的 `reasoning` 字段，UI 实时渲染灰色气泡 |
| `tool_call` | 追加到当前 agent 消息的 `toolCalls[]`，UI 显示工具名和参数 |
| `mutation` | 通过 Pinia store action 应用数据变更（不显示在气泡中） |
| `content` | 追加到当前 agent 消息的 `content` 字段，UI 实时渲染文本 |
| `error` | 设置 `status = 'error'`，显示错误信息 |
| `done` | 设置 `status = 'idle'`，更新 `stats` |

## 数据流（Mutations）

AI Agent 通过 `mutation` SSE 事件直接修改数据，流程：

```
SSE mutation event
    → AgentBar 解析 { path, value }
    → 调用 Pinia Store Action
    → 页面组件通过 store 响应式更新
    → 自动 debounce 保存到 localStorage
```

Mutation 格式：
```json
{
  "type": "mutation",
  "path": "updateChapterContent",
  "args": {
    "novelId": "xxx",
    "chapterId": "yyy",
    "content": "新的正文内容..."
  }
}
```

所有 mutation 路径对应 `useAllDataStore` 中定义的 action 名称。

## 权限边界

Agent Bar 实现的 mutation 必须经过以下检查：

1. **读操作**（get_*）— 自动执行，无需确认
2. **写操作**（update_*）— 需用户确认（通过 Naive UI dialog）
3. **删除操作**（delete_*）— 需二次确认
4. **批量操作** — 需逐项确认

用户确认通过 `n-dialog` 弹窗实现：

```typescript
function confirmMutation(action: string): Promise<boolean> {
  return new Promise((resolve) => {
    dialog.warning({
      title: 'AI 操作确认',
      content: `AI 将执行: ${action}`,
      positiveText: '允许',
      negativeText: '拒绝',
      onPositiveClick: () => resolve(true),
      onNegativeClick: () => resolve(false),
    })
  })
}
```

## Slots（预留）

| Slot | 参数 | 说明 |
|------|------|------|
| `header` | — | 自定义头部区域 |
| `footer` | — | 自定义底部区域（默认显示 stats） |
| `message-prefix` | `{ message: Message }` | 消息前置内容 |
| `message-suffix` | `{ message: Message }` | 消息后置内容 |

## 使用示例

```vue
<template>
  <AgentBar
    :collapsed="agentCollapsed"
    :novel-id="route.params.id"
    :current-page="route.name"
    :current-chapter-id="activeChapterId"
    @toggle="agentCollapsed = !agentCollapsed"
    @new-session="handleNewSession"
  />
</template>
```

## 实现顺序

1. 基础组件结构（折叠/展开、消息列表、输入框）
2. SSE 连接与流式渲染
3. mutation 应用到 Pinia store
4. 用户确认对话框（写/删操作的权限边界）
5. 会话统计展示
6. 停止生成功能
7. 新建对话功能

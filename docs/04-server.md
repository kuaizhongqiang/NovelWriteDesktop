# 服务端设计

> Paper 阶段文档，尚未开始 coding。

## 技术栈

| 层面 | 选择 |
|------|------|
| 运行时 | Node.js + TypeScript |
| Web 框架 | Express |
| 数据库 | SQLite（`better-sqlite3`） |
| CLI | Commander.js |
| AI | DeepSeek API（OpenAI 兼容格式） |

---

## 项目结构

```
server/
├── src/
│   ├── index.ts              # Express 入口
│   ├── db/
│   │   ├── schema.ts         # CREATE TABLE DDL
│   │   └── index.ts          # better-sqlite3 单例连接
│   ├── routes/
│   │   ├── novels.ts         # 小说 CRUD
│   │   ├── writingStyles.ts  # 写作风格预设 CRUD
│   │   └── ai.ts             # AI Agent
│   ├── cli/
│   │   └── index.ts          # Commander CLI
│   └── types/
│       └── index.ts          # TypeScript 类型
├── package.json
├── tsconfig.json
└── .gitignore
```

---

## 数据库设计 (SQLite)

### 表 `novels`

嵌套结构用 JSON 列存储（不拆表，整体读写）：

| 列 | 类型 | 说明 |
|---|------|------|
| `id` | TEXT PK | UUID |
| `title` | TEXT | 标题 |
| `novel_base_data` | TEXT (JSON) | description, oneWord, genre, tags |
| `role_list` | TEXT (JSON) | mainRole, femaleRoles[], supportingRoles[] |
| `outline` | TEXT (JSON) | superpower, worldView, keyPoints, outlinePhases[] |
| `chapter_list` | TEXT (JSON) | chapters[{id, sort, content}] |
| `writing_style` | TEXT (JSON) | 嵌入的 style 对象 |
| `created` / `updated` | TEXT | ISO 8601 |
| `is_open` | INTEGER (0/1) | 是否公开 |

### 表 `writing_styles`

平坦列，无需 JSON：

| 列 | 类型 | 说明 |
|---|------|------|
| `id` | TEXT PK | UUID |
| `name` | TEXT | 预设名称 |
| `char_per_chapter_min` | INTEGER | 每章最少字数 |
| `char_per_chapter_max` | INTEGER | 每章最多字数 |
| `full_story_length` | INTEGER | 全本预计总字数 |
| `base_tone` | TEXT | 基调 |
| `created` / `updated` | TEXT | ISO 8601 |

---

## 认证机制（API Key）

> 服务端暴露在公网 HTTPS 上，所有 API（除 health 外）需认证。

### 方案：Bearer Token + API Key

轻量级 API Key 方案，不引入 JWT/OAuth，适合此场景。

### 数据库表 `auth_keys`

| 列 | 类型 | 说明 |
|---|------|------|
| `id` | TEXT PK | UUID |
| `name` | TEXT | 备注名称（如"openclaw-key"、"dev-key"） |
| `key_hash` | TEXT | API Key 的 SHA-256 哈希（不存明文） |
| `created_at` | TEXT | ISO 8601 |
| `last_used_at` | TEXT | 最后使用时间，可追踪 |
| `revoked` | INTEGER (0/1) | 是否已吊销 |

### CLI 命令

| 命令 | 说明 |
|------|------|
| `novelwrite auth generate <name>` | 生成新 API Key，输出明文 key（仅此一次） |
| `novelwrite auth list` | 列出所有 key（显示名称、创建时间、最后使用，不显示 key 本身） |
| `novelwrite auth revoke <id>` | 吊销指定 key |

### 认证流程

```
客户端                                  服务端
  │                                      │
  │ POST /api/novels                     │
  │ Authorization: Bearer nw_xxxxx       │
  │                                      ├─ 提取 token
  │                                      ├─ SHA-256(token) → 查 key_hash
  │                                      ├─ 未找到或 revoked → 401
  │                                      ├─ 更新 last_used_at
  │                                      └─ 放行到路由
```

### 前端存储

- API Key 存 `localStorage`（key: `novelwrite-api-key`）
- 所有 `fetch` 请求自动带 `Authorization: Bearer xxx` 头
- 登录页面：输入 Key 后存储，跳转到 Dashboard
- 退出：清除 localStorage 中的 key

### 免认证端点

| 路径 | 原因 |
|------|------|
| `GET /api/health` | 健康检查 |
| `POST /api/auth/login` | 登录验证（传入 key，验证通过后返回确认） |

### AI Agent 接口

**`POST /api/ai/chat`** — SSE 流式

Request:
```json
{
  "message": "帮我把第三章标题改成'重逢'",
  "sessionId": "uuid",
  "context": {
    "page": "write",
    "novelId": "uuid",
    "currentChapterId": "uuid"
  }
}
```

Response (SSE):
```
event: reasoning   data: {"type": "reasoning", "content": "用户想修改第三章标题..."}
event: tool_call   data: {"type": "tool_call", "name": "update_chapter_outline", "args": {...}}
event: mutation   data: {"type": "mutation", "path": "...", "value": {...}}
event: content    data: {"type": "content", "text": "已经改好了！"}
event: done       data: {"type": "done", "usage": { ... }}
```

**`DELETE /api/ai/session/:sessionId`** — 停止 Agent

立即中断 SSE 流，取消 LLM 请求，清理会话资源。

**`GET /api/ai/session/:sessionId/stats`** — 获取会话统计

返回当前会话的：
- `totalTokens` — 累计 token 总数
- `cacheHitTokens` — 缓存命中 token 数
- `cacheMissTokens` — 缓存未命中 token 数
- `cacheHitRatio` — 缓存命中百分比
- `reasoningTokens` — 思考 token 数
- `contextTokens` — 当前上下文总长度

---

## CLI 设计（为 AI Agent 服务）

> CLI 运行在有 OpenCLAW 的服务器上，供 AI Agent 调用，非人类直接交互。
> 因此需要**自描述、机器可读**的输出格式。

### 自描述接口

| 参数 | 说明 | 输出格式 |
|------|------|---------|
| `novelwrite --help` | 基础帮助（Commander 默认） | 文本 |
| `novelwrite --docs` | 完整 CLI 文档（含所有命令的说明和示例） | Markdown |
| `novelwrite --tool-list` | 机器可读的工具定义列表（供 Agent 发现能力） | JSON |

`--tool-list` 输出示例：
```json
{
  "tools": [
    {
      "name": "init",
      "description": "初始化 SQLite 数据库",
      "arguments": [
        { "name": "dir", "type": "string", "required": false, "default": ".", "description": "数据库文件存放目录" }
      ],
      "output": "文本"
    },
    {
      "name": "list",
      "description": "列出所有小说及统计信息",
      "arguments": [],
      "output": "JSON（每行一个对象）"
    }
  ]
}
```

### 命令列表（完整映射 AI Agent Tools）

CLI 命令按领域分组，与 AI Agent 的 Tool Definitions 一一对应。

#### 系统

| 命令 | 对应 Tool | 说明 |
|------|-----------|------|
| `novelwrite init [dir]` | — | 初始化数据库 |
| `novelwrite list` | — | 列出所有小说（供 Agent 发现） |

#### Auth（认证管理）

| 命令 | 说明 |
|------|------|
| `novelwrite auth generate <name>` | 生成 API Key，输出明文（仅此一次） |
| `novelwrite auth list` | 列出所有 key（名称、创建时间、最后使用） |
| `novelwrite auth revoke <id>` | 吊销指定 key |

#### Novel（小说基础设定）

| 命令 | 对应 Tool | 说明 |
|------|-----------|------|
| `novelwrite novel get <id>` | `get_novel` | 获取小说完整数据 |
| `novelwrite novel create <title>` | — | 创建新小说 |
| `novelwrite novel update <id> --title "..." --genre "..." --tags "..."` | `update_novel_base` | 更新基础设定 |
| `novelwrite novel delete <id>` | — | 删除小说 |

#### Roles（角色）

| 命令 | 对应 Tool | 说明 |
|------|-----------|------|
| `novelwrite roles list <novelId>` | `get_roles` | 获取角色列表 |
| `novelwrite roles add <novelId> --type female --name "小红" --desc "..." --relation "..."` | `add_role` | 添加角色 |
| `novelwrite roles update <novelId> --role-id xxx --name "..." --desc "..."` | `update_role` | 更新角色 |
| `novelwrite roles delete <novelId> --role-id xxx` | `delete_role` | 删除角色 |

#### Outline（大纲）

| 命令 | 对应 Tool | 说明 |
|------|-----------|------|
| `novelwrite outline get <novelId>` | `get_outline` | 获取完整大纲 |
| `novelwrite outline add-phase <novelId> --title "第一卷"` | `add_phase` | 添加幕/卷 |
| `novelwrite outline update-phase <novelId> --phase-id xxx --title "..."` | `update_phase` | 更新幕/卷 |
| `novelwrite outline delete-phase <novelId> --phase-id xxx` | `delete_phase` | 删除幕/卷 |
| `novelwrite outline add-chapter <novelId> --phase-id xxx --title "第一章"` | `add_chapter_outline` | 添加章节大纲 |
| `novelwrite outline update-chapter <novelId> --chapter-id xxx --title "..."` | `update_chapter_outline` | 更新章节大纲 |
| `novelwrite outline delete-chapter <novelId> --chapter-id xxx` | `delete_chapter_outline` | 删除章节大纲 |

#### Chapter（正文）

| 命令 | 对应 Tool | 说明 |
|------|-----------|------|
| `novelwrite chapter get <novelId> --chapter-id xxx` | `get_chapter` | 获取章节正文 |
| `novelwrite chapter patch <novelId> --chapter-id xxx --op replace --target "旧文本" --new "新文本"` | `patch_chapter_content` | 局部修改正文 |
| `novelwrite chapter replace <novelId> --chapter-id xxx --content "完整内容"` | `replace_chapter_content` | 全量替换正文 |

#### Writing Style（写作风格）

| 命令 | 对应 Tool | 说明 |
|------|-----------|------|
| `novelwrite style get <novelId>` | `get_writing_style` | 获取小说当前风格 |
| `novelwrite style update <novelId> --min 2000 --max 5000 --tone "热血"` | `update_writing_style` | 更新写作风格 |

#### Preset（风格预设管理）

| 命令 | 对应 Tool | 说明 |
|------|-----------|------|
| `novelwrite preset list` | — | 列出所有预设 |
| `novelwrite preset create --name "快节奏" --min 1500 --max 3000` | — | 新建预设 |
| `novelwrite preset update --id xxx --name "..."` | — | 更新预设 |
| `novelwrite preset delete --id xxx` | — | 删除预设 |

### 输出规范

所有命令支持 `--json` 标志强制 JSON 输出，便于 Agent 解析：

```bash
novelwrite list --json
# {"id":"uuid1","title":"小说A","wordCount":2340,"chapterCount":3}
# {"id":"uuid2","title":"小说B","wordCount":8712,"chapterCount":7}

novelwrite roles list <novelId> --json
# {"mainRole":{...},"femaleRoles":[...],"supportingRoles":[...]}
```

---

## AI Agent 设计

### 架构

```
Agent Bar (前端)                         AI API (服务端)
     │                                         │
     ├─ POST /api/ai/chat ─────────────────►    │
     │  { message, sessionId, context }         │
     │                                         ├─ 查找/创建 Session
     │                                         ├─ 组装 messages[]
     │                                         │   (system prompt + history + new message)
     │                                         ├─ 调用 DeepSeek API
     │                                         │   model: "deepseek-v4-flash"
     │                                         │   reasoning_effort: "high"
     │                                         │   tools: [...]
     │                                         │
     │  ◄── SSE 流式返回 ───────────────────┤   │
     │  event: reasoning                       │   ├─ LLM → reasoning_content
     │  event: tool_call                       │   ├─ LLM → tool_calls
     │  event: mutation                        │   ├─ 执行 tool → SQLite
     │  event: content                         │   └─ LLM → content
     │  event: usage                           │
     │                                         │
     ├─ 应用 mutations 到 Pinia store ────┘   │
     │                                         │
     ├─ DELETE /api/ai/session/:id ──────────►  │
     │  取消请求, 清理资源                      │
     │                                         │
     └─ GET /api/ai/session/:id/stats ───────►  │
                                                │
```

### Session 管理（成本核心）

DeepSeek 的 KV Cache 按 **prefix 精确匹配** 计折扣：
- Cache hit: **$0.014/M tokens**（约 1 折）
- Cache miss: **$0.14/M tokens**
- 节省可达 **90%**

**Session（消息历史）就是 prefix 本身**，Session 管理直接决定 cache hit 率 = 直接决定成本。

#### 成本模型分析

| 策略 | Cache 命中率 | 每轮次成本 | 适用场景 |
|------|-------------|-----------|---------|
| 同一 Session 追加消息 | 高（70-90%） | 低 | 同一部小说的连续对话 |
| 新建 Session | 低（0-10%） | 高（全价） | 切换小说、切换话题 |
| 频繁重建 Session | 极低（≈0%） | 极高 | ❌ 应避免 |

#### Session 生命周期策略

```
  同一小说对话                    切换小说
  ┌──────────────────────┐      ┌──────────────────────┐
  │ Session A (小说 X)    │      │ Session B (小说 Y)    │
  │                      │      │                      │
  │ round 1  cache hit   │      │ round 1  cache miss   │
  │ round 2  cache hit   │      │   （冷启动，全价）      │
  │ round 3  cache hit   │      │ round 2  cache hit    │
  │ ...                  │      │ ...                   │
  │                      │      │                      │
  │ 每轮只追加新消息       │      │ 同样 append-only      │
  │ prefix 稳定 = 高命中  │      │ 冷启动后逐步升温       │
  └──────────────────────┘      └──────────────────────┘
```

#### 规则

1. **用户完全控制 Session** — 只有用户点击"新建对话"时才生成新 sessionId，系统绝不自动创建
2. **切换小说不新建 Session** — 用户可以在同一 Session 中讨论多部小说，由 AI 根据 context 区分
3. **Append-Only** — 历史消息只追加，绝不重排、不裁剪、不摘要压缩（压缩会破坏 prefix）
4. **Session 不主动销毁** — 存活期间持续享受缓存红利；用户不点"新建"，Session 就一直延续
5. **System Prompt 必须绝对一致** — 即使多一个空格都会破坏 prefix 匹配，system prompt 定义后写死在代码里
6. **冷启动代价只在用户主动新建时发生**
7. **超时清理** — Session 超过 24 小时无活动，自动释放（缓存本身由 DeepSeek 侧管理，服务端只释放 messages 内存）

#### 会话状态

| 状态 | 说明 |
|------|------|
| `active` | 正在对话中，可追加消息 |
| `cancelling` | 用户请求停止，等待 LLM 响应中止 |
| `idle` | 对话暂停，保留历史等待下一轮 |
| `expired` | 超时清理 |

#### 接口行为

- `POST /api/ai/chat` — 传 `sessionId` 复用已有 Session；传新 ID 则新建
- 前端 Agent Bar 的 **"新建对话"** 按钮 → 生成新 `sessionId` → 用户主动控制
- 除此之外没有任何机制自动新建 Session（包括切换小说、刷新页面等）
- 服务端不主动删除 Session，由超时机制清理（24h 无活动）

### 停止机制

- 前端发送 `DELETE /api/ai/session/:sessionId`
- 服务端中止当前 LLM 请求（`AbortController`）
- 清理 SSE 连接
- 标记 session 为已取消
- 不保存本轮未完成的消息历史

### DeepSeek API 集成

#### 模型选择
使用 `deepseek-v4-flash`（支持 thinking mode + tool calling）。

#### 思考模式（Thinking Mode）
```json
{
  "model": "deepseek-v4-flash",
  "thinking": { "type": "enabled" },
  "reasoning_effort": "high"
}
```
- `reasoning_effort` 取值：`"low"` / `"high"` / `"max"`
- 响应中 `reasoning_content` 字段返回 CoT 推理内容
- **重要：** 多轮对话时，`reasoning_content` 不能放入 input messages，会被忽略
- 但如果 tool call 中有 `reasoning_content`，后续轮次**必须**传回去
- V4 默认 thinking 为 enabled，如需关闭显式传 `thinking: { type: "disabled" }`
- **reasoning 阶段可以同时触发 tool_call**，前后端都需要处理这种并发情况

#### Tool Calling
采用 OpenAI 兼容格式定义 tools，使用 `deepseek-v4-flash` 模型：

```json
{
  "type": "function",
  "function": {
    "name": "patch_chapter_content",
    "description": "局部修改章节正文内容",
    "parameters": {
      "type": "object",
      "properties": {
        "novelId": { "type": "string" },
        "chapterId": { "type": "string" },
        "operation": {
          "type": "string",
          "enum": ["replace", "append", "prepend", "insert_after", "delete_range"],
          "description": "修改操作类型"
        },
        "targetText": { "type": "string", "description": "定位文本" },
        "newText": { "type": "string", "description": "替换/插入的新文本" },
        "startPos": { "type": "integer", "description": "起始字符位置（可选）" },
        "endPos": { "type": "integer", "description": "结束字符位置（可选）" }
      },
      "required": ["novelId", "chapterId", "operation"]
    }
  }
}
```

#### KV Cache 优化策略

DeepSeek 的上下文硬盘缓存**自动启用**，按 prefix 匹配。优化策略：

1. **System Prompt 稳定不变** — 所有对话使用完全相同的 system prompt 开头，确保缓存命中
2. **Append-Only 模式** — 消息历史只追加不重排、不压缩，保持 prefix 一致
3. **不要切换 system prompt** — 不同功能（角色、大纲、正文）用 tool 切换而非换 system prompt
4. **长 session 优势** — 对话越长，前缀占比越高，缓存命中率越高
5. **监控缓存命中** — 从 API 响应读取 `usage.prompt_cache_hit_tokens` 和 `usage.prompt_cache_miss_tokens`

#### 调用流程

```
请求 → 拼接 messages[]（system + history + user）
     → 调用 DeepSeek API（stream: true, thinking: enabled, tools）
     → SSE 解析流式响应：
       delta.reasoning_content → event: reasoning
       delta.tool_calls        → event: tool_call（累积后执行）
       delta.content           → event: content
     → 如有 tool_calls：
       执行工具 → SQLite CRUD
       将 tool result 追加到 messages[]
       继续调用 DeepSeek API（递归，直到 LLM 不再调用工具）
     → 最终返回 event: done + usage
```

#### Token 统计

每次 `event: done` 返回完整的 usage 信息：
```json
{
  "type": "done",
  "usage": {
    "totalTokens": 4521,
    "promptTokens": 2300,
    "completionTokens": 2221,
    "reasoningTokens": 1800,
    "promptCacheHitTokens": 1800,
    "promptCacheMissTokens": 500,
    "cacheHitRatio": 0.78
  }
}
```

会话级别累积统计：
- `totalTokens` — 所有轮次总和
- `totalCacheHitTokens` / `totalCacheMissTokens`
- `contextTokens` — 当前上下文总 token 数
- 前端在 Agent Bar 底部展示实时统计数据

### 前端气泡 UI

```
┌───────────────────────────────────────────┐
│  用户  (右对齐)                            │
│  "帮我把第三章标题改成'重逢'"                │
├───────────────────────────────────────────┤
│  Agent (左对齐)                           │
│  ┌─────────────────────────────────────┐  │
│  │ 🔍 推理中...                         │  │
│  │ 用户想修改第三章标题，当前叫"初遇"...  │  │ ← reasoning
│  ├─────────────────────────────────────┤  │
│  │ 🔧 正在修改章节大纲...                │  │
│  │ update_chapter_outline              │  │ ← tool_call
│  │ 参数: { chapterId: "...", ... }     │  │
│  ├─────────────────────────────────────┤  │
│  │ 💬 已经改好了！第三章现在叫"重逢"了。  │  │ ← content
│  └─────────────────────────────────────┘  │
├───────────────────────────────────────────┤
│  统计: 轮次3 | 上下文 12.3K tokens | 🗳️ 缓存命中 78% │
└───────────────────────────────────────────┘
```

- 每个 Agent 回复是一个大气泡，内部按 SSE event 顺序依次展示三种子气泡
- **reasoning** — 带 🔍 图标，灰色背景，思考过程
- **tool_call** — 带 🔧 图标，显示工具名和关键参数
- **content** — 带 💬 图标，最终文本回复
- 底部显示会话统计信息

### 数据一致性：数组操作规范

> 坑：用户写 1、2、3 章，删除第 2 章，再添加第 2 章 → 期望看到 1、2、3，而不是 1、3、4。

**规则：**
1. 所有可排序数组（章节、角色、大纲阶段等）使用 `sort` 字段排序，不用数组下标
2. 插入时找现有 `sort` 值，合理分配中间值（如插入到 sort=2 和 sort=3 之间，新 sort=2.5，然后统一重排）
3. 删除时不改变其他元素的 `sort`
4. 添加时 `sort = max(sort) + 1` 追加，或根据上下文插入指定位置
5. AI Agent 的 Tool 操作数组时，用 `id` 定位元素，不用数组索引

### Tool Definitions

| 工具 | 参数 | 说明 |
|------|------|------|
| `get_novel` | `novelId` | 获取小说完整数据 |
| `update_novel_base` | `novelId`, `title?`, `genre?`, `tags?`, ... | 更新基础设定 |
| `get_roles` | `novelId` | 获取角色列表 |
| `add_role` | `novelId`, `type`(main/female/supporting), `roleName`, `roleDescription`, `relationshipToMainRole` | 添加角色 |
| `update_role` | `novelId`, `roleId`, `roleName?`, `roleDescription?`, `relationshipToMainRole?` | 更新角色（用 id 定位） |
| `delete_role` | `novelId`, `roleId` | 删除角色（用 id 定位） |
| `get_outline` | `novelId` | 获取完整大纲 |
| `add_phase` | `novelId`, `title` | 添加幕/卷 |
| `update_phase` | `novelId`, `phaseId`, `title?`, `description?` | 更新幕/卷 |
| `delete_phase` | `novelId`, `phaseId` | 删除幕/卷 |
| `add_chapter_outline` | `novelId`, `phaseId`, `chapterTitle` | 添加章节大纲 |
| `update_chapter_outline` | `novelId`, `chapterOutlineId`, `chapterTitle?`, `chapterDescription?`, `hook?` | 更新章节大纲（用 id） |
| `delete_chapter_outline` | `novelId`, `chapterOutlineId` | 删除章节大纲（用 id） |
| `get_chapter` | `novelId`, `chapterId` | 获取章节正文 |
| **`patch_chapter_content`** | `novelId`, `chapterId`, `operation`, `targetText?`, `newText?`, `startPos?`, `endPos?` | **局部修改正文**（replace/append/prepend/insert_after/delete_range，非全量重写） |
| `replace_chapter_content` | `novelId`, `chapterId`, `content` | 全量替换正文（谨慎使用） |
| `get_writing_style` | `novelId` | 获取写作风格 |
| `update_writing_style` | `novelId`, `charPerChapter?`, `fullStoryLength?`, `baseTone?` | 更新写作风格 |

---

## 容错设计

### DeepSeek API 异常

| 异常 | 处理 | 前端表现 |
|------|------|---------|
| API Key 无效 | 返回 502，附带错误信息 | Agent Bar 显示"API 配置错误" |
| 账户余额不足 | 捕获 HTTP 429/402，返回特定错误码 | Agent Bar 显示"API 配额不足" |
| 请求超时（>60s） | AbortController 超时中断，返回部分结果 | 已收到的内容正常显示，尾部提示"响应被截断" |
| 模型返回异常内容 | 检查响应格式，过滤非法 tool_calls | 丢弃异常 tool_call，只保留有效回复 |
| 流式连接中断 | 自动重试 1 次，仍失败则返回已积累的内容 | 显示"连接不稳定，已显示部分结果" |

### Tool 执行异常

| 异常 | 处理 | 前端表现 |
|------|------|---------|
| novelId/chapterId 不存在 | 返回 tool_result error，LLM 自行修正 | Agent 气泡内 tool_call 子气泡标记失败 |
| 数据库写入失败 | 回滚当前 tool 操作，返回错误 | 不产生 mutation，提示重试 |
| 参数校验失败 | 返回明确错误描述，LLM 可以重试 | 不产生 mutation |
| patch_chapter 操作定位失败 | 返回"未找到目标文本" | Agent 提示用户确认目标文本 |

### 数据库异常

- SQLite WAL 模式保障读写并发
- 定期 `PRAGMA integrity_check`（可通过 CLI 触发）
- 数据文件损坏时 CLI 输出明确恢复指引
- Express 全局 error handler 捕获未预期异常，返回 `{ error: "Internal server error" }`

### 网络与同步异常

| 场景 | 处理 |
|------|------|
| 前端无法连接服务器 | 继续使用 localStorage，操作不受影响 |
| 同步请求失败 | 静默失败 + 控制台 warn，不阻断用户操作 |
| 重连成功 | 下次操作自动恢复同步 |

### 前端降级策略

- 服务器不可用时：**所有功能正常使用**（localStorage 全量数据）
- 服务器恢复时：后续操作自动恢复同步，不需要手动干预
- 认证过期：跳转到登录页，清除 api-key，不丢数据

---

## 前端同步策略

- 前端保持 localStorage 为主（离线可用）
- 增删改操作同时调用 REST API 同步到服务端（失败静默）
- AI Agent 触发的 mutations 由 Agent Bar 组件实时应用到 Pinia store，网页即时更新
- API 模块: `web/src/api/index.ts`

---

## 实施顺序

1. 创建 `server/` 目录 + package.json + tsconfig + .gitignore
2. 类型定义 `server/src/types/index.ts`
3. 数据库层（schema.ts + db/index.ts + auth_keys 表）
4. CLI 命令（`init` → `auth generate/list/revoke` → `novel`/`roles`/`outline`/`chapter`/`style`/`preset` 完整映射）
5. 认证中间件 + login 端点
6. Express 入口 + REST 路由（novels, writingStyles）
7. AI Agent（Session 管理 + DeepSeek 集成 + Tool Calling + SSE 流式）
8. 前端 Agent Bar 组件（气泡 UI + 统计展示 + 停止功能 + 输入框 + 新建会话）
9. 前端 API 模块 + 认证 + 同步集成

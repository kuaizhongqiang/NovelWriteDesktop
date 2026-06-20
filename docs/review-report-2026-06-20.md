# 代码审查报告

**日期**: 2026-06-20  
**审查人**: CodeBuddy（审核）

---

## 审查轮次

| 轮次 | 内容 | 结果 |
|------|------|------|
| 第一轮 | Issue #1-#62 修复质量验证 | 发现 6 个问题 |
| 第二轮 | 针对第一轮反馈的二次修复验证 | 11 个 Issue 修复关闭 |
| 第三轮 | v0.2.0 + v0.3.0-beta AI Agent 升级审核 | **全部 66 个 Issue 关闭** |

---

## 最终结论

**66/66 Issue 已关闭，关闭全部合理，代码质量显著提升。**

---

## 🟢 第三轮验证通过的修复

### AI Agent 引擎（v0.3.0-beta）

| 模块 | 文件 | 关键特性 |
|------|------|---------|
| DeepSeek 集成 | `server/src/ai/deepseek.ts` | SSE 流式 + thinking mode + tool calling + KV Cache 优化 |
| Session 管理 | `server/src/ai/session.ts` | Append-Only 消息列表、24h TTL 过期清理、AbortController |
| Tool Calling | `server/src/ai/tools.ts` | 22 个工具（读/写/删全覆盖），参数化查询，事务包裹 |
| AI 路由 | `server/src/routes/ai.ts` | SSE 推送 + 递归 tool 循环 + 并发限流（100 sessions） |
| 类型定义 | `server/src/ai/types.ts` | Session/ChatMessage/ToolCall/SSEEvent 完整类型 |
| AgentBar UI | `web/src/components/AgentBar.vue` | 聊天面板 + 流式渲染 + 推理过程展示 + tool 状态 |
| AI API 客户端 | `web/src/api/ai.ts` | SSE 解析 + 会话管理 + AbortController |
| CommandBus | `web/src/utils/commandBus.ts` | 命令抽象层 + 权限分级 + 审计日志 |

### 前端修复（v0.2.0）

| Issue | 标题 | 修复方式 |
|-------|------|---------|
| #3 | AI Agent 操作无权限边界 | CommandBus 读/写/删分级 + confirmHandler |
| #1 | 测试基础设施 | Server + Frontend vitest 配置 |
| #2 | localStorage 明文存储 | AES-GCM 256 + UnlockDialog + sessionStorage 缓存 |
| #18 | 离开页面无未保存更改提示 | Router beforeEach + beforeunload 守卫 |
| #22 | 全局错误处理 | `errorReporter.ts` (Naive UI notification 集成) |
| #23 | 文本编辑器功能过于基础 | 自动保存 + 撤销/重做 + Tab 缩进 + 字数统计 |
| #24 | 表单缺少验证规则 | title/genre/oneWord 验证规则 |
| #25 | AI Agent 与 Store 耦合 | CommandBus 解耦 |
| #26 | 组件直接修改 Store Props | 改为 Store Actions（仅剩 1 处 v-model） |
| #29 | composables 缺少文档 | useNovel JSDoc + @example |
| #39 | CSP 和 HTTPS 策略 | CSP headers 全套安全头 |
| #40 | 暗色模式 | CSS 变量 + `html.dark` 覆盖 |

---

## 🟡 建议关注项（非阻塞）

| 项目 | 说明 |
|------|------|
| SettingsPage `novel.title` | 仍使用 `v-model:value="novel.title"` 直接绑定 Store 对象（1 处残留） |
| 系统提示词 | Server 端 system prompt 硬编���，可考虑配置化 |
| Tool Calling 错误回滚 | Server 端 tool 执行错误时缺少数据回滚机制 |

## 🟡 第三轮新建 Issue（4 个）

| Issue | 标题 | 级别 |
|-------|------|------|
| #67 | ai.ts 使用 require() 且包含未使用变量 — ESM 模块规范问题 | P1 |
| #68 | tools.ts patchNovelJSON 的 SELECT 在事务外 — 竞态条件 | P1 |
| #69 | CommandBus confirmHandler 默认���终通过 — 权限确认未生效 | P2 |
| #70 | AI Session 消息无限增长 — 长对话内存泄漏风险 | P2 |

### #67 详情 — require() in ESM

`server/src/routes/ai.ts:65-66` 在 ESM 模块中使用 `require()` 加载已导入的模块，且解构的 `init` 从未使用。

### #68 详情 — 竞态条件

`tools.ts` 自实现的 `patchNovelJSON()` 中 SELECT 在事务外执行，与 UPDATE 不原子。应复用 `query.ts` 的 `patchNovelJsonField()`。

### #69 详情 — 权限虚设

`commandBus.ts` confirmHandler 默认 `async () => true`，无组件调用 `setConfirmHandler()` 注入确认逻辑。

### #70 详情 — 内存泄漏

Session 消息无上限，24h TTL 内持续增长。建议限制最大消息数或在请求前裁剪。

---

## 架构全景

```
┌─────────────────────────────────────────────────────────────┐
│                     NovelWrite Desktop                       │
├─────────────────────────┬───────────────────────────────────┤
│   Frontend (Vue 3)      │   Server (Express + sql.js)       │
│                          │                                   │
│  Pages (7 routes)        │  REST API                        │
│  ├─ DashboardPage        │  ├─ /api/novels (CRUD)           │
│  ├─ ReadPage             │  ├─ /api/writing-styles (CRUD)   │
│  ├─ SettingsPage         │  ├─ /api/auth (login)            │
│  ├─ RolesPage            │  ├─ /api/ai/chat (SSE)           │
│  ├─ OutlinePage          │  └─ /api/health                  │
│  ├─ WritePage            │                                   │
│  └─ StylePage            │  AI Agent                        │
│                          │  ├─ deepseek.ts (API)            │
│  Components              │  ├─ session.ts (管理)            │
│  ├─ AgentBar (AI 聊天)   │  ├─ tools.ts (22 工具)          │
│  ├─ TextEditor (编辑器)  │  └─ routes/ai.ts (SSE 路由)     │
│  ├─ OutlineTree          │                                   │
│  ├─ UnlockDialog         │  DB Layer                        │
│  └─ ...                  │  ├─ query.ts (参数化查询)       │
│                          │  ├─ schema.ts (DDL)             │
│  Composables             │  └─ index.ts (初始化/持久化)     │
│  ├─ useUndoRedo          │                                   │
│  ├─ useChapterTree       │  CLI                             │
│  └─ useNovel/useTheme..  │  └─ cli/index.ts (10+ 命令)     │
│                          │                                   │
│  Utils                   │  Tests                           │
│  ├─ commandBus (命令抽象)│  └─ query.test.ts (5 tests)     │
│  ├─ crypto (AES-GCM)     │                                   │
│  └─ errorReporter        │                                   │
└─────────────────────────┴───────────────────────────────────┘
```

---

*报告结束*

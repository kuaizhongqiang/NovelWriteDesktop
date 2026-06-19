# NovelWriteDesktop 文档审查报告

> **审查人:** codebuddy  
> **审查日期:** 2026-06-19  
> **审查范围:** 全项目文档 + 核心源码  
> **审查维度:** 产品完整性 · 架构设计 · 技术可行性 · 安全与性能

---

## 目录

- [审查总览](#审查总览)
- [一、产品完整性](#一产品完整性)
- [二、架构设计](#二架构设计)
- [三、技术可行性](#三技术可行性)
- [四、安全与性能](#四安全与性能)
- [五、Issue 汇总](#五issue-汇总)
- [附录：文档-源码一致性矩阵](#附录文档-源码一致性矩阵)

---

## 审查总览

| 维度 | 评分 | 关键问题数 |
|------|------|-----------|
| 产品完整性 | B+ | P0:0  P1:4  P2:5 |
| 架构设计 | B | P0:0  P1:3  P2:4 |
| 技术可行性 | B- | P0:1  P1:3  P2:3 |
| 安全与性能 | C+ | P0:2  P1:3  P2:3 |
| **合计** | **B-** | **P0:3  P1:15  P2:22** |

> 项目整体设计质量良好，文档体系清晰，但存在部分文档与代码不一致、缺少测试基础、AI Agent 安全边界模糊等问题。

---

## 一、产品完整性

### 1.1 README 滞后于实际进度 (P1)

**问题描述:** `README.md` 中将 Pinia 和 Vue Router 标注为"待集成"，但实际代码中两者已完全集成并运行。

```text
| 状态管理   | Pinia（待集成）                   |
| 路由       | Vue Router（待集成）              |
```

**影响:** 新贡献者会误判项目成熟度，可能重复调研或做出错误的技术决策。

**建议:** 更新 README 状态描述，并补充已完成功能的勾选清单。

---

### 1.2 服务端设计文档未被索引 (P1)

**问题描述:** `docs/04-server.md`（625 行，最详细的文档）在 README 中没有链接。README 只列出了文档 00-03，而 04-server.md 包含服务端架构、AI Agent、CLI 等核心设计。

**影响:** 浏览 README 无法发现完整的项目设计范围，AI Agent 方案被隐藏。

**建议:** 在 README 文档索引中加入 `04-server.md`，并简述其内容。

---

### 1.3 缺少数据版本与迁移机制 (P1)

**问题描述:** 所有数据以单一 JSON blob 存储在 localStorage，`loadFromStorage` 只做了一层向后兼容（补充 `writingStyles` 数组）。没有版本号，没有迁移脚本，没有 Schema 验证。

**影响:** 未来修改数据模型时，用户旧数据可能损坏或无法加载。

**建议:**
- 在 `AllData` 中增加 `version: number` 字段
- 实现版本迁移函数链
- 加载时验证数据结构完整性

---

### 1.4 缺少数据导入/导出功能 (P2)

**问题描述:** 项目完全依赖 localStorage，没有提供 JSON 导出备份或从备份恢复的功能。用户清除浏览器数据会丢失所有小说。

**建议:** 在设置页面增加"导出数据"/"导入数据"按钮，支持压缩的 JSON 文件。

---

### 1.5 缺少撤销/重做机制 (P2)

**问题描述:** Pinia store 的 deep watcher 自动保存到 localStorage 后无法撤销。用户在写作过程中误操作无法恢复。

**建议:** 实现基于命令历史的撤销栈（snapshot-based 或 command-based），特别是在 WritePage 的文本编辑器中。

---

### 1.6 角色类型限定过于刚性 (P2)

**问题描述:** 角色模型硬编码为 `mainRole`（固定1个）、`femaleRoles[]`、`supportingRoles[]`。这隐含了性别二元假设，且不适合所有叙事类型（如双主角、反派视角、群像剧）。

```typescript
interface RoleList {
  mainRole: RoleData
  femaleRoles: RoleData[]
  supportingRoles: RoleData[]
}
```

**建议:** 
- 将 `femaleRoles` 重命名为中性名称（如 `primaryRoles`）
- 或改为统一的 `roles: RoleData[]` + `roleType` 枚举

---

### 1.7 写作风格预设更新不自动同步 (P2)

**问题描述:** 创建 Novel 时从预设复制 style，但后续修改预设不会自动更新已关联的小说，需要手动调用 `applyPresetToNovel`。这是设计决策，但缺少 UI 提示用户存在未同步的变更。

**建议:** 在 StylePage 中显示"最后同步时间"和"预设已更新"提示。

---

### 1.8 文本编辑器功能过于基础 (P1)

**问题描述:** `TextEditor.vue` 使用 Naive UI 的 `n-input type="textarea"` 作为写作编辑器，缺乏专业写作工具的基本能力：

- 无自动保存（需手动点击"保存"按钮）
- 无字符计数实时显示（仅在底部 Tag 中显示总字数）
- 无缩进/Tab 支持
- 无查找/替换
- 无章节内导航
- 无章节大纲预览（需切换到左侧树）

**源码位置:** `web/src/components/TextEditor.vue:29`
```vue
<n-input v-model:value="content" type="textarea" :autosize="{ minRows: 25 }" placeholder="开始写作..." />
```

**建议:** 评估是否需要引入轻量级纯文本编辑器库（如 CodeMirror 6 的纯文本模式），或至少为 TextEditor 增加自动保存（debounce 2s）、实时字数统计、Tab 缩进支持。

---

### 1.9 缺少表单验证 (P1)

**问题描述:** 所有页面的表单均无验证规则（必填检查、长度限制、格式校验）。用户可保存空标题、空角色名、空章节名等。

**建议:** 使用 Naive UI 的 `n-form` + `rules` 属性定义验证规则，至少对标题、名称等关键字段做必填和长度限制。

---

### 1.10 离开页面无"未保存更改"提示 (P2)

**问题描述:** 所有页面的 `handleCancel()` 直接调用 `router.push('/')` 返回 Dashboard，无任何确认。用户在写作或编辑中误点导航栏按钮会丢失未保存的内容。

**源码位置:** 所有 7 个 Page 组件均有此问题（如 `SettingsPage.vue:26`）
```typescript
function handleCancel() { router.push('/') }
```

**建议:** 使用 `router.beforeEach` 全局守卫 + 页面级别的 dirty flag，或 `window.onbeforeunload` 事件。

---

### 1.11 NovelCard 标签截断不透明 (P2)

**问题描述:** `NovelCard.vue` 只展示前 3 个标签（`tags.slice(0, 3)`），但未提示用户是否有更多标签被隐藏。

**源码位置:** `web/src/components/NovelCard.vue:8`
```typescript
const displayTags = computed(() => props.novel.novelBaseData.tags.slice(0, 3))
```

**建议:** 当 tags.length > 3 时，显示 `+N` 的溢出指示。

---

### 1.12 缺少全局错误处理与用户反馈 (P2)

**问题描述:** 文档中未描述错误状态处理：localStorage 满（5-10MB 限制）、数据损坏、浏览器不支持 IndexedDB 等优雅降级方案。

**建议:** 在 Store 和 Composables 中加入 try-catch 包裹，实现 toast/notification 错误提示系统。

---

## 二、架构设计

### 2.1 数据模型源与派生关系需明确文档化 (P1)

**问题描述:** 存在三个数据定义层：
1. `Data.cs` — C# 规范模型（被注释为 canonical）
2. `web/src/types/index.ts` — TypeScript 镜像
3. `docs/04-server.md` — SQLite 表结构

三者之间存在差异：TypeScript 的 `WritingStyle` 多了 `name` 字段，Server 的 `writing_styles` 表也有 `name` 列，但 Data.cs 没有。这暗示 Data.cs 可能已不是真正的 canonical source。

**建议:**
- 明确指定哪个是真正的主源（建议 TypeScript → C# 单向生成，而非手工镜像）
- 在 CODEBUDDY.md 中说明修改流程：先改哪个文件，其他如何同步
- 删除 Data.cs 或改为从 TypeScript 自动生成

---

### 2.2 Server 设计使用 JSON 列存储嵌套数据 (P1)

**问题描述:** `docs/04-server.md` 设计中，novels 表将 `novel_base`、`role_list`、`outline` 等嵌套结构存为 TEXT/JSON 列：

```sql
novel_base TEXT,      -- JSON: NovelBaseData
role_list TEXT,       -- JSON: RoleList
outline TEXT,         -- JSON: Outline
```

**影响:** JSON 列无法用 SQL 查询内部字段（如"查出所有 Genre='玄幻' 的小说"需要全表扫描后 JSON 解析）。与关系型数据库的设计理念冲突。

**建议:**
- 将高频查询字段（genre, tags）拆为独立列或关联表
- 或选择文档型数据库（如 LiteDB）而非 SQLite
- 如坚持 JSON，在文档中注明查询限制和补偿方案（应用层索引）

---

### 2.3 前端组件结构与文档描述不完全匹配 (P1)

**问题描述:** CODEBUDDY.md 列出的组件（NovelCard, OutlineTree, PhaseAccordion, RoleEditor, TextEditor, TocPanel）与实际页面组件和 composables 的关系未在文档中描述。缺少组件依赖关系图和 Props/Events 约定。

**建议:** 为每个页面增加"组件树"章节，描述组件层级、数据流方向、关键 Props。

---

### 2.4 AI Agent 工具设计与前端耦合过紧 (P2)

**问题描述:** `04-server.md` 中的 15 个 AI Tool 直接映射到 Pinia Store 的 action：

| Tool | 直接操作 |
|------|---------|
| create_novel | addNovel() |
| update_novel | updateNovel() |
| delete_novel | deleteNovel() |
| ... | ... |

**影响:** AI Agent 成为前端的"影子写入者"，任何 store 变更都需要同步映射工具。未来 store 重构会破坏 Agent。

**建议:** 
- 引入 Command 抽象层（例如 `NovelCommand` 类），Store 和 AI Tools 都通过 Command 操作数据
- 或在 Server 中实现独立的业务逻辑层，不直接依赖 Store

---

### 2.5 缺少 API 抽象层 (P2)

**问题描述:** 当前前端直接读写 localStorage。Server 文档描述了 REST API，但没有 API Client 抽象层（如 `apiClient.ts` 模块）。未来切换到 Server 时需要散弹式修改所有页面。

**建议:** 
- 创建 `src/api/` 目录
- 实现 `LocalStorageAdapter` 和 `HttpApiAdapter` 统一接口
- 通过依赖注入或环境变量切换后端

---

### 2.6 composables 缺少文档描述 (P2)

**问题描述:** CODEBUDDY.md 列出了 4 个 composables（useNovel, useTheme, useFontSize, useKeyboard），但只给了名称，没有参数签名、返回值类型、使用示例。

**建议:** 在 CODEBUDDY.md 或独立的 composables 文档中补充 API 文档。

---

### 2.7 Agent Bar 设计未定义交互协议 (P2)

**问题描述:** AppLayout 中预留了 220px 右侧 Agent Bar（可折叠至 36px），但 `04-server.md` 的 Chat UI 设计和前端 Layout 之间缺少具体的组件通信协议：消息格式、动作类型、状态管理。

**建议:** 在 `docs/` 中增加 `05-agent-bar.md`，定义 Chat 组件的 Props/Events/Slots 和与新 Store（如 `useAgentStore`）的交互。

---

### 2.8 组件直接修改 Store Props (P1)

**问题描述:** 多个组件通过 `props` 获取 Store 的响应式引用后直接修改其内部字段，而非通过 Store Action 操作：

| 组件 | 直接修改行为 | 源码位置 |
|------|-------------|---------|
| PhaseAccordion | `props.phase.chapterOutlines.push(ch)` | `PhaseAccordion.vue:23` |
| PhaseAccordion | `props.phase.title = data.title` | `PhaseAccordion.vue:15` |
| RoleEditor | `Object.assign(props.roleData, ...)` | `RoleEditor.vue:21` |
| OutlinePage | `novel.value.outline.outlinePhases.push(phase)` | `OutlinePage.vue:28` |
| RolesPage | `novel.value.roleList.femaleRoles.push(...)` | `RolesPage.vue:16` |

这是 Vue 的明确反模式。虽然 Pinia deep watch 会捕获这些变更并持久化，但绕过了 Store 的 action 抽象层，降低了数据流的可追踪性。

**建议:** 所有数据变更通过 Store action 完成：
```typescript
store.addChapterToPhase(novelId, phaseId, chapterData)
```

---

### 2.9 PhaseAccordion 父→子同步缺失 (P1)

**问题描述:** `PhaseAccordion.vue` 中从 props 到本地 `data` 的同步 watch 缺少 `immediate: true` 选项：

```typescript
// PhaseAccordion.vue:10
watch(() => [props.phase.title, props.phase.description], ([t, d]) => {
  data.title = t; data.description = d
})
// 缺少 { immediate: true }
```

**影响:** 当父组件通过 Store 更新 phase 数据时，子组件的本地状态不会同步更新。虽然 `:key="phase.id"` 可以触发重新挂载，但在 phase.id 不变的情况下（如撤销/重置操作）会出现不一致。

**建议:** 添加 `{ immediate: true }` 选项。

---

### 2.10 OutlineTree 与 TocPanel 章节列表逻辑重复 (P2)

**问题描述:** `OutlineTree.vue`（`phaseChapterIds` + `chaptersNotInPhase` computed）和 `TocPanel.vue`（`tocChapters` computed）各自独立实现了"将 Phase 中的 ChapterOutlines 与 ChapterList 合并为统一章节列表"的逻辑，实现细节略有不同但功能等价。

**建议:** 将章节列表构建逻辑抽取为 composable（如 `useChapterTree(novel) -> tocItem[]`）或 Store getter。

---

### 2.11 StylePage 未使用统一 ID 工具函数 (P2)

**问题描述:** `StylePage.vue` 在创建新预设时直接调用 `crypto.randomUUID()`，而未使用 `types/index.ts` 中导出的 `createId()` 工具函数：

```typescript
// StylePage.vue (savePreset 中)
const preset: WritingStyle = { id: crypto.randomUUID(), ... }
```

**建议:** 统一使用 `createId()` 以保持 ID 生成逻辑的一致性。

---

## 三、技术可行性

### 3.1 缺少测试基础设施 (P0)

**问题描述:** 项目没有配置任何测试框架（CODEBUDDY.md 明确记录 "No tests configured yet"）。对于一个包含复杂状态管理、AI Agent 集成、数据持久化的应用，零测试覆盖是高风险信号。

**建议:**
- 立即引入 Vitest（与 Vite 同生态）
- 优先为以下模块编写测试：
  - `stores/allData.ts` — CRUD 逻辑正确性
  - `types/index.ts` — 工厂函数和计算函数
  - `composables/` — 关键业务逻辑

---

### 3.2 Vite 8 + TypeScript 6 版本激进 (P1)

**问题描述:** `package.json` 指定 `vite ^8.0.12` 和 `typescript ~6.0.2`。这两个都是 2026 年最新主版本，生态尚未成熟：

| 依赖 | 版本 | 风险 |
|------|------|------|
| vite | ^8.0.12 | 插件兼容性（自动导入、Naive UI 适配） |
| typescript | ~6.0.2 | vue-tsc、IDE 工具链稳定性 |
| unplugin-auto-import | ^21.0.0 | API 可能变动 |

**建议:** 
- 评估降级到 Vite 6/7 + TypeScript 5.x 的可行性
- 如坚持最新版，在 README 中记录已知兼容性问题和 workaround
- 添加 `package-lock.json` 锁定依赖（当前未提交？）

---

### 3.3 Server 实现分 9 阶段，缺乏中期交付物 (P1)

**问题描述:** `04-server.md` 将服务器实现分为 9 个阶段，从基础 Express 到完整 AI Agent。但每个阶段没有定义独立的可验证目标。Phase 4（用户系统）之前所有功能都没有持久化后端。

**建议:**
- 为 Phase 1-3 定义 MVP（最小可行后端）：Express + SQLite + 基础 CRUD API
- 将 AI Agent（Phase 5-9）作为独立的功能旗标，不与基础架构强制绑定
- 每个阶段定义验收测试用例

---

### 3.4 AI Agent 设计过于宏大 (P1)

**问题描述:** `04-server.md` 的 AI Agent 设计包含了：
- SSE 流式响应（reasoning / tool_call / mutation / content / done 5 种事件）
- KV Cache 优化（append-only messages）
- Session 状态机（active / cancelling / idle / expired）
- 15 个 CRUD Tool Definitions
- Thinking mode（reasoning_effort: high）
- 24h 自动清理过期 Session

对于一个尚未启动 Server 实现的项目，这个设计偏离了"先有可工作的后端，再加 AI"的增量原则。

**建议:**
- 将 Agent 设计移到独立文档（`05-agent.md`）
- 在 Server Phase 3 完成后再启动 Agent 详细设计
- 当前阶段只保留 Agent 的接口契约（输入/输出 Schema）

---

### 3.5 自动导入插件可能产生隐式依赖 (P2)

**问题描述:** `unplugin-auto-import` 自动导入 Vue/Pinia/Naive UI 的 API（ref, computed, useRouter 等），这虽然方便但让代码可读性下降：

```typescript
// 自动导入的 ref、computed 没有显式 import 语句
const novel = ref<Novel | null>(null)
```

**影响:** 新开发者不知道 `ref` 从哪来；IDE 需要生成 `auto-imports.d.ts` 才能正常类型检查；依赖升级时隐式导入可能静默失败。

**建议:** 
- 在 CODEBUDDY.md 中明确说明自动导入的范围
- 在 `.vscode/settings.json` 中排除 `auto-imports.d.ts` 的 lint
- 考虑限制自动导入范围，核心 API 保持显式 import

---

### 3.6 缺少 .gitignore 验证 (P2)

**问题描述:** 未确认 `.gitignore` 是否包含必要排除项（`node_modules`, `dist`, `auto-imports.d.ts`, `components.d.ts`, `.env` 等）。

**建议:** 验证 `.gitignore` 完整性。

---

### 3.7 缺少 ESLint/Prettier 配置 (P2)

**问题描述:** 项目没有代码规范工具。对于 TypeScript + Vue 3 项目，建议配置 ESLint（`@typescript-eslint` + `eslint-plugin-vue`）。

**建议:** 使用 `npm create @eslint/config` 或手动配置。

---

### 3.8 calcTotalWordCount 函数命名误导 (P2)

**问题描述:** `types/index.ts` 中的 `calcTotalWordCount` 实际计算的是字符数（`.content.length`），而非词数。对于中文写作，字符数更合理，但函数名会误导英文用户。

**源码位置:** `web/src/types/index.ts`
```typescript
export function calcTotalWordCount(novel: Novel): number {
  return novel.chapterList.chapters.reduce((sum, ch) => sum + ch.content.length, 0)
}
```

**建议:** 重命名为 `calcTotalCharCount` 或在 JSDoc 中说明这是"中文字符计数"。

---

## 四、安全与性能

### 4.1 localStorage 明文存储用户创作数据 (P0)

**问题描述:** 所有小说内容以明文 JSON 存储在 `localStorage` 键 `novelwrite-all-data` 下。任何人获得浏览器访问权限即可读取全部创作内容。

**影响:** 用户创作的小说（可能包含未发布稿件、商业敏感设定）无任何保护。

**建议:**
- 选项 A（轻量）：使用 Web Crypto API 对 `localStorage` 数据进行 AES-GCM 加密，密钥基于用户口令派生
- 选项 B（中期）：切换到 IndexedDB + 加密层
- 选项 C（长期）：服务端存储 + HTTPS 传输加密（已规划）

---

### 4.2 Agent Bar 未定义 AI 操作权限边界 (P0)

**问题描述:** 04-server.md 中的 15 个 AI Tool 拥有完整的 CRUD 权限，可以创建、修改、删除小说和章节。没有权限分级、操作确认或回滚机制。

**影响:** AI 的幻觉可能产生不可逆的数据破坏（例如错误地删除章节或覆盖大纲）。

**建议:**
- 为 AI Agent 操作实现沙箱模式：AI 变更写入 `pending_changes` 表，用户审核后合并
- 实现 `dry_run` 模式：展示即将执行的操作，由用户确认
- 添加操作日志（audit log）记录所有 AI 发起的变更
- 分级权限：读操作自动执行，写操作需确认，删除操作需二次确认

---

### 4.3 Server API 缺少 Rate Limiting (P1)

**问题描述:** `04-server.md` 的 API 设计中未提及任何频率限制。AI Agent 的 SSE 连接和工具调用是重资源操作。

**建议:**
- API 端点添加 `express-rate-limit` 中间件
- AI Agent 端点单独限制（如 10 req/min per session）
- SSE 连接数上限（如 5 并发）

---

### 4.4 缺少输入校验层 (P1)

**问题描述:** 文档中没有描述前端或后端的输入校验策略。小说标题、章节内容、角色名等用户输入直接写入 Store/SQLite，无长度限制、XSS 过滤、特殊字符处理。

**影响:** 可能存储超大内容（localStorage 5MB 限制）、XSS 风险（如果后续引入 HTML 渲染）。

**建议:**
- 前端：在组件中使用 Naive UI 的 Form Rule 设定字段限制
- 后端：使用 Zod 或 Joi 做 Schema 验证
- 明确文本存储限制（如标题 ≤ 200 字符，章节 ≤ 100KB）

---

### 4.5 Pinia Store 全局 Deep Watch 性能隐患 (P1)

**问题描述:** `web/src/stores/allData.ts` 中使用了全局 deep watcher：

```typescript
watch(
  () => state.value,
  (newData) => { saveToStorage(newData) },
  { deep: true }
)
```

**影响:** 每次修改任何嵌套字段（包括逐字输入章节内容）都会触发整个 AllData 对象的序列化和 localStorage 写入。当小说数量多或章节长时，会产生明显卡顿。

**建议:**
- 使用 `debounce`（如 500ms）减少写入频率
- 或改用 `watchEffect` + dirty flag 批量写入
- 长文本（章节内容）考虑单独存储或使用 IndexedDB

---

### 4.6 localStorage 无容量监控与降级 (P2)

**问题描述:** 大多数浏览器 localStorage 限制为 5-10MB。当用户创作多部长篇小说时，可能超出限制导致静默失败（QuotaExceededError）。

**建议:**
- 在 Store 中添加容量检查：`saveToStorage` 捕获 QuotaExceededError
- 在 UI 中显示已用容量（Dashboard 底部或设置页）
- 达到 80% 阈值时提示用户导出或清理

---

### 4.7 Server 使用同步 SQLite 驱动 (P2)

**问题描述:** `docs/04-server.md` 选用 `better-sqlite3`（同步 API）。虽然同步避免回调地狱，但会阻塞 Node.js 事件循环，影响并发性能（尤其是 AI Agent SSE 流和多个 API 请求并发的场景）。

**建议:**
- 文档中说明选择同步驱动的理由和权衡
- 评估切换到 `sql.js`（WASM）或异步驱动的可行性
- 或将 AI Agent 的 SSE 流放在 Worker Thread 中隔离

---

### 4.8 缺少 CSP 和 HTTPS 策略 (P2)

**问题描述:** 文档未提及 Content Security Policy、CORS 配置、HTTPS 要求。Server 规划中的 API Key（Bearer Token）通过 HTTP 明文传输时不安全。

**建议:**
- Server 强制 HTTPS（生产环境）
- 配置 CORS 白名单
- 前端设置合理的 CSP header

---

### 4.9 组件 Scoped CSS 未适配暗色模式 (P2)

**问题描述:** 多个组件的 scoped style 使用了硬编码颜色值，在暗色模式下不可见或视觉效果差：

| 组件 | 硬编码颜色 | 源码位置 |
|------|-----------|---------|
| OutlineTree | `background: #f5f5f5`, `#e8f0fe`, `#1a73e8` | `OutlineTree.vue` style |
| TocPanel | `background: #fff`, `#f5f5f5`, `#e8f0fe` | `TocPanel.vue` style |
| WritePage | `border-right: #eee` | `WritePage.vue` |

虽然 Naive UI 通过 `n-config-provider` 管理了大部分主题，但自写 CSS 没有使用 CSS 变量继承主题。

**建议:** 使用 Naive UI 的 CSS 变量（如 `var(--n-color)`, `var(--n-border-color)`）或引入 `useThemeVars` composable。

---

## 五、Issue 汇总

| # | 级别 | 标题 | 维度 | ID |
|---|------|------|------|----|
| 1 | P0 | 缺少测试基础设施 — 零测试覆盖 | 技术可行性 | I-001 |
| 2 | P0 | localStorage 明文存储用户创作数据 | 安全与性能 | I-002 |
| 3 | P0 | AI Agent 操作无权限边界与回滚机制 | 安全与性能 | I-003 |
| 4 | P1 | README 滞后于实际进度（Pinia/Vue Router 状态） | 产品完整性 | I-004 |
| 5 | P1 | 服务端设计文档未被 README 索引 | 产品完整性 | I-005 |
| 6 | P1 | 缺少数据版本与迁移机制 | 产品完整性 | I-006 |
| 7 | P1 | 数据模型源与派生关系需明确文档化 | 架构设计 | I-007 |
| 8 | P1 | Server 使用 JSON 列存储嵌套数据 — 查询困境 | 架构设计 | I-008 |
| 9 | P1 | 前端组件结构与文档描述不完全匹配 | 架构设计 | I-009 |
| 10 | P1 | Vite 8 + TypeScript 6 版本激进 | 技术可行性 | I-010 |
| 11 | P1 | Server 实现分 9 阶段缺乏中期交付物 | 技术可行性 | I-011 |
| 12 | P1 | AI Agent 设计过于宏大 | 技术可行性 | I-012 |
| 13 | P1 | Server API 缺少 Rate Limiting | 安全与性能 | I-013 |
| 14 | P1 | 缺少输入校验层 | 安全与性能 | I-014 |
| 15 | P1 | Pinia Store 全局 Deep Watch 性能隐患 | 安全与性能 | I-015 |
| 16 | P1 | 文本编辑器功能过于基础 | 产品完整性 | I-016 |
| 17 | P1 | 缺少表单验证 | 产品完整性 | I-017 |
| 18 | P1 | 组件直接修改 Store Props（反模式） | 架构设计 | I-018 |
| 19 | P1 | PhaseAccordion 父→子同步缺失 | 架构设计 | I-019 |
| 20 | P2 | 缺少数据导入/导出功能 | 产品完整性 | I-020 |
| 21 | P2 | 缺少撤销/重做机制 | 产品完整性 | I-021 |
| 22 | P2 | 角色类型限定过于刚性 | 产品完整性 | I-022 |
| 23 | P2 | 写作风格预设更新不自动同步 | 产品完整性 | I-023 |
| 24 | P2 | 离开页面无"未保存更改"提示 | 产品完整性 | I-024 |
| 25 | P2 | NovelCard 标签截断不透明 | 产品完整性 | I-025 |
| 26 | P2 | 缺少全局错误处理与用户反馈 | 产品完整性 | I-026 |
| 27 | P2 | AI Agent 工具设计与前端耦合过紧 | 架构设计 | I-027 |
| 28 | P2 | 缺少 API 抽象层 | 架构设计 | I-028 |
| 29 | P2 | composables 缺少文档描述 | 架构设计 | I-029 |
| 30 | P2 | Agent Bar 设计未定义交互协议 | 架构设计 | I-030 |
| 31 | P2 | OutlineTree 与 TocPanel 章节列表逻辑重复 | 架构设计 | I-031 |
| 32 | P2 | StylePage 未使用统一 ID 工具函数 | 架构设计 | I-032 |
| 33 | P2 | 自动导入插件可能产生隐式依赖 | 技术可行性 | I-033 |
| 34 | P2 | 缺少 .gitignore 验证 | 技术可行性 | I-034 |
| 35 | P2 | 缺少 ESLint/Prettier 配置 | 技术可行性 | I-035 |
| 36 | P2 | calcTotalWordCount 函数命名误导 | 技术可行性 | I-036 |
| 37 | P2 | localStorage 无容量监控与降级 | 安全与性能 | I-037 |
| 38 | P2 | Server 使用同步 SQLite 驱动 | 安全与性能 | I-038 |
| 39 | P2 | 缺少 CSP 和 HTTPS 策略 | 安全与性能 | I-039 |
| 40 | P2 | 组件 Scoped CSS 未适配暗色模式 | 安全与性能 | I-040 |

---

## 附录：文档-源码一致性矩阵

| 文档声明 | 源码验证 | 一致性 |
|----------|----------|--------|
| "Pinia（待集成）" (README) | stores/allData.ts 已实现 | ❌ 不一致 |
| "Vue Router（待集成）" (README) | router/index.ts 已实现 | ❌ 不一致 |
| 7 个路由 (CODEBUDDY.md) | router/index.ts 7 routes | ✅ 一致 |
| 4 composables (CODEBUDDY.md) | 4 composable 文件存在 | ✅ 一致 |
| 6 components (CODEBUDDY.md) | 6 component 文件存在 | ✅ 一致 |
| 数据模型 (Data.cs) | types/index.ts mirror | ⚠️ WritingStyle.name 差异 |
| auto-import 插件 (CODEBUDDY.md) | vite.config.ts plugins | ✅ 一致 |
| "plain text only" (CODEBUDDY.md) | n-input type="textarea" | ✅ 一致 |
| Server API 设计 (04-server.md) | N/A (未实现) | — |

---

> **审查结论:** 项目整体方向正确，文档体系较为完善。**3 个 P0 问题需要在进入开发下一阶段前优先解决**（测试基础设施、数据加密、AI 安全边界）。**16 个 P1 问题建议在上线前修复**（含源码审查发现的编辑器功能、表单验证、组件反模式等）。**21 个 P2 优化建议可在迭代中逐步完善。**

# 代码审查报告

**日期**: 2026-06-20  
**审查人**: CodeBuddy（审核）

---

## 审查轮次

| 轮次 | 内容 |
|------|------|
| 第一轮 | Issue #1-#62 修复质量验证 |
| 第二轮 | 针对第一轮反馈的二次修复验证（未提交修改） |

---

## 最终结论

**第一轮发现的 6 个问题全部修复，额外修复了 5 个原有 P1/P2 Issue。**

| 类别 | 数量 |
|------|------|
| 第一轮 reopen + 新建的 Issue（第二轮已修复关闭） | 6 |
| 第二轮额外发现并关闭的 Issue | 5 |
| 仍开放的 Issue | 12 |

---

## 🟢 第二轮关闭的 Issue（11 个）

### Server 端修复（6 个）

| Issue | 标题 | 修复方式 |
|-------|------|---------|
| #48 | SQL注入风险 | 新增 `server/src/db/query.ts` 参数化查询模块，全局替换 `sq()` 拼接 |
| #52 | E2E 测试文件缺失 | 新增 `query.test.ts`（5 测试）+ vitest 基础设施 |
| #63 | persistDb IO 放大 | 移除 authMiddleware 冗余 persistDb，注释说明由 30s 定时器兜底 |
| #64 | 数据库事务 | `execute()` 支持 `{ tx: true }` 事务包裹 + `executeInTransaction()` |
| #65 | CLI preset delete 不验证 | 增加 `queryFirst` 存在性检查 |
| #66 | updateLastUsed 字符串插值 | 改为 `db.run(sql, [id])` 参数化 |

### 前端修复（5 个）

| Issue | 标题 | 修复方式 |
|-------|------|---------|
| #31 | OutlineTree/TocPanel 逻辑重复 | 新增 `useChapterTree.ts` 统一章节树 composable |
| #12 | 缺少撤销/重做机制 | 新增 `useUndoRedo.ts`（MAX_HISTORY=100） |
| #35 | 缺少 ESLint/Prettier | `eslint.config.js` + `.prettierrc` + lint/lint:fix 脚本 |
| #30 | Agent Bar 交互协议未定义 | 新增 `docs/05-agent-bar.md` |

---

## 🟡 有进展但仍开放的 Issue

| Issue | 标题 | 进展 |
|-------|------|------|
| #1 | 测试基础设施 | Server + Frontend 均有 vitest 配置和测试文件，建议降 P1 |
| #2 | localStorage 明文存储 | 新增 UnlockDialog.vue（AES-GCM 256 加密），sessionStorage 缓存 |

---

## 🔴 仍开放的 P0/P1 Issue

| Issue | 标题 | 级别 |
|-------|------|------|
| #1 | 测试基础设施覆盖率不足 | P0 → 建议降 P1 |
| #2 | localStorage 明文存储（未完善） | P0 |
| #3 | AI Agent 操作无权限边界 | P0 |
| #23 | 文本编辑器功能过于基础 | P1 |
| #24 | 所有页面表单缺少验证规则 | P1 |
| #26 | 组件直接修改 Store Props（Vue 反模式） | P1 |

---

## 🟡 仍开放的 P2 Issue

| Issue | 标题 |
|-------|------|
| #18 | 离开页面无未保存更改提示 |
| #22 | 缺少全局错误处理与用户反馈 |
| #25 | AI Agent 工具设计与前端 Store 耦合过紧 |
| #29 | composables 缺少文档描述 |
| #39 | 缺少 CSP 和 HTTPS 策略（CSP 已实现） |
| #40 | 组件 Scoped CSS 未适配暗色模式 |

---

## 关键架构改进

### query.ts — 参数化查询模块

`server/src/db/query.ts` 是本次修复的核心：
- `queryFirst<T>(sql, params)` — 单行参数化 SELECT
- `queryAll<T>(sql, params)` — 多行参数化 SELECT
- `execute(sql, params, { tx, persist })` — 参数化写操作，支持事务
- `executeInTransaction(queries)` — 多查询原子事务
- `patchNovelJsonField(novelId, field, mutator)` — JSON 字段读取-修改-写回事务

所有 `sq()` / `sqEscape()` 调用已从项目中移除。

### 测试

```bash
# Server（5 测试，含 SQL 注入防护）
cd server && npm test
# ✓ src/__tests__/query.test.ts (5 tests)
```

---

*报告结束*

# NovelWriteDesktop

## Agent Memory 规则

本项目使用 `agent-memory` MCP（TencentDB Agent Memory Bridge）进行对话记忆管理。

### MCP 服务器配置

MCP 服务器配置在 `~/.claude/settings.json`（全局配置，不入库），项目本身不存储任何凭据。

> `SENDER=claude-code` 限定本域为编码分析域，与 `codebuddy`（编码调试）、`openclaw`（日常对话）隔离，互不干扰。

### 可用 MCP 工具

| 工具 | 用途 |
| --- | --- |
| `recall_memory(query)` | 按语义召回相关记忆（自动限定本 sender 域） |
| `search_memories(query)` | 语义搜索记忆（支持 `limit`、`type`、`scene` 过滤） |
| `store_memory` | 存储对话 |
| `end_session` | 结束当前会话 |

### 使用规则

- **按需召回**：当上下文不清晰、或需要回顾之前的讨论时，主动调用 `recall_memory` 或 `search_memories`
- **不自动存储**：仅按你的指令存储记忆，不主动调用 `store_memory`
- **结束会话**：对话自然结束时，调 `end_session()`

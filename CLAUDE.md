# NovelWriteDesktop

## Agent Memory 规则

本项目使用 `agent-memory` MCP（TencentDB Agent Memory Bridge）进行对话记忆管理。

### 自动存储规则

每次回复结束时，**必须**调用 `store_memory` MCP 工具，将本轮对话存入记忆：

- `user_content`: 用户的输入内容
- `assistant_content`: 我的完整回复内容
- `session_key`: 不传，让 MCP 自动管理

### 按需召回

当上下文不清晰、或需要回顾之前的讨论时，主动调用：

- `recall_memory(query)` — 召回相关记忆
- `search_memories(query)` — 语义搜索记忆

### 结束会话

对话自然结束时，调用 `end_session()` 结束当前记忆会话。

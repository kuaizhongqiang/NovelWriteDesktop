# NovelWrite Desktop

[![CI](https://github.com/kuaizhongqiang/NovelWriteDesktop/actions/workflows/ci.yml/badge.svg)](https://github.com/kuaizhongqiang/NovelWriteDesktop/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/novelwrite-server?label=npm)](https://www.npmjs.com/package/novelwrite-server)

小说写作平台 —— 桌面端 Web 应用，支持 AI 写作助手。

## 快速开始（npm 安装）

```bash
# 1. 安装服务端
npm install -g novelwrite-server@alpha

# 2. 初始化数据库
novelwrite init

# 3. 生成 API Key（用于前端登录）
novelwrite auth generate my-key
# 输出: API Key generated:
#   Name: my-key
#   Key:  nw_xxxx...    ← 保存此 Key，登录前端时需要

# 4. 配置环境变量
#    在运行目录创建 .env 文件：
cat > .env << EOF
DEEPSEEK_API_KEY=sk-your-deepseek-api-key
PORT=3002
EOF

# 5. 启动服务
novelwrite-server
# 访问 http://localhost:3002
```

### 环境变量说明

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `DEEPSEEK_API_KEY` | ✅ AI 功能必需 | — | DeepSeek API Key，用于 AI 写作助手 |
| `PORT` | 否 | `3002` | 服务端口 |
| `CORS_ORIGIN` | 否 | `http://localhost:5173` | CORS 允许的前端地址（开发用） |
| `NOVELWRITE_DB_PATH` | 否 | `./novelwrite.db` | SQLite 数据库路径 |
| `DEEPSEEK_ENDPOINT` | 否 | `https://api.deepseek.com/v1/chat/completions` | DeepSeek API 端点 |
| `DEEPSEEK_MODEL` | 否 | `deepseek-v4-flash` | 模型名称 |

### 前端登录

启动服务后，浏览器访问 `http://localhost:3002`，在登录页输入步骤 3 生成的 API Key 即可。

## 本地开发

```bash
# 前端
cd web
npm install
npm run dev          # http://localhost:5173

# 服务端
cd server
npm install
cp .env.example .env  # 填入 DEEPSEEK_API_KEY
npm run dev           # http://localhost:3002
```

## CLI 命令

```bash
novelwrite --help          # 查看所有命令
novelwrite init            # 初始化数据库
novelwrite auth generate <name>   # 生成 API Key
novelwrite auth list       # 列出所有 Key
novelwrite auth revoke <id>       # 吊销 Key
novelwrite novel list      # 小说列表
novelwrite novel get <id>  # 查看小说
novelwrite novel create <title>   # 新建小说
novelwrite roles list <novelId>   # 角色列表
novelwrite outline get <novelId>  # 查看大纲
```

## 项目结构

```text
NovelWriteDesktop/
├── web/          # 前端（Vue 3 + Vite + TypeScript + Naive UI）
│   ├── src/
│   │   ├── components/   # AgentBar, TextEditor, UnlockDialog...
│   │   ├── composables/  # useUndoRedo, useChapterTree, useTheme...
│   │   ├── stores/       # Pinia 状态管理
│   │   ├── api/          # API 客户端（HTTP + SSE）
│   │   └── utils/        # crypto, commandBus, errorReporter
│   └── ...
├── server/       # 服务端（Node.js + Express + SQLite）
│   ├── src/
│   │   ├── ai/           # AI Agent（DeepSeek, Session, Tools）
│   │   ├── routes/       # REST API + AI SSE 路由
│   │   ├── db/           # 数据库（参数化查询, schema）
│   │   ├── cli/          # Commander CLI
│   │   └── types/        # 类型定义
│   └── ...
├── docs/         # 设计文档
└── README.md
```

## 功能特性

| 特性 | 状态 |
|------|------|
| 小说 CRUD（创建/编辑/删除） | ✅ |
| 大纲管理（幕/卷/章节） | ✅ |
| 角色管理（主角/女主/配角） | ✅ |
| 文本编辑器（自动保存/撤销/字数统计） | ✅ |
| 阅读模式（字号调节/目录导航/键盘快捷键） | ✅ |
| 写作风格预设 | ✅ |
| 暗色模式 | ✅ |
| localStorage 加密 | ✅ |
| AI 写作助手（DeepSeek + Tool Calling） | ✅ |
| REST API + CLI | ✅ |
| 认证系统（API Key + Bearer Token） | ✅ |

## 文档

设计文档在 [docs/](docs/) 目录下：

- [00-overview.md](docs/00-overview.md) — 项目概述、技术栈、路由规划
- [01-data-model.md](docs/01-data-model.md) — 数据模型（C# → TypeScript 映射）
- [02-layout.md](docs/02-layout.md) — 通用布局与导航
- [03-pages.md](docs/03-pages.md) — 各页面详细设计
- [04-server.md](docs/04-server.md) — 服务端架构（API / AI Agent / CLI / 认证）
- [05-agent-bar.md](docs/05-agent-bar.md) — Agent Bar 组件协议

## 发布渠道

| 渠道 | 命令 |
|------|------|
| npm (alpha) | `npm install -g novelwrite-server@alpha` |
| npm (beta) | `npm install -g novelwrite-server@beta`（即将发布） |
| GitHub | [releases](https://github.com/kuaizhongqiang/NovelWriteDesktop/releases) |

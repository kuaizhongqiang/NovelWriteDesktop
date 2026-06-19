# NovelWrite Desktop

小说写作平台 —— 桌面端 Web 应用

## 快速开始

### 通过 npm 安装服务端

```bash
# 安装服务端
npm install -g novelwrite-server@alpha

# 初始化数据库
novelwrite init

# 生成 API Key
novelwrite auth generate my-key

# 启动服务
novelwrite-server
```

### 本地开发

```bash
# 前端
cd web
npm install
npm run dev          # http://localhost:5173

# 服务端
cd server
npm install
cp .env.example .env  # 填入 DEEPSEEK_API_KEY
npm run cli init
npm run cli auth generate dev-key
npm run dev           # http://localhost:3002
```

## 项目结构

```text
NovelWriteDesktop/
├── web/          # 前端（Vue 3 + Vite + TypeScript + Naive UI）
├── server/       # 服务端（Node.js + Express + SQLite）
├── docs/         # 设计文档
└── README.md
```

## 文档

设计文档在 [docs/](docs/) 目录下：

- [00-overview.md](docs/00-overview.md) — 项目概述、技术栈、路由规划
- [01-data-model.md](docs/01-data-model.md) — 数据模型（C# → TypeScript 映射）
- [02-layout.md](docs/02-layout.md) — 通用布局与导航
- [03-pages.md](docs/03-pages.md) — 各页面详细设计
- [04-server.md](docs/04-server.md) — 服务端架构（API / AI Agent / CLI / 认证）

## 技术栈

| 层级       | 技术                              |
| ---------- | --------------------------------- |
| 框架       | Vue 3 + TypeScript                |
| 构建工具   | Vite 8                            |
| UI 组件库  | Naive UI                          |
| 状态管理   | Pinia ✅ 已集成                    |
| 路由       | Vue Router ✅ 已集成               |
| 服务端     | Node.js + Express + SQLite        |

## 开发状态

- [x] 前端原型 — 7 个页面全部完成
- [x] 设计文档 — 产品设计 + 服务端架构
- [x] 服务端 — SQLite + REST API + CLI ✅ v0.1.0-alpha 已发布
- [ ] AI Agent — DeepSeek + Tool Calling（下一阶段）
- [x] Alpha 发布 — [GitHub Release](https://github.com/kuaizhongqiang/NovelWriteDesktop/releases) + [npm](https://www.npmjs.com/package/novelwrite-server)

## 发布渠道

| 渠道 | 命令 |
|------|------|
| npm | `npm install -g novelwrite-server@alpha` |
| GitHub | [releases](https://github.com/kuaizhongqiang/NovelWriteDesktop/releases) |

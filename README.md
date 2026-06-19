# NovelWrite Desktop

小说写作平台 —— 桌面端 Web 应用

## 项目结构

```text
NovelWriteDesktop/
├── web/          # 前端（Vue 3 + Vite + TypeScript + Naive UI）
├── server/       # 服务端（待开发）
└── README.md
```

## 前端开发

```bash
cd web
npm install        # 已配置代理，v2ray 端口 10808
npm run dev        # 开发模式，默认 http://localhost:5173
npm run build      # 生产构建
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
| 服务端     | Node.js + Express + SQLite（待开发） |

## 开发状态

- [x] 前端原型 — 7 个页面全部完成
- [x] 设计文档 — 产品设计 + 服务端架构
- [ ] 服务端 — SQLite + REST API + CLI
- [ ] AI Agent — DeepSeek + Tool Calling
- [ ] Alpha 发布 — GitHub Release + npm

# NovelWrite Desktop

小说写作平台 —— 桌面端 Web 应用

## 项目结构

```text
NovelWriteDesktop/
├── web/          # 前端（Vue 3 + Vite + TypeScript + Naive UI）
├── server/       # 服务端（TODO）
└── README.md
```

## 前端开发

```bash
cd web
npm install        # 已配置代理，v2ray 端口 10808
npm run dev        # 开发模式
npm run build      # 构建
```

## 文档

设计文档在 [docs/](docs/) 目录下：

- [00-overview.md](docs/00-overview.md) — 项目概述、技术栈、路由规划
- [01-data-model.md](docs/01-data-model.md) — 数据模型（C# → TypeScript 映射）
- [02-layout.md](docs/02-layout.md) — 通用布局与导航
- [03-pages.md](docs/03-pages.md) — 各页面详细设计

## 技术栈

| 层级       | 技术                              |
| ---------- | --------------------------------- |
| 框架       | Vue 3 + TypeScript                |
| 构建工具   | Vite 8                            |
| UI 组件库  | Naive UI                          |
| 状态管理   | Pinia（待集成）                   |
| 路由       | Vue Router（待集成）              |

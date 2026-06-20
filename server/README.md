# NovelWrite Server

小说写作平台服务端。提供 REST API、AI 写作助手（DeepSeek）、SQLite 持久化、CLI 管理工具。

## 快速启动

```bash
# 安装
npm install -g novelwrite-server@alpha

# 初始化数据库
novelwrite init

# 启动服务（首次启动会在控制台输出初始密码）
novelwrite-server
```

浏览器访问 `http://localhost:3002`，输入初始密码登录。

## 环境变量

| 变量 | 默认值 | 必需 | 说明 |
|------|--------|------|------|
| `PORT` | `3002` | 否 | 服务端口 |
| `CORS_ORIGIN` | `http://localhost:5173` | 否 | CORS 来源（开发时用） |
| `NOVELWRITE_DB_PATH` | `./novelwrite.db` | 否 | 数据库路径 |
| `DEEPSEEK_API_KEY` | — | AI 功能必需 | DeepSeek API 密钥 |
| `DEEPSEEK_ENDPOINT` | `https://api.deepseek.com/v1/chat/completions` | 否 | API 端点 |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | 否 | AI 模型 |
| `SESSION_SECRET` | `novelwrite-default-secret` | 否 | Cookie 签名密钥 |

在运行目录创建 `.env` 文件配置环境变量。

## CLI 命令

```bash
novelwrite init                          # 初始化数据库
novelwrite auth generate <name>          # 生成 API Key（程序调用用）
novelwrite auth list                     # 列出所有 Key
novelwrite auth revoke <id>              # 吊销 Key
novelwrite novel list                    # 列出小说
novelwrite novel get <id>               # 查看小说
novelwrite novel create <title>          # 创建小说
novelwrite novel update <id> --title x   # 更新小说
novelwrite novel delete <id>            # 删除小说
novelwrite roles list <novelId>         # 查看角色
novelwrite roles add <novelId> --type x --name x  # 添加角色
novelwrite outline get <novelId>        # 查看大纲
novelwrite chapter get <novelId> --chapter-id x  # 查看章节
novelwrite tool-list                     # 查看所有可用工具
novelwrite --help                        # 完整帮助
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 密码登录（获取 Cookie Session） |
| POST | `/api/auth/logout` | 退出登录 |
| GET | `/api/auth/status` | 检查登录状态 |
| POST | `/api/auth/change-password` | 修改密码 |
| GET/POST/PUT/DELETE | `/api/novels` | 小说 CRUD |
| GET/POST/PUT/DELETE | `/api/writing-styles` | 写作风格 CRUD |
| POST | `/api/ai/chat` | AI 助手会话（SSE 流式） |
| DELETE | `/api/ai/session/:id` | 停止 AI 会话 |
| GET | `/api/ai/session/:id/stats` | AI 会话统计 |

## AI 写作助手

配置 `DEEPSEEK_API_KEY` 后，AI 功能自动启用。支持：

- 文本修改与续写（局部替换/插入/追加）
- 角色管理（增删改角色）
- 大纲管理（幕/卷/章节结构）
- 写作风格调整
- Token 用量与缓存命中率统计

## 管理操作

```bash
# 重置密码（删除数据库后重新 init）
novelwrite init

# 备份数据库
cp novelwrite.db novelwrite.db.bak

# 查看日志
cat server.log
```

## 更新前端

```bash
# 从源码构建前端
cd web
npm install
npm run build

# 复制到服务端静态目录
mkdir -p ../server/static && cp -r dist/* ../server/static/
```

## 开发

```bash
git clone https://github.com/kuaizhongqiang/NovelWriteDesktop
cd server
npm install
cp .env.example .env    # 编辑填入 DEEPSEEK_API_KEY
npm run dev             # tsx watch 热重载

# 前端开发（另一个终端）
cd web
npm run dev             # http://localhost:5173
# 开发时设置 CORS_ORIGIN=http://localhost:5173
```

## 背景

当前认证机制问题：
- 用户必须在 CLI 手动生成 Key，然后通过浏览器控制台粘贴到 localStorage
- Key 明文存储在 localStorage，XSS 可窃取
- login 端点只做验证不创建 Session，每次请求仍需带 Bearer header
- 无首次启动体验：server 启动后没有任何可用的 Key

## 目标

将认证从 Bearer Token + localStorage 改为 **Cookie Session + 密码登录**。

## 实现计划

### 一、Server 端

#### 1.1 新增依赖

```
npm install cookie-parser
npm install -D @types/cookie-parser
```

#### 1.2 新增 db/session.ts — Session 管理器

内存 Session Store（类似 ai/session.ts 的模式）：
- sessionId (UUID) → { createdAt, lastActivityAt }
- 24h 过期，每 10min 清理过期 session
- 接口：createSession() / validateSession(id) / deleteSession(id)

#### 1.3 新增 db/password.ts — 密码管理

使用 Node.js 内置 `crypto.scryptSync` 做密码哈希（不引入 bcrypt 依赖）：
- hashPassword(plaintext) → "salt:hash" 格式存入 DB
- verifyPassword(plaintext, storedHash) → boolean
- initPassword() → 首次启动时自动生成随机密码（例: ab3f-9k2m），console 醒目输出
- changePassword(oldPlaintext, newPlaintext) → 验证旧密码后更新

#### 1.4 改造 schema.ts — 新增 admin_password 表

```sql
CREATE TABLE IF NOT EXISTS admin_password (
  id INTEGER PRIMARY KEY DEFAULT 1,
  password_hash TEXT NOT NULL,
  created TEXT NOT NULL,
  updated TEXT NOT NULL
)
```

#### 1.5 改造 index.ts — 中间件

```ts
// 新增 cookie-parser
import cookieParser from 'cookie-parser'
app.use(cookieParser(process.env.SESSION_SECRET || 'novelwrite-default-secret'))
```

`SESSION_SECRET` 建议加到 `.env.example`，首次启动时如未配置则自动生成并提示用户。

#### 1.6 改造 routes/auth.ts — 新接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/login | 接受 { password }，验证后设置 httpOnly signed cookie `nw_session` |
| POST | /api/auth/logout | 清除 cookie，删除 session |
| GET | /api/auth/status | 返回 { loggedIn: boolean } |
| POST | /api/auth/change-password | 接受 { oldPassword, newPassword }，修改密码 |

authMiddleware 逻辑：
1. 先检查 signed cookie `nw_session` 是否有效
2. 无 cookie 时降级检查 Bearer token（兼容旧 API Key）

#### 1.7 PUBLIC_PATHS 更新

`['/', '/login', '/api/health', '/api/auth/login', '/api/auth/status']`

#### 1.8 兼容策略

- 保留 auth_keys 表和 CLI auth generate/revoke/list 命令（API/程序化访问场景）
- Cookie session 和 Bearer token 双通道认证

### 二、Frontend 端

#### 2.1 新增 pages/LoginPage.vue

路由: `/login`

功能：
- 密码输入框（带显示/隐藏切换）
- 登录按钮
- 错误提示（密码错误等）
- POST /api/auth/login { password }
- 成功后 router.push('/')
- cookie 由浏览器自动管理，前端不存储任何 token

#### 2.2 router/index.ts — 路由守卫

```ts
// 新增路由
{ path: '/login', name: 'login', component: () => import('@/pages/LoginPage.vue') }

// 全局前置守卫（在现有守卫之前或替换）
router.beforeEach(async (to) => {
  if (to.path === '/login') return true
  try {
    const res = await fetch('/api/auth/status')
    const data = await res.json()
    if (data.loggedIn) return true
  } catch {}
  return '/login'
})
```

#### 2.3 api/index.ts — 移除 Token 管理

- 删除 getStoredToken / setStoredToken / clearStoredToken / isLoggedIn
- request() 函数不再手动添加 Authorization header（cookie 自动携带）
- 401 响应处理：跳转 /login

#### 2.4 api/ai.ts — 适配

AI 客户端不再手动传 Authorization header，依赖 cookie。

#### 2.5 清理

- 删除 localStorage key `novelwrite-api-key` 相关引用
- #72 AuthSetupPage 不再需要（被 LoginPage 替代）

### 三、首次启动流程

```
Server 启动
  → 检查 admin_password 表是否为空
    → 空表：生成随机密码，console 输出：

      ╔══════════════════════════════════════════╗
      ║  NovelWrite 首次启动                     ║
      ║  初始密码: ab3f-9k2m-w1xp               ║
      ║  请复制保存，登录后建议修改密码           ║
      ╚══════════════════════════════════════════╝

    → 有记录：正常启动

用户浏览器访问 http://localhost:3002
  → 路由守卫检测未登录 → 跳转 /login
  → 输入密码 → 登录成功 → 进入 Dashboard
```

### 四、文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 新增 | server/src/db/session.ts | Session 管理器 |
| 新增 | server/src/db/password.ts | 密码哈希与验证 |
| 改造 | server/src/db/schema.ts | 新增 admin_password 表 |
| 改造 | server/src/index.ts | 引入 cookie-parser，调整中间件顺序 |
| 改造 | server/src/routes/auth.ts | 新增 login/logout/status/change-password |
| 新增 | web/src/pages/LoginPage.vue | 登录页面 |
| 改造 | web/src/router/index.ts | 新增 /login 路由 + 守卫 |
| 改造 | web/src/api/index.ts | 移除 token 管理，依赖 cookie |
| 改造 | web/src/api/ai.ts | 移除 token 传递 |
| 安装 | cookie-parser | npm 依赖 |

# Codex 执行指令手册

> 使用方式：每完成一个 Task，将对应"Codex 指令"粘贴给 Codex 执行，完成后把代码/diff 发给 Claude 验收。  
> 严格按 T01 → T28 顺序执行，有依赖关系不可跳过。

---

## 工作流程

```
你（用户）把 Codex 指令粘贴给 Codex
      ↓
Codex 生成代码
      ↓
你把代码/输出发给 Claude
      ↓
Claude 按验收清单逐项检查
      ↓
通过 → 进入下一个 Task
不通过 → Claude 指出问题 → 重新让 Codex 修复
```

---

## 全局上下文（每次给 Codex 时附在指令开头）

```
项目：Translater Sir 公司内部同声传译工具
仓库：translater-sir/
技术栈：Next.js 15 App Router · TypeScript · Tailwind · shadcn/ui · Prisma · PostgreSQL · Redis · Cloudflare R2 · NextAuth v5
包管理器：pnpm
产品定位：
  - 当前作为公司内部会议同声传译工具
  - 优先保障会议实时传译、字幕、录音留存、术语库、组织权限和后台健康检查
  - 计费、公开 API、Webhook 作为后续扩展或内部治理能力保留
代码规范：
  - 全量 TypeScript，禁用 any
  - ESLint + Prettier，提交前必须通过
  - 所有入参用 Zod 校验
  - API 统一返回 { data, error, meta }
  - 数据库只存结构化数据，大文件放 R2
  - Redis 所有 Key 必须设 TTL
  - 禁止 SQL 拼接，全部走 Prisma
  - 异常必须捕获，不得 unhandled rejection
完整 PRD 见仓库根目录 CODEX_TASKS.md
当前状态总结见 docs/project-status.md
```

---

## T01 · 项目初始化 & Monorepo 结构

### Codex 指令

```
[全局上下文]

Task T01：项目初始化 & Monorepo 结构

目标：搭建可持续扩展的项目骨架，后续所有 Task 在此基础上开发。

请完成以下所有步骤，每步生成完整可运行代码：

1. 用 pnpm create next-app@latest 配置创建 Next.js 15 项目
   - App Router: yes
   - TypeScript: yes
   - Tailwind CSS: yes
   - src/ 目录: no
   - import alias: @/*

2. 初始化 Turborepo monorepo 结构
   packages/types/     共享类型
   packages/utils/     共享工具函数
   apps/web/           Next.js 主应用

3. 安装并初始化 shadcn/ui（使用 New York 风格，slate 主色）

4. 安装依赖：
   pnpm add prisma @prisma/client
   pnpm add ioredis
   pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
   pnpm add pino pino-pretty
   pnpm add next-auth@beta @auth/prisma-adapter
   pnpm add zod react-hook-form @hookform/resolvers
   pnpm add zustand
   pnpm add bcryptjs
   pnpm add @types/bcryptjs -D

5. 配置 ESLint（@typescript-eslint/recommended + eslint-config-next）
   生成 .eslintrc.json

6. 配置 Prettier
   生成 .prettierrc 和 .prettierignore

7. 配置路径别名 @/ → apps/web/（tsconfig.json + next.config.ts）

8. 生成以下文件（完整内容）：
   apps/web/lib/db.ts           Prisma Client 单例（防止 dev 热重载重复连接）
   apps/web/lib/redis.ts        ioredis 单例（含连接错误处理）
   apps/web/lib/r2.ts           S3 兼容 R2 Client（含 uploadToR2/getSignedUploadUrl/getSignedDownloadUrl/deleteFromR2）
   apps/web/lib/logger.ts       Pino（dev: pretty, prod: JSON）
   apps/web/middleware.ts       路由保护（/dashboard/* 未登录跳转 /login）
   apps/web/types/global.d.ts   全局类型扩展
   apps/web/utils/cn.ts         clsx + tailwind-merge 工具函数

9. 生成 .env.example（完整变量清单，含注释）

10. 生成 turbo.json

11. 生成根目录 package.json（含 dev/build/lint/type-check/test 脚本）

交付要求：
- 所有文件完整内容，不要省略
- pnpm dev 必须可以启动，无 TypeScript 错误
- 生成 README.md 说明本地启动步骤
```

### Claude 验收清单

- [ ] `apps/web/lib/db.ts` 使用 globalThis 防止重复连接
- [ ] `apps/web/lib/redis.ts` 有错误事件监听和日志
- [ ] `apps/web/lib/r2.ts` 导出 4 个函数：upload / getSignedUpload / getSignedDownload / delete
- [ ] `apps/web/middleware.ts` 正确保护 `/dashboard` 路由
- [ ] `.env.example` 包含所有必要变量（DB / Redis / R2 / Auth / AI / Stripe）
- [ ] `tsconfig.json` 中 `@/*` 别名指向正确路径
- [ ] ESLint 配置包含 `@typescript-eslint/no-explicit-any: error`
- [ ] `turbo.json` pipeline 定义正确
- [ ] `pnpm dev` 无报错（TypeScript + ESLint）

---

## T02 · 数据库 Schema & Prisma 初始化

### Codex 指令

```
[全局上下文]

Task T02：数据库 Schema & Prisma 初始化
依赖：T01 已完成

目标：建立完整数据库结构，所有后续 Task 的数据基础。

请完成：

1. 生成完整 prisma/schema.prisma，包含以下所有 Model：
   User · Account · Session · VerificationToken
   Organization · Member
   Meeting · MeetingSegment · MeetingFile
   Dictionary · DictionaryTerm
   AiLog · Subscription · ApiKey · Webhook
   AuditLog · DownloadLog

   完整字段和类型参见 CODEX_TASKS.md 的"数据库完整 Schema"章节。
   必须包含：
   - 所有枚举类型（UserRole / MemberRole / Plan / MeetingStatus / FileType / AiType / SubscriptionStatus）
   - 所有外键关系（onDelete 策略）
   - 所有 @@index 和 @@unique

2. 生成 prisma/migrations/0001_init/migration.sql（或直接运行 prisma migrate dev --name init）

3. 生成 prisma/seed.ts：
   - 超级管理员账号（email: admin@example.com, password: Admin123456!）
   - 示例组织（name: "示例公司", slug: "example-corp"）
   - 默认术语库（含 5 条中英术语）
   使用 bcrypt 哈希密码

4. 在 package.json 中添加 prisma seed 配置：
   "prisma": { "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts" }

5. 生成 apps/web/types/prisma.ts：
   从 @prisma/client 重导出常用类型，并定义常用的 Select/Include 类型组合

6. 验证：生成一个简单的连接测试脚本 scripts/db-check.ts

交付要求：
- prisma validate 通过
- prisma generate 通过
- seed.ts 无 TypeScript 错误
- 所有 @@index 必须存在
```

### Claude 验收清单

- [ ] Schema 包含全部 17 个 Model
- [ ] 所有枚举值正确（特别是 MemberRole 和 Plan）
- [ ] `MeetingSegment` 有 `@@index([meetingId, sequence])`
- [ ] `AuditLog` 有 `@@index([userId, createdAt])` 和 `@@index([resource, resourceId])`
- [ ] `DictionaryTerm` 有 `@@index([dictionaryId, source])`
- [ ] 所有外键有 `onDelete` 策略（User Cascade, Organization Restrict 等）
- [ ] `seed.ts` 使用 bcrypt 哈希密码，不存明文
- [ ] `prisma/schema.prisma` 顶部有正确的 `datasource` 和 `generator` 配置
- [ ] `DownloadLog.expiresAt` 字段存在

---

## T03 · 身份认证系统（NextAuth v5）

### Codex 指令

```
[全局上下文]

Task T03：身份认证系统（NextAuth v5）
依赖：T01 T02 已完成

目标：实现完整的登录注册流程，包括邮箱密码和 Google OAuth。

请完成：

1. apps/web/lib/auth.ts
   配置 NextAuth v5，包含：
   - Credentials Provider（邮箱+密码）
   - Google OAuth Provider
   - PrismaAdapter
   - JWT 策略（Access Token 15min）
   - callbacks.jwt：注入 userId / role / organizationId（取第一个组织）
   - callbacks.session：映射 token 到 session
   - pages: { signIn: '/login', error: '/login' }

2. apps/web/app/api/auth/[...nextauth]/route.ts

3. 类型扩展 apps/web/types/auth.d.ts：
   扩展 Session 和 JWT 类型，加入 userId / role / organizationId

4. Zod Schema apps/web/lib/validations/auth.ts：
   LoginSchema / RegisterSchema / ForgotPasswordSchema / ResetPasswordSchema

5. Server Actions apps/web/app/(auth)/login/actions.ts：
   - loginAction：验证入参 → 查用户 → 比对密码 → 检查限流（Redis，5次/15min）→ signIn
   - 失败返回 { error: "..." }

6. Server Actions apps/web/app/(auth)/register/actions.ts：
   - registerAction：验证入参 → 检查邮箱唯一 → bcrypt hash → 创建 User → 发送验证邮件（Nodemailer/Resend，邮件模板简单即可）→ 创建默认组织

7. 页面（使用 shadcn/ui 组件）：
   apps/web/app/(auth)/login/page.tsx         邮箱+密码表单 + Google 登录按钮
   apps/web/app/(auth)/register/page.tsx      注册表单
   apps/web/app/(auth)/forgot-password/page.tsx
   apps/web/app/(auth)/reset-password/page.tsx

8. apps/web/utils/password.ts：
   hashPassword / verifyPassword（bcrypt，cost=12）

9. 登出 Server Action：
   - 将 JWT jti 写入 Redis 黑名单（TTL 15min）
   - 调用 signOut

限流实现（Redis sliding window）：
   Key: ratelimit:auth:login:{email}
   超过 5 次返回 { error: "登录失败次数过多，请 15 分钟后重试" }

交付要求：
- 登录/注册/登出完整流程可用
- TypeScript 无报错
- 所有表单有 React Hook Form + Zod 校验
- 错误信息友好（中文）
```

### Claude 验收清单

- [ ] `auth.ts` callbacks.jwt 注入了 `userId` / `role` / `organizationId`
- [ ] Session 类型被正确扩展，TypeScript 可以访问 `session.user.role`
- [ ] 密码用 bcrypt cost=12 存储，数据库中无明文
- [ ] 登录限流：Redis Key `ratelimit:auth:login:{email}` 有 TTL 900s
- [ ] 注册时创建用户的同时创建默认组织，并将用户加为 OWNER
- [ ] 登出时 JWT jti 进入黑名单
- [ ] 所有 Server Action 捕获异常，不向客户端暴露内部错误
- [ ] 表单有 loading 状态和 disabled 状态
- [ ] 未登录访问 `/dashboard` 正确跳转 `/login`

---

## T04 · 用户管理模块

### Codex 指令

```
[全局上下文]

Task T04：用户管理模块
依赖：T03 已完成

目标：用户个人资料查看与编辑、密码修改、头像上传。

请完成：

1. API Route Handlers（apps/web/app/api/users/）：
   GET  /api/users/me           → 返回当前用户（含所属组织列表）
   PATCH /api/users/me          → 更新 name（Zod 校验）
   POST /api/users/me/avatar    → 接收图片 → 校验类型(jpeg/png/webp)和大小(<5MB) → 上传 R2 → 更新 avatarUrl
   POST /api/users/me/password  → 验证旧密码 → 验证新密码强度 → bcrypt → 更新
   DELETE /api/users/me         → 软删除（添加 deletedAt 字段）或直接删除（选一种并说明）

2. Server Actions apps/web/app/(dashboard)/settings/profile/actions.ts

3. 页面：
   apps/web/app/(dashboard)/settings/profile/page.tsx
   - 头像显示（next/image）+ 点击上传
   - 姓名编辑
   - 邮箱（只读）
   apps/web/app/(dashboard)/settings/security/page.tsx
   - 修改密码表单
   - 登录记录（最近 5 次，从 AuditLog 查）

4. 组件：
   components/user/AvatarUpload.tsx    拖拽或点击上传，预览，进度条
   components/user/ProfileForm.tsx
   components/user/PasswordForm.tsx

5. 头像上传流程：
   前端 → POST /api/upload/presigned（获取 R2 预签名 URL）→ 直传 R2 → POST /api/users/me/avatar（传 key，confirm 写库）

6. Hook：
   hooks/useCurrentUser.ts    SWR/React Query 获取当前用户，全局共享

交付要求：
- 头像上传使用预签名 URL 直传 R2（不经过服务器）
- 所有字段有 Zod 校验
- 操作成功/失败有 toast 提示（shadcn/ui toast）
```

### Claude 验收清单

- [ ] 头像直传 R2，服务器不转发文件内容（检查 `/api/upload/presigned` 实现）
- [ ] 头像校验：只允许 jpeg/png/webp，最大 5MB
- [ ] 修改密码必须验证旧密码，新密码 Zod 强度校验
- [ ] `avatarUrl` 保存的是 R2 CDN URL，不是 Base64
- [ ] API 返回 `{ data, error }` 统一格式
- [ ] 未登录请求返回 401

---

## T05 · 组织 & 团队管理

### Codex 指令

```
[全局上下文]

Task T05：组织 & 团队管理
依赖：T03 T04 已完成

目标：多租户组织结构，成员邀请，角色管理。

请完成：

1. API Route Handlers（apps/web/app/api/organizations/）：
   POST   /api/organizations                         创建组织
   GET    /api/organizations/:id                     获取组织详情
   PATCH  /api/organizations/:id                     更新名称/Logo
   GET    /api/organizations/:id/members             成员列表（分页）
   POST   /api/organizations/:id/members/invite      发送邀请邮件
   PATCH  /api/organizations/:id/members/:memberId   修改角色
   DELETE /api/organizations/:id/members/:memberId   移除成员
   POST   /api/invitations/:token/accept             接受邀请

2. 邀请 Token 逻辑：
   - 生成 crypto.randomUUID()
   - 存 Redis：Key = invitation:{token}，Value = JSON { orgId, email, role, invitedBy }，TTL = 86400（24h）
   - 发送邮件，链接为 /invitations/{token}

3. 页面：
   app/(dashboard)/settings/organization/page.tsx    组织基本信息 + Logo 上传
   app/(dashboard)/settings/members/page.tsx         成员列表 + 邀请表单
   app/(dashboard)/invitations/[token]/page.tsx       接受邀请确认页

4. 组件：
   components/org/MemberList.tsx          含角色 Badge + 操作下拉菜单
   components/org/InviteForm.tsx          邮箱输入 + 角色选择
   components/org/OrgSwitcher.tsx         顶部导航的组织切换器

5. 组织切换：
   - session 中存当前 organizationId
   - 切换时更新 session（Server Action）
   - 切换后刷新页面数据

6. 权限检查（所有修改操作）：
   - 修改角色、移除成员：必须是 OWNER 或 ADMIN
   - 不能移除 OWNER
   - 不能修改自己的角色

交付要求：
- 邀请链接 24h 后失效
- 接受邀请后 Token 从 Redis 删除（防止重复使用）
- 所有操作有权限校验
```

### Claude 验收清单

- [ ] 邀请 Token 存 Redis，TTL = 86400
- [ ] 接受邀请后 Redis Key 被删除（不可重复使用）
- [ ] 不能移除唯一的 OWNER
- [ ] 不能把 OWNER 降级（必须先转让 OWNER）
- [ ] 组织 Logo 上传到 R2，存 URL
- [ ] 成员列表有分页（Cursor 分页）
- [ ] `OrgSwitcher` 组件在 layout 中可见

---

## T06 · RBAC 权限系统

### Codex 指令

```
[全局上下文]

Task T06：RBAC 权限系统
依赖：T05 已完成

目标：细粒度权限控制，所有后续需要权限的 Task 都依赖此模块。

请完成：

1. apps/web/utils/permissions.ts：
   定义 Permission 类型（所有权限点）：
     meeting:create / meeting:delete / meeting:view
     member:manage / dictionary:manage
     billing:view / billing:manage
     apikey:manage / webhook:manage
     admin:access
   
   实现 can(role: MemberRole, permission: Permission): boolean
   使用权限矩阵（Record<MemberRole, Permission[]>）
   
   实现 canInOrg(userId: string, orgId: string, permission: Permission): Promise<boolean>
   （查数据库获取成员角色，再调用 can）

2. apps/web/lib/auth-helpers.ts：
   requireAuth(): Promise<Session>          未登录抛出 UNAUTHORIZED 错误
   requireOrgMember(orgId: string)         验证是组织成员
   requirePermission(orgId, permission)    验证权限，无权限抛 FORBIDDEN

3. 统一错误类 apps/web/lib/errors.ts：
   class AppError extends Error {
     constructor(public code: string, message: string, public status: number) {}
   }
   class UnauthorizedError extends AppError {}
   class ForbiddenError extends AppError {}
   class NotFoundError extends AppError {}
   class ValidationError extends AppError {}

4. API 错误处理中间件 apps/web/lib/api-handler.ts：
   withApiHandler(handler): 包装 Route Handler
   - 自动捕获 AppError → 返回对应 HTTP 状态码
   - 捕获未知错误 → 500 + 日志
   - 统一返回 { data, error }

5. 单元测试 apps/web/__tests__/permissions.test.ts：
   用 Vitest 测试所有 can() 组合（每个角色 × 每个权限）

6. 在 README 中写明权限矩阵表格

交付要求：
- can() 函数通过所有单元测试
- withApiHandler 在 T04 T05 的 Route Handler 中已使用（给出改造示例）
- TypeScript 无报错
```

### Claude 验收清单

- [ ] `can()` 函数有单元测试，覆盖所有角色×权限组合
- [ ] `AppError` 子类正确，HTTP 状态码映射正确（401/403/404/422/500）
- [ ] `withApiHandler` 捕获 `AppError` 并返回 `{ data: null, error: { code, message } }`
- [ ] `requireAuth` 内部不 try-catch，直接抛出 `UnauthorizedError`
- [ ] `canInOrg` 有数据库查询缓存（至少 in-memory 或 Redis 1min）
- [ ] 测试文件中 VIEWER 不能 `meeting:create`，OWNER 能做所有操作

---

## T07 · Redis 基础设施 & Session 管理

### Codex 指令

```
[全局上下文]

Task T07：Redis 基础设施 & Session 管理
依赖：T01 已完成

目标：规范 Redis Key 命名和 TTL 管理，所有后续 Task 遵守此规范。

请完成：

1. apps/web/utils/redis-keys.ts：
   导出 RedisKeys 对象，包含所有 Key 生成函数：
   session(id) / jwtBlacklist(jti) / verification(token)
   invitation(token) / resetPassword(token) / rateLimit(action, id)
   meetingSubtitle(meetingId) / meetingStatus(meetingId) / meetingOnline(meetingId)
   wsConnection(connId) / translateCache(hash) / aiContext(meetingId)
   downloadToken(token) / glossary(orgId, src, tgt)

2. apps/web/utils/redis-ttl.ts：
   导出 TTL 常量（秒）：
   SESSION = 604800（7d）/ JWT_BLACKLIST = 900（15min）
   INVITATION = 86400（24h）/ RESET_PASSWORD = 3600（1h）
   MEETING_SUBTITLE = 1800（30min）/ TRANSLATE_CACHE = 3600（1h）
   DOWNLOAD_TOKEN = 300（5min）/ GLOSSARY = 300（5min）
   AI_CONTEXT = 3600（1h）/ RATE_LIMIT_LOGIN = 900（15min）

3. apps/web/lib/session.ts：
   getSession(sessionId): Promise<SessionData | null>
   setSession(sessionId, data, ttl): Promise<void>
   deleteSession(sessionId): Promise<void>

4. apps/web/lib/jwt-blacklist.ts：
   addToBlacklist(jti, expiresAt): Promise<void>
   isBlacklisted(jti): Promise<boolean>
   （TTL = Access Token 剩余有效期，不超过 900s）

5. Redis 健康检查 apps/web/app/api/health/redis/route.ts：
   ping Redis → 返回 { status: 'ok', latencyMs: number }
   失败返回 503

6. Redis 工具函数 apps/web/utils/redis-helpers.ts：
   withRedisCache<T>(key, ttl, fetcher): Promise<T>
   （先查缓存，miss 时调 fetcher 并写入）

交付要求：
- 所有 Key 使用 RedisKeys 生成（不允许硬编码字符串 Key）
- 所有写入操作使用 setex / pexpire 确保 TTL
- 健康检查端点可访问
```

### Claude 验收清单

- [ ] `RedisKeys` 覆盖所有使用场景（至少 13 个函数）
- [ ] `TTL` 常量与文档一致
- [ ] `withRedisCache` 正确处理 JSON 序列化/反序列化
- [ ] `addToBlacklist` 使用 `setex`，TTL 不超过 900s
- [ ] `/api/health/redis` 返回延迟毫秒数
- [ ] `lib/redis.ts` 连接失败时日志打印，不崩溃进程

---

## T08 · Cloudflare R2 文件存储集成

### Codex 指令

```
[全局上下文]

Task T08：Cloudflare R2 文件存储集成
依赖：T01 已完成

目标：封装完整的 R2 操作，支持前端直传。

请完成：

1. 完善 apps/web/lib/r2.ts：
   uploadToR2(key, body, contentType) → R2 公网 URL
   getSignedUploadUrl(key, contentType, expiresIn=300) → 预签名上传 URL
   getSignedDownloadUrl(key, expiresIn=300) → 预签名下载 URL
   deleteFromR2(key) → void
   getR2Key(type, orgId, ...segments) → 规范化 Key 路径（见 CODEX_TASKS.md R2 目录结构）

2. apps/web/utils/upload-validation.ts：
   ALLOWED_AUDIO_TYPES / ALLOWED_IMAGE_TYPES / ALLOWED_VIDEO_TYPES
   MAX_AUDIO_SIZE (500MB) / MAX_IMAGE_SIZE (5MB)
   validateUpload(file, allowedTypes, maxSize) → { valid, error }

3. API Route Handlers：
   POST /api/upload/presigned（apps/web/app/api/upload/presigned/route.ts）
     入参：{ key, contentType, fileSize, purpose: 'avatar'|'audio'|'attachment' }
     校验类型和大小 → 生成预签名上传 URL → 返回 { uploadUrl, key }
   
   POST /api/upload/confirm（apps/web/app/api/upload/confirm/route.ts）
     入参：{ key, purpose, meetingId? }
     验证文件确实已上传到 R2（HeadObject 检查）→ 写入对应数据库表

   GET /api/download/:fileId（apps/web/app/api/download/[fileId]/route.ts）
     查 MeetingFile 表 → 验证权限 → 生成预签名下载 URL（5min）→ 存 Redis downloadToken → 重定向

4. apps/web/hooks/useFileUpload.ts：
   接口：upload(file, purpose, options?) → Promise<{ url, key }>
   内部：获取预签名 URL → XMLHttpRequest 直传 → confirm → 返回 URL
   暴露：uploadProgress(0-100) / isUploading / error

5. R2 健康检查 /api/health/r2：
   尝试写入一个 1 字节对象再删除 → 返回延迟

交付要求：
- 前端直传（不经过服务器中转）
- 大文件（>10MB）说明如何使用 Multipart Upload（可以是注释）
- 所有 R2 操作有错误重试（最多 3 次）
```

### Claude 验收清单

- [ ] `getSignedUploadUrl` 使用 `PutObjectCommand` + `getSignedUrl`
- [ ] `/api/upload/presigned` 在返回 URL 前校验文件类型和大小
- [ ] `/api/upload/confirm` 用 `HeadObjectCommand` 验证文件真实存在
- [ ] `/api/download/:fileId` 验证用户有权限下载（是该会议的组织成员）
- [ ] 下载 Token 存 Redis，TTL = 300s
- [ ] `useFileUpload` hook 用 XHR 而不是 fetch（为了 progress 事件）
- [ ] R2 Key 路径统一用 `getR2Key` 生成，无硬编码路径

---

## T09 · WebSocket 基础设施

### Codex 指令

```
[全局上下文]

Task T09：WebSocket 基础设施
依赖：T07 已完成

目标：建立实时通信基础，支持会议字幕推送。

技术说明：Vercel Serverless 不支持原生 WebSocket 长连接。
请使用 Ably Realtime（免费额度充足）作为 WebSocket 服务。
如果用户未配置 Ably，退回到轮询（SSE）方案。

请完成：

1. 安装：pnpm add ably

2. 环境变量补充 .env.example：
   ABLY_API_KEY=""
   NEXT_PUBLIC_ABLY_CLIENT_KEY=""  # 只读 Key（Ably capability 限制只能 subscribe）

3. apps/web/lib/ably.ts：
   getAblyServer() → Ably.Rest 单例（服务端用）
   
   publishToMeeting(meetingId, event, data) → 发布消息到 channel meeting:{meetingId}

4. apps/web/types/websocket.ts：
   完整的 WsMessage 类型联合（参见 CODEX_TASKS.md T09 章节）
   SubtitlePayload / TranslationPayload / MeetingStatusPayload / ErrorPayload

5. apps/web/hooks/useAblyChannel.ts：
   useAblyChannel(meetingId, onMessage) → { publish, connectionState }
   - 自动连接、自动重连（Ably 内置）
   - 组件卸载时自动 unsubscribe
   - connectionState: 'connected'|'connecting'|'disconnected'|'failed'

6. apps/web/hooks/useWebSocket.ts（对外暴露的 Hook，屏蔽底层实现）：
   useWebSocket(meetingId) → {
     sendSubtitle(payload: SubtitlePayload)
     sendTranslation(payload: TranslationPayload)
     onSubtitle(handler)
     onTranslation(handler)
     connectionState
   }

7. API：POST /api/meetings/:id/ws-token
   生成 Ably Token Request（限制 capability：只能 subscribe meeting:{id} channel）
   用于客户端连接认证

8. 备用方案（SSE）apps/web/app/api/meetings/[id]/stream/route.ts：
   GET 请求 → 返回 text/event-stream
   从 Redis meeting:subtitle:{meetingId} 轮询（每 200ms）推送新字幕

交付要求：
- useWebSocket Hook 有完整 TypeScript 类型
- 连接状态变化时回调 onConnectionStateChange
- 断线重连有 UI 提示
- 写一个简单的测试页面 app/(dashboard)/test/ws/page.tsx 验证消息收发
```

### Claude 验收清单

- [ ] Ably Token Request API 限制了 capability（只能 subscribe，不能 publish）
- [ ] `publishToMeeting` 在服务端（Route Handler）调用，不在客户端
- [ ] `useWebSocket` Hook 暴露的接口与底层 Ably 解耦（类型只用 WsMessage）
- [ ] 组件卸载时正确 unsubscribe，无内存泄漏
- [ ] SSE 备用方案存在且可用
- [ ] WsMessage 类型联合完整，使用 discriminated union（type 字段）

---

## T10 · ASR 语音识别服务集成

### Codex 指令

```
[全局上下文]

Task T10：ASR 语音识别服务集成
依赖：T09 已完成

目标：对接 Deepgram 实时 ASR，将音频流转为文字并推送字幕。

请完成：

1. 安装：pnpm add @deepgram/sdk

2. apps/web/lib/asr/types.ts：
   AsrProvider 类型 / TranscriptResult 接口 / AsrConfig 接口

3. apps/web/lib/asr/deepgram.ts：
   createDeepgramStream(config: AsrConfig): DeepgramStream
   - 建立 Deepgram WebSocket 连接
   - 接收音频 chunk（Buffer）
   - 触发 onTranscript 回调（区分 is_final）
   - 错误重连（最多 3 次）

4. apps/web/lib/asr/index.ts：
   统一 ASR 工厂函数，根据 provider 返回对应实现
   目前只实现 deepgram，预留 whisper / google 接口

5. apps/web/app/api/meetings/[id]/asr/route.ts（WebSocket 升级端点）：
   接收浏览器音频 chunk → 转发 Deepgram → 收到转录结果：
     a. 写入 Redis：LPUSH meeting:subtitle:{meetingId}（只保留最近 100 条，LTRIM）
     b. 通过 Ably 推送到 meeting:{meetingId} channel
     c. is_final=true 时写入 PostgreSQL MeetingSegment
     d. 写入 AiLog（provider/model/latency/tokens）

   注意：Vercel 不支持 WebSocket upgrade，此处用 SSE + POST 分离：
     POST /api/meetings/:id/asr/chunk  接收音频 chunk（base64 编码）
     GET  /api/meetings/:id/asr/stream  SSE 推送转录结果

6. apps/web/hooks/useAudioCapture.ts：
   useAudioCapture(meetingId) → { start, stop, pause, resume, audioLevel, isCapturing }
   - getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } })
   - MediaRecorder（mimeType: audio/webm;codecs=opus）
   - 每 250ms 触发 ondataavailable
   - 将 chunk 发送到 /api/meetings/:id/asr/chunk（base64）
   - 音量分析（AnalyserNode）→ audioLevel (0-100)
   - 静音检测：连续 3s 音量 < 5 则暂停发送

7. 组件 components/meeting/AudioVisualizer.tsx：
   Canvas 绘制实时波形，接收 audioLevel prop

交付要求：
- ASR 延迟目标 < 300ms（不含网络）
- 静音时不发送空数据
- 所有 AI 调用写入 AiLog 表
- is_final 字幕写入数据库，非 final 字幕只存 Redis
```

### Claude 验收清单

- [ ] Deepgram API Key 只在服务端使用，不暴露给客户端
- [ ] 音频 chunk 发送频率：250ms/次
- [ ] `is_final=true` 时写入 `MeetingSegment`，`false` 只写 Redis
- [ ] Redis `meeting:subtitle:{meetingId}` 用 `LTRIM` 限制最多 100 条
- [ ] `AiLog` 记录：provider=deepgram, type=ASR, latencyMs, status
- [ ] `useAudioCapture` 在组件卸载时停止 MediaRecorder 并释放资源
- [ ] 静音检测不发送空 chunk（节省 API 费用）
- [ ] 错误时向用户展示友好提示，不暴露内部错误

---

## T11 · AI 翻译服务集成

### Codex 指令

```
[全局上下文]

Task T11：AI 翻译服务集成
依赖：T10 已完成

目标：对接 OpenAI GPT-4o-mini 进行实时翻译，支持术语库优先匹配和缓存。

请完成：

1. 安装：pnpm add openai

2. apps/web/lib/translation/types.ts：
   TranslationProvider / TranslationRequest / TranslationResult

3. apps/web/lib/translation/openai.ts：
   translate(request: TranslationRequest): Promise<TranslationResult>
   - 使用 gpt-4o-mini（快速 + 便宜）
   - System prompt 包含：你是专业同声传译，保持简洁，不解释，只输出译文
   - 如有术语，在 prompt 中注入：遇到以下词语请使用指定译文：{terms}

4. apps/web/lib/translation/glossary.ts：
   loadGlossary(orgId, srcLang, tgtLang): Promise<GlossaryEntry[]>
   - 先查 Redis（Key: glossary:{orgId}:{src}:{tgt}，TTL: 300s）
   - miss 时查数据库，写入 Redis
   
   applyGlossary(text, glossary): { processedText, matchedTerms }
   - 替换文本中的术语，记录命中情况

5. apps/web/lib/translation/cache.ts：
   getCachedTranslation(hash): Promise<string | null>
   setCachedTranslation(hash, result, ttl=3600)
   hash = md5(text + sourceLanguage + targetLanguage + orgId)

6. apps/web/lib/translation/index.ts：
   translateText(params): Promise<TranslationResult>
   流程：查缓存 → 加载术语 → 应用术语替换 → 调用 AI → 写缓存 → 写 AiLog → 返回

7. API：POST /api/translate（内部调用，会议 ASR 处理链调用）
   入参：{ text, sourceLanguage, targetLanguage, meetingId }
   出参：{ translatedText, matchedTerms, cached: boolean, latencyMs }

8. 集成到 ASR 链：
   修改 T10 的 ASR 处理：is_final=true 时 → 调用翻译 → 通过 Ably 推送翻译结果

交付要求：
- 缓存命中时不调用 AI（日志记录 cached: true）
- 术语命中率记录到 AiLog.metadata
- 翻译目标延迟 < 800ms（P95）
- 支持的语言对在 utils/languages.ts 中枚举
```

### Claude 验收清单

- [ ] 缓存 Key 包含 `orgId`（不同组织术语不同，缓存不能共用）
- [ ] `applyGlossary` 大小写不敏感匹配
- [ ] `AiLog` 记录翻译结果的 inputTokens / outputTokens / latencyMs
- [ ] 缓存命中时 `latencyMs` 接近 0
- [ ] OpenAI API Key 只在服务端，不泄漏到客户端
- [ ] `translateText` 有超时设置（max 5s），超时返回错误不阻塞

---

## T12 · TTS 语音合成服务集成

### Codex 指令

```
[全局上下文]

Task T12：TTS 语音合成服务集成
依赖：T11 已完成

目标：将翻译后文本转为语音，前端播放，支持音量和静音控制。

请完成：

1. apps/web/lib/tts/openai.ts：
   synthesize(text, language, options): Promise<ArrayBuffer>
   使用 OpenAI TTS API（tts-1 模型，默认 alloy 音色）
   
2. apps/web/lib/tts/index.ts：
   synthesizeSpeech(params): Promise<ArrayBuffer>
   预留多 Provider 接口

3. API：POST /api/tts（内部调用）
   入参：{ text, language, speed=1.0 }
   出参：音频流（audio/mpeg）
   - 音频小于 1MB 时直接返回 ArrayBuffer
   - 同时存 Redis（Key: tts:cache:{hash}，TTL: 3600）

4. apps/web/hooks/useTtsPlayer.ts：
   useTtsPlayer() → { play(text, lang), stop, setVolume(0-1), isMuted, toggleMute, isPlaying }
   - 内部维护播放队列（避免多段重叠）
   - 调用 /api/tts 获取音频 → Web Audio API 播放
   - 播放期间原声不静音（同声传译场景，用户自己控制）

5. 组件 components/meeting/TtsControls.tsx：
   音量滑块 + 静音按钮 + TTS 开关
   显示当前播放文本（字幕样式）

交付要求：
- TTS 播放队列（先进先出，不重叠）
- 组件卸载时停止播放并清空队列
- AiLog 记录 TTS 调用
- 音频数据不存数据库，只存 Redis（短期缓存）
```

### Claude 验收清单

- [ ] TTS 结果缓存到 Redis，相同文本不重复调用 API
- [ ] 播放队列用 `Array` + `shift()`，确保顺序播放
- [ ] `stop()` 立即停止当前播放并清空队列
- [ ] 音量控制使用 Web Audio API `GainNode`
- [ ] `AiLog` 记录 provider=openai, type=TTS
- [ ] 音频 Buffer 不存到 R2（短内容，缓存即可）

---

## T13 · 实时字幕系统

### Codex 指令

```
[全局上下文]

Task T13：实时字幕系统
依赖：T10 T11 T12 已完成

目标：实时展示原文+译文双语字幕，平滑无闪烁，支持历史回看。

请完成：

1. apps/web/types/subtitle.ts：
   Subtitle 接口（id, text, translation, isFinal, language, timestamp, sequence）
   SubtitleDisplayMode: 'original' | 'translation' | 'both'

2. apps/web/stores/subtitle.store.ts（Zustand）：
   subtitles: Subtitle[]
   pendingSubtitle: Subtitle | null    非 final 的当前识别片段
   addSubtitle(subtitle)               final 字幕追加到列表
   updatePending(subtitle)             更新非 final 预览
   clearSubtitles()

3. components/subtitle/SubtitleDisplay.tsx：
   Props: { meetingId, mode, fontSize, maxLines=5 }
   - 订阅 useWebSocket → 更新 Zustand store
   - 渲染：最新 maxLines 条，自动滚动到底部
   - 非 final 字幕：半透明 + 斜体
   - final 字幕：不透明，平滑淡入
   - 双语模式：原文在上（灰色），译文在下（白色大字）
   - 支持 fontSize: sm/md/lg/xl

4. components/subtitle/SubtitleHistory.tsx：
   显示所有历史字幕，支持搜索（前端过滤）
   点击某条字幕高亮显示，未来可跳转录音时间点（预留接口）

5. components/subtitle/SubtitleSettings.tsx：
   字体大小 / 显示模式 / 位置（底部/顶部）切换
   设置持久化到 localStorage

6. API：GET /api/meetings/:id/segments
   Cursor 分页，返回历史字幕（会议开始到现在）
   用于页面刷新后恢复字幕历史

交付要求：
- 字幕切换无闪烁（CSS transition，不是重新挂载）
- 设置持久化（刷新页面后保留用户偏好）
- 滚动到底部：新字幕出现时自动滚动，但用户手动上滚时不强制
```

### Claude 验收清单

- [ ] 非 final 字幕用 `updatePending`，final 用 `addSubtitle`（不重复添加）
- [ ] 自动滚动：检测用户是否在底部，是则自动滚，否则不强制
- [ ] 字幕淡入动画使用 CSS，不用 JS 定时器
- [ ] Zustand store 在会议结束后 `clearSubtitles` 被调用
- [ ] 历史字幕通过 API 懒加载，不是一次性全加载
- [ ] 设置存 `localStorage`（key: `subtitle-settings`）

---

## T14 · 会议管理模块

### Codex 指令

```
[全局上下文]

Task T14：会议管理模块
依赖：T06 T09 已完成

目标：会议的完整生命周期管理（创建/开始/结束/列表/详情/删除）。

请完成：

1. Zod Schema apps/web/lib/validations/meeting.ts：
   CreateMeetingSchema / UpdateMeetingSchema

2. API Route Handlers（apps/web/app/api/meetings/）：
   GET    /api/meetings           列表，Cursor 分页，支持 status / dateFrom / dateTo 筛选
   POST   /api/meetings           创建（检查配额，T22 预留接口）
   GET    /api/meetings/:id       详情（含 segments count, files）
   PATCH  /api/meetings/:id       更新标题/配置（需权限 meeting:create）
   DELETE /api/meetings/:id       删除（需权限 meeting:delete，同步删 R2 文件）
   POST   /api/meetings/:id/start 开始会议（status → LIVE，记录 startedAt，写 Redis meeting:status）
   POST   /api/meetings/:id/end   结束会议（status → PROCESSING，记录 endedAt，触发后处理）

3. 后处理 Server Action apps/web/app/actions/meeting-postprocess.ts：
   endMeetingPostProcess(meetingId):
   - 从 Redis 读取字幕缓存，写入尚未写入 DB 的 segments
   - 更新 Meeting 状态为 COMPLETED（如无需录音处理）
   - 触发 Webhook 事件 meeting.ended（T24 预留）

4. 页面：
   app/(dashboard)/meetings/page.tsx        列表页（卡片 + 筛选 + 分页）
   app/(dashboard)/meetings/new/page.tsx    创建页（表单）
   app/(dashboard)/meetings/[id]/page.tsx   详情页（信息 + 字幕历史 + 文件列表）

5. 组件：
   components/meeting/MeetingCard.tsx      状态 Badge + 语言对 + 时长
   components/meeting/MeetingForm.tsx      创建/编辑表单
   components/meeting/MeetingStatus.tsx    LIVE 动画 Badge

6. 自定义 Hook：
   hooks/useMeetings.ts    SWR 列表，支持筛选参数
   hooks/useMeeting.ts     SWR 单个会议，5s 轮询（LIVE 和 PROCESSING 状态）

交付要求：
- 列表用 Cursor 分页（URL 参数 cursor=）
- LIVE 状态会议卡片有动态红点动画
- 删除需要二次确认 Dialog
- 会议时长计算（endedAt - startedAt，格式化为 HH:MM:SS）
```

### Claude 验收清单

- [ ] 列表 API 用 Cursor 分页（`cursor` 参数，非 `page`/`offset`）
- [ ] `DELETE` 时同步删除 `MeetingFile` 表记录 + R2 对象
- [ ] `POST /start` 写入 `Redis meeting:status:{id} = "LIVE"`，TTL 按会议时长合理设置
- [ ] `POST /end` 触发后处理，不阻塞响应（异步）
- [ ] 权限检查：只有组织成员才能查看/操作
- [ ] LIVE 状态轮询：`useMeeting` 在状态为 LIVE/PROCESSING 时 5s 刷新
- [ ] 删除操作写入 `AuditLog`

---

## T15 · 实时传译会议室（核心页面）

### Codex 指令

```
[全局上下文]

Task T15：实时传译会议室核心页面
依赖：T13 T14 已完成

目标：整合所有实时功能，打造核心会议室页面。

请完成：

1. 页面 app/(dashboard)/meetings/[id]/live/page.tsx：
   Server Component：验证会议存在 + 用户有权限 → 传递初始数据给 Client Component

2. 主组件 components/meeting/MeetingRoom.tsx（Client Component）：
   整合 useWebSocket / useAudioCapture / useTtsPlayer / SubtitleDisplay
   管理会议生命周期

3. 布局（响应式，Tailwind）：
   桌面端（≥1024px）：
     左侧 75%：字幕区（全高度）
     右侧 25%：控制面板
     底部：波形可视化
   移动端（<1024px）：
     字幕区全屏，控制面板悬浮底部 Drawer

4. 组件 components/meeting/MeetingControls.tsx：
   麦克风开关（带视觉状态）
   TTS 开关 + 音量滑块
   字体大小调节
   双语/单语切换
   结束会议按钮（红色，二次确认）

5. 组件 components/meeting/ConnectionStatus.tsx：
   图标 + 文字：已连接（绿）/ 重连中（黄/动画）/ 已断开（红）
   断线时显示 Banner："连接已断开，正在重连..."

6. 组件 components/meeting/MeetingHeader.tsx：
   会议标题 / LIVE 动态 Badge / 已录制时长计时器（每秒+1）/ 在线人数

7. Zustand Store apps/web/stores/meeting-room.store.ts：
   完整会议室状态管理（参见 CODEX_TASKS.md T15 章节）

8. 会议结束流程：
   点击结束 → 确认 Dialog → stopRecording → POST /api/meetings/:id/end
   → 等待 PROCESSING 完成（轮询）→ 跳转 /meetings/:id

交付要求：
- 页面加载后自动弹出麦克风授权（navigator.mediaDevices.getUserMedia）
- 麦克风拒绝时显示友好引导
- 移动端测试布局
- 会议室页面 URL 可分享，其他成员打开可观看字幕（不控制麦克风）
```

### Claude 验收清单

- [ ] 页面分离 Server/Client Component，Server 做权限检查
- [ ] 麦克风授权被拒时有友好的引导界面（不直接报错）
- [ ] 连接断线 Banner 在重连时显示，连接成功后消失
- [ ] 结束会议有二次确认（不能误触）
- [ ] 时长计时器在会议开始时启动，结束时停止
- [ ] 移动端控制面板用 Drawer，不遮挡字幕
- [ ] 观看模式（非主持人）隐藏麦克风控制按钮

---

## T16 · 企业术语库

### Codex 指令

```
[全局上下文]

Task T16：企业术语库
依赖：T06 已完成

目标：企业自定义专业术语管理，翻译优先匹配。

请完成：

1. API Route Handlers（apps/web/app/api/dictionaries/）：
   完整 CRUD，参见 CODEX_TASKS.md T16 章节
   重点实现：
   POST /api/dictionaries/:id/import  CSV 批量导入
   GET  /api/dictionaries/:id/export  CSV 导出（流式响应）

2. CSV 导入：
   使用 papaparse 解析
   格式：source,target,language,notes（首行为 header）
   支持 1000 条以上
   使用 Prisma createMany 批量写入
   返回 { imported, failed, errors }

3. 页面：
   app/(dashboard)/dictionary/page.tsx      术语库列表
   app/(dashboard)/dictionary/[id]/page.tsx  术语详情 + 术语列表

4. 组件：
   components/dictionary/TermList.tsx        分页列表 + 搜索
   components/dictionary/TermForm.tsx        添加/编辑术语
   components/dictionary/ImportButton.tsx    CSV 上传 + 进度 + 结果展示

5. 搜索：
   术语列表前端搜索（< 500 条）
   > 500 条时使用 API 服务端搜索（PostgreSQL LIKE）

6. 缓存失效：
   术语库变更时，删除 Redis glossary:* Key
   下次翻译时重新加载

交付要求：
- CSV 导入有行级错误报告（第 N 行：xxx 字段缺失）
- 导出直接流式下载，不存 R2
- 批量导入用 Prisma createMany（不逐条 insert）
```

### Claude 验收清单

- [ ] CSV 导入用 `createMany`，不是循环 `create`
- [ ] 导入后使 Redis 术语缓存失效（`DEL glossary:{orgId}:*`）
- [ ] 导出用 `Response` stream，Content-Disposition 设置文件名
- [ ] 搜索区分前端搜索（≤500条）和 API 搜索（>500条）
- [ ] 术语库 CRUD 全部有权限检查（`dictionary:manage`）
- [ ] 默认术语库不可删除

---

## T17 · 会议录音 & 文件存储

### Codex 指令

```
[全局上下文]

Task T17：会议录音 & 文件存储
依赖：T14 T08 已完成

目标：录制会议音频，会议结束后上传 R2，管理会议文件。

请完成：

1. apps/web/hooks/useMediaRecorder.ts：
   接口：{ start, stop, pause, resume, uploadProgress, isRecording, audioBlob }
   - MediaRecorder 录制 WebM/Opus
   - 会议结束时：Blob → 转 ArrayBuffer → 上传 R2
   - 上传用预签名 URL + XHR（显示进度）
   - 上传完成 → POST /api/meetings/:id/files/audio（confirm）

2. API：
   GET  /api/meetings/:id/files           文件列表
   POST /api/meetings/:id/files/audio     确认录音上传（入参 key）
                                           校验 R2 文件存在 → 写 MeetingFile → 更新 Meeting.audioUrl
   DELETE /api/meetings/:id/files/:fileId 删除（删 DB + 删 R2）

3. 组件 components/meeting/RecordingIndicator.tsx：
   录制中：红色动态点 + 时长计时 + 文件大小估算（实时）
   上传中：进度条

4. 组件 components/meeting/FileList.tsx：
   文件类型图标 + 名称 + 大小 + 下载按钮
   下载走 /api/download/:fileId（临时 Token）

5. 大文件上传优化：
   > 10MB 使用 R2 Multipart Upload
   实现 multipartUpload(key, blob, onProgress) 函数

交付要求：
- 录音文件命名：meetings/{meetingId}/audio/recording-{timestamp}.webm
- 上传失败提示用户，提供重试按钮
- 文件大小超过 500MB 时提示警告（不阻止，只警告）
```

### Claude 验收清单

- [ ] 录音停止时自动触发上传（不需要用户手动点击）
- [ ] R2 Key 格式正确：`organizations/{orgId}/meetings/{meetingId}/audio/...`
- [ ] 上传完成后 `MeetingFile` 和 `Meeting.audioUrl` 同时更新
- [ ] 删除文件同时删除 R2 对象（不残留）
- [ ] 大文件（>10MB）使用 Multipart Upload
- [ ] 下载链接有权限检查（只有组织成员可下载）

---

## T18 · 会议纪要生成 & 导出

### Codex 指令

```
[全局上下文]

Task T18：会议纪要生成 & 导出
依赖：T17 已完成

目标：LLM 生成结构化纪要，导出为 PDF/DOCX/TXT。

请完成：

1. apps/web/lib/summary/generate.ts：
   generateMeetingSummary(meetingId): Promise<MeetingSummary>
   - 从数据库读取所有 MeetingSegment
   - 构建 prompt（参见下方）
   - 调用 GPT-4o（非 mini，需要质量）
   - 结构化 JSON 输出（Zod 校验响应）
   - 写入 Meeting.summaryText
   - 写入 AiLog

   prompt 模板：
   """
   你是专业会议记录员。以下是会议逐字稿（含原文和译文）。
   请生成结构化会议纪要，使用 JSON 格式：
   { title, date, duration, overview, keyPoints[], decisions[], actionItems[{task,owner?,deadline?}], highlights[] }
   要求：简洁专业，不重复，突出决策和待办。
   """

2. apps/web/lib/summary/export-pdf.ts：
   exportToPdf(meetingId): Promise<string>  返回 R2 URL
   使用 @react-pdf/renderer 生成 PDF
   包含：Logo + 标题 + 日期 + 纪要内容 + 完整逐字稿（附录）
   上传到 R2，写 MeetingFile，返回 URL

3. apps/web/lib/summary/export-docx.ts：
   exportToDocx(meetingId): Promise<string>  返回 R2 URL
   使用 docx 库生成 Word 文档

4. apps/web/lib/summary/export-txt.ts：
   exportToTxt(meetingId): Promise<string>  返回 R2 URL
   纯文本格式

5. API：
   POST /api/meetings/:id/summary/generate   触发生成（异步，立即返回 202）
   GET  /api/meetings/:id/summary            获取纪要内容（JSON）
   GET  /api/meetings/:id/export/pdf         下载 PDF（临时 Token）
   GET  /api/meetings/:id/export/docx        下载 DOCX
   GET  /api/meetings/:id/export/txt         下载 TXT

6. 组件 components/meeting/SummaryPanel.tsx：
   显示纪要（要点/决策/待办分栏）
   导出按钮（PDF/DOCX/TXT）+ 生成进度

交付要求：
- 安装：pnpm add @react-pdf/renderer docx
- 生成纪要是异步的，通过轮询检查 Meeting.summaryText 是否存在
- PDF 包含组织 Logo（从 R2 读取）
- 所有导出文件存 R2，不直接返回给浏览器（大文件用临时 Token）
```

### Claude 验收清单

- [ ] LLM 响应用 Zod 校验，格式不对时重试（最多 2 次）
- [ ] PDF 生成包含：标题页、纪要正文、逐字稿附录
- [ ] 导出文件存 R2，命名：`meetings/{id}/exports/summary.pdf`
- [ ] `AiLog` 记录纪要生成的 Token 消耗
- [ ] 生成是幂等的（再次调用不重复生成，除非强制刷新）
- [ ] 导出下载用临时 Token（5min 有效），写 `DownloadLog`

---

## T19 · 全文搜索

### Codex 指令

```
[全局上下文]

Task T19：全文搜索
依赖：T14 已完成

目标：搜索历史会议字幕内容，PostgreSQL 全文搜索。

请完成：

1. Prisma Migration：为 MeetingSegment 添加 search_vector 列
   注意：Prisma 不原生支持 tsvector，需要用 raw SQL migration
   生成文件：prisma/migrations/0002_add_fts/migration.sql
   内容：
   ALTER TABLE meeting_segments
     ADD COLUMN IF NOT EXISTS search_vector tsvector;
   CREATE INDEX IF NOT EXISTS idx_meeting_segments_fts
     ON meeting_segments USING gin(search_vector);
   CREATE OR REPLACE FUNCTION update_segment_search_vector()
   RETURNS trigger AS $$
   BEGIN
     NEW.search_vector := to_tsvector('simple',
       coalesce(NEW.original_text, '') || ' ' ||
       coalesce(NEW.translated_text, '')
     );
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   CREATE TRIGGER segment_search_vector_trigger
     BEFORE INSERT OR UPDATE ON meeting_segments
     FOR EACH ROW EXECUTE FUNCTION update_segment_search_vector();

2. apps/web/lib/search.ts：
   searchMeetings(params: SearchParams): Promise<SearchResult[]>
   - 在 meeting_segments 全文搜索
   - 结果聚合到 meeting 级别
   - 返回：meetingId / meetingTitle / matchCount / snippets[]
   使用 Prisma.$queryRaw

3. API：GET /api/search
   参数：q / orgId / dateFrom / dateTo / limit / cursor
   响应时间目标：< 500ms

4. 页面 app/(dashboard)/history/page.tsx：
   搜索框 + 日期筛选
   结果列表：会议卡片 + 匹配片段高亮（使用 mark 标签）
   空结果引导

5. 高亮实现：
   utils/highlight.ts：highlightText(text, keyword) → ReactNode
   在匹配词周围插入 <mark> 标签

交付要求：
- 搜索至少支持 2000 字/秒的文本量
- 结果按匹配度排序
- 高亮不破坏 XSS 安全（使用 React 渲染，不用 dangerouslySetInnerHTML）
```

### Claude 验收清单

- [ ] Migration SQL 包含 trigger（写入时自动更新 `search_vector`）
- [ ] `Prisma.$queryRaw` 正确使用参数化查询（防注入）
- [ ] 高亮用 React 渲染 `<mark>`，不用 `dangerouslySetInnerHTML`
- [ ] 搜索按组织隔离（不能搜到其他组织的会议）
- [ ] 结果限制（`limit` 参数，最大 50）

---

## T20 · Dashboard & 数据统计

### Codex 指令

```
[全局上下文]

Task T20：Dashboard & 数据统计
依赖：T14 已完成

目标：首页 Dashboard，展示关键指标和最近活动。

请完成：

1. API：GET /api/dashboard/stats
   统计数据（Redis 缓存 5min）：
   - 本月会议数 / 累计会议数
   - 本月翻译时长（分钟）
   - 本月 AI 调用次数
   - 本月 Token 消耗
   - 最近 7 天每日会议数（折线图数据）
   - 语言对分布（饼图数据）
   - 最近 5 个会议

2. 安装：pnpm add recharts

3. 页面 app/(dashboard)/page.tsx：
   欢迎语（用户名）+ 快速开始按钮
   4 个 Stat 卡片：本月会议 / 本月时长 / 本月 AI 调用 / 本月 Token
   折线图：最近 7 天会议趋势（Recharts LineChart）
   饼图：语言对分布（Recharts PieChart）
   最近会议列表（链接到详情）

4. 组件：
   components/dashboard/StatCard.tsx     数字 + 同比变化百分比 + 图标
   components/dashboard/RecentMeetings.tsx

5. 缓存：
   const cacheKey = `dashboard:stats:${orgId}`
   TTL = 300（5min）
   每次创建/结束会议时使缓存失效

交付要求：
- Stat 数据按组织隔离
- 图表响应式（移动端可用）
- 加载时有 Skeleton 占位
- 数据用 SWR 获取（自动刷新）
```

### Claude 验收清单

- [ ] 统计 API 有 Redis 缓存（5min TTL）
- [ ] 统计按 `organizationId` 隔离
- [ ] 图表用 `recharts`，有 Tooltip
- [ ] 骨架屏用 shadcn/ui `Skeleton` 组件
- [ ] 没有会议时显示引导（"创建你的第一个会议"）

---

## T21 · 管理员后台

### Codex 指令

```
[全局上下文]

Task T21：管理员后台
依赖：T06 T20 已完成

目标：超级管理员管理控制台，监控全平台运行状况。

请完成：

1. 路由保护：
   middleware.ts 中，/admin/* 只允许 UserRole.ADMIN 和 SUPER_ADMIN 访问
   其他人返回 403 页面

2. API（均需 admin:access 权限）：
   GET /api/admin/users            用户列表（搜索/分页）
   PATCH /api/admin/users/:id      封禁/解封用户
   GET /api/admin/organizations    组织列表
   GET /api/admin/ai-logs          AI 调用日志（Provider/类型/日期筛选）
   GET /api/admin/stats            全平台统计
   GET /api/admin/health           系统健康检查（DB + Redis + R2）

3. 页面：
   app/(dashboard)/admin/page.tsx              总览 + 健康状态
   app/(dashboard)/admin/users/page.tsx        用户管理
   app/(dashboard)/admin/organizations/page.tsx 组织管理
   app/(dashboard)/admin/logs/page.tsx         AI 调用日志

4. 健康检查响应：
   {
     db: { status: 'ok'|'error', latencyMs: number },
     redis: { status: 'ok'|'error', latencyMs: number },
     r2: { status: 'ok'|'error', latencyMs: number },
     overall: 'healthy'|'degraded'|'down'
   }

交付要求：
- 非管理员访问 /admin 返回 403 页面（友好设计）
- 所有管理操作写 AuditLog
- 健康检查页面每 30s 自动刷新
```

### Claude 验收清单

- [ ] Middleware 正确保护 `/admin/*`（检查 `session.user.role`）
- [ ] 封禁用户后，被封禁用户的 Session 立即失效（写 JWT 黑名单）
- [ ] 健康检查并行执行（`Promise.all`），不串行
- [ ] 管理员操作（封禁用户等）写入 `AuditLog`
- [ ] 错误页面（403）有返回首页链接

---

## T22 · 计费 & 订阅系统（Stripe）

### Codex 指令

```
[全局上下文]

Task T22：计费 & 订阅系统（Stripe）
依赖：T06 已完成

目标：Stripe 订阅集成，计划管理，用量限制。

请完成：

1. 安装：pnpm add stripe @stripe/stripe-js

2. apps/web/lib/stripe.ts：
   getStripeServer() → Stripe 单例（服务端）
   PLANS 配置（见 CODEX_TASKS.md T22 章节）

3. apps/web/lib/quota.ts：
   checkMeetingQuota(orgId): Promise<{ allowed, reason?, plan }>
   checkMemberQuota(orgId): Promise<{ allowed, reason? }>
   getCurrentUsage(orgId): Promise<Usage>

4. API：
   GET  /api/billing/plans              返回所有计划配置和价格
   GET  /api/billing/current            当前订阅状态 + 用量
   POST /api/billing/checkout           创建 Stripe Checkout Session → 返回 URL
   POST /api/billing/portal             创建 Stripe Customer Portal Session
   POST /api/webhooks/stripe            Stripe Webhook（见下方）

5. Stripe Webhook 处理：
   验证签名（Stripe-Signature header）
   处理事件：
     customer.subscription.created  → 更新 Subscription 表
     customer.subscription.updated  → 更新 plan / status
     customer.subscription.deleted  → status → CANCELED
     invoice.payment_succeeded      → 更新 currentPeriodEnd
     invoice.payment_failed         → status → PAST_DUE，发邮件提醒

6. 页面：
   app/(dashboard)/billing/page.tsx    当前计划 + 用量条 + 升级按钮
   app/(dashboard)/billing/plans/page.tsx  定价页（3 个计划对比）

7. 用量检查集成：
   在 POST /api/meetings（创建会议）前调用 checkMeetingQuota
   超出配额返回 429 + 升级引导

交付要求：
- Webhook 必须验签（不验签直接 400）
- 用量条显示：已使用 / 总量（进度条）
- FREE 计划超出配额时，引导页面链接到 /billing/plans
```

### Claude 验收清单

- [ ] Webhook 用 `stripe.webhooks.constructEvent` 验签
- [ ] Checkout 创建时传入 `metadata.organizationId`，Webhook 用此关联组织
- [ ] `checkMeetingQuota` 在创建会议 API 中被调用
- [ ] 超配额返回 `{ error: { code: 'QUOTA_EXCEEDED', ... } }` + 429 状态码
- [ ] `Subscription` 表通过 Webhook 同步（不在 Checkout 成功页同步）
- [ ] Customer Portal URL 是一次性的（Stripe 会失效）

---

## T23 · API Key 管理

### Codex 指令

```
[全局上下文]

Task T23：API Key 管理
依赖：T06 已完成

目标：生成 API Key 供第三方集成，安全存储，权限范围控制。

请完成：

1. apps/web/lib/api-key.ts：
   generateApiKey(): { key: string, hash: string, prefix: string }
   - key 格式：si_live_{64位hex}
   - hash = SHA-256(key)，只存 hash
   - prefix = key 前 12 字符，用于展示（如 si_live_a1b2...）

2. apps/web/lib/api-auth.ts：
   authenticateApiKey(request): Promise<{ org: Organization, scopes: string[] } | null>
   - 从 Authorization: Bearer {key} 提取
   - SHA-256 → 查 ApiKey 表
   - 检查过期时间
   - 更新 lastUsedAt（异步，不阻塞响应）
   - 写 AuditLog

3. API Route Handlers：
   GET    /api/api-keys          列表（只返回 prefix，不返回完整 key）
   POST   /api/api-keys          创建（一次性返回完整 key，此后只展示 prefix）
   PATCH  /api/api-keys/:id      修改名称/到期时间
   DELETE /api/api-keys/:id      删除

4. Scopes 实现：
   ApiKeyScope 枚举（参见 CODEX_TASKS.md T23 章节）
   创建时允许选择 scopes
   Scope 存在 ApiKey.scopes（String[]）

5. 页面 app/(dashboard)/settings/api-keys/page.tsx：
   Key 列表（显示 prefix + 名称 + 最后使用时间 + 到期时间）
   创建后弹出 Modal 展示完整 Key（附"已复制到剪贴板"按钮）
   警告文字："此 Key 只显示一次，请立即保存"

6. API 中间件：
   apps/web/lib/with-api-key-auth.ts
   包装 Route Handler，验证 API Key + Scope

交付要求：
- Key 明文只返回一次，之后不可恢复（只存 hash）
- SHA-256 用 Node.js crypto 模块（不引入第三方库）
- API Key 认证与 Session 认证并行支持（Route Handler 两种都可用）
```

### Claude 验收清单

- [ ] 数据库存 `keyHash`（SHA-256），不存明文 key
- [ ] 创建 API 返回完整 key 后，再次 GET 列表只返回 `keyPrefix`
- [ ] `lastUsedAt` 异步更新（`await` 前不阻塞响应）
- [ ] Scope 检查在 `with-api-key-auth.ts` 中实现
- [ ] 删除 API Key 后立即失效（无缓存）

---

## T24 · Webhook 系统

### Codex 指令

```
[全局上下文]

Task T24：Webhook 系统
依赖：T06 已完成

目标：会议事件触发 Webhook，通知第三方系统。

请完成：

1. apps/web/lib/webhook.ts：
   sendWebhook(webhook: Webhook, event: WebhookEvent, data: unknown)
   - HMAC-SHA256 签名：secret = webhook.secret，payload = JSON.stringify({ event, timestamp, data })
   - 请求头：X-Signature: sha256={signature}, X-Event: {event}
   - 超时：5s
   - 失败重试：最多 3 次，间隔 5s / 30s / 5min（指数退避）
   - 记录发送日志（成功/失败/响应状态码）

2. apps/web/lib/webhook-events.ts：
   triggerWebhooks(orgId, event, data): Promise<void>
   - 查该组织所有 isActive=true 且订阅了该事件的 Webhook
   - 异步触发所有（不阻塞主流程）

3. 在以下位置触发事件：
   POST /api/meetings/:id/start → meeting.started
   POST /api/meetings/:id/end  → meeting.ended
   T18 生成纪要后            → meeting.summary.ready
   T18 导出文件后            → export.ready

4. API Route Handlers：
   GET    /api/webhooks
   POST   /api/webhooks            创建（生成随机 secret，只返回一次）
   PATCH  /api/webhooks/:id
   DELETE /api/webhooks/:id
   POST   /api/webhooks/:id/test   发送测试事件（payload 为 { test: true }）

5. 页面 app/(dashboard)/settings/webhooks/page.tsx：
   Webhook 列表 + 创建按钮
   创建后展示 secret（一次性）
   每个 Webhook 显示最近发送状态

交付要求：
- Webhook secret 只返回一次（类似 API Key）
- 重试逻辑不阻塞主流程（fire and forget）
- 测试端点立即触发，不走重试队列
```

### Claude 验收清单

- [ ] HMAC 签名使用 `crypto.createHmac('sha256', secret)`
- [ ] `triggerWebhooks` 异步执行（主流程不等待）
- [ ] 重试间隔：5s → 30s → 5min（指数退避）
- [ ] 发送日志记录：targetUrl / event / statusCode / latencyMs / error
- [ ] Webhook secret 只在创建时返回，之后不可查看

---

## T25 · 限流 & 安全加固

### Codex 指令

```
[全局上下文]

Task T25：限流 & 安全加固
依赖：T07 已完成

目标：全面的限流和安全防护。

请完成：

1. apps/web/utils/rate-limit.ts：
   基于 Redis sliding window 算法
   rateLimit(identifier: string, action: keyof typeof RATE_LIMITS)
     → Promise<{ success: boolean, remaining: number, resetAt: number, retryAfter?: number }>
   
   RATE_LIMITS 配置（参见 CODEX_TASKS.md T25 章节）
   
   在超出限制时，API 响应：
     429 Too Many Requests
     Headers: X-RateLimit-Limit / X-RateLimit-Remaining / X-RateLimit-Reset / Retry-After

2. apps/web/lib/with-rate-limit.ts：
   withRateLimit(action, getIdentifier)(handler) → 包装 Route Handler
   getIdentifier: (req) => string，默认用 IP，登录后用 userId

3. 在以下 API 应用限流：
   POST /api/auth/login
   POST /api/auth/register
   POST /api/auth/forgot-password
   POST /api/meetings（创建会议）
   POST /api/upload/presigned
   POST /api/translate（如有独立端点）

4. 安全 Headers（next.config.ts headers()）：
   X-Frame-Options: DENY
   X-Content-Type-Options: nosniff
   Referrer-Policy: strict-origin-when-cross-origin
   Permissions-Policy: microphone=(self), camera=(), geolocation=()
   Strict-Transport-Security: max-age=31536000; includeSubDomains

5. apps/web/utils/upload-validation.ts 加固：
   Magic bytes 检测（不只信 Content-Type）
   JPEG: FF D8 FF / PNG: 89 50 4E 47 / WebP: 52 49 46 46

6. CORS 配置（api routes）：
   只允许 NEXT_PUBLIC_APP_URL（生产），localhost（开发）
   预检请求正确处理

交付要求：
- 限流 Key 含动作名，不同动作独立计数
- 限流 Headers 在所有 429 响应中存在
- Content-Security-Policy 针对 Ably/R2 域名白名单
```

### Claude 验收清单

- [ ] Sliding window 用 Redis `ZADD` + `ZREMRANGEBYSCORE`（不用简单 INCR）
- [ ] `Retry-After` header 值为秒数（整数）
- [ ] Magic bytes 检测：读取文件前 12 字节
- [ ] Security headers 在 `next.config.ts` 的 `headers()` 函数中配置（所有路由）
- [ ] IP 限流从 `x-forwarded-for` 读取（Vercel 部署）
- [ ] 限流失败不暴露 Redis 内部错误（catch 后放行，记录日志）

---

## T26 · 日志 & 审计追踪

### Codex 指令

```
[全局上下文]

Task T26：日志 & 审计追踪
依赖：T06 已完成

目标：完整的操作审计，支持查询回溯。

请完成：

1. apps/web/utils/audit.ts：
   auditLog(params: AuditParams): Promise<void>
   - 写入 PostgreSQL AuditLog 表
   - 异步（不阻塞主流程）
   - 提取 request 的 IP（x-forwarded-for）和 User-Agent

2. 在以下位置插入 auditLog 调用：
   用户登录成功/失败 → user.login.success / user.login.failure
   用户注册         → user.register
   密码修改         → user.password.change
   会议创建/开始/结束 → meeting.create / meeting.start / meeting.end
   会议删除         → meeting.delete（包含 meetingId 在 metadata）
   成员邀请/移除    → org.member.invite / org.member.remove
   API Key 创建/删除 → apikey.create / apikey.delete
   管理员操作        → admin.*

3. API（仅管理员）：
   GET /api/admin/audit-logs
   参数：userId / action / resource / dateFrom / dateTo / cursor / limit
   Cursor 分页

4. apps/web/lib/logger.ts 完善：
   添加 request logger 中间件（记录 method/url/status/latencyMs）
   敏感字段 redact：['password', 'token', 'secret', 'authorization', 'cookie']

5. 日志结构化字段规范：
   每条日志必须包含：timestamp / level / msg / requestId（从 headers['x-request-id'] 或随机生成）
   Error 日志必须包含：error.message / error.stack / error.code

交付要求：
- auditLog 异步不阻塞（Promise 不 await，但要 catch 错误）
- Pino redact 配置覆盖所有敏感字段
- 登录失败也要审计（方便检测暴力破解）
```

### Claude 验收清单

- [ ] `auditLog` 不 `await`（fire and forget），但有 `.catch(logger.error)`
- [ ] Pino `redact` 配置包含 `password`, `token`, `secret`, `authorization`
- [ ] `AuditLog` 查询有 `@@index([userId, createdAt])` 加速
- [ ] 登录失败写 `user.login.failure`（含 email 和原因）
- [ ] 审计日志 API 按组织隔离（普通管理员只能查自己组织）

---

## T27 · 性能优化 & 索引

### Codex 指令

```
[全局上下文]

Task T27：性能优化 & 索引
依赖：T02 已完成

目标：数据库查询优化，缓存完善，前端性能提升。

请完成：

1. 数据库索引审计（生成 migration）：
   运行 EXPLAIN ANALYZE 检查以下查询并补充缺失索引：
   - 会议列表（WHERE organizationId = ? ORDER BY createdAt DESC）
   - 字幕列表（WHERE meetingId = ? ORDER BY sequence）
   - AI 日志（WHERE createdAt BETWEEN ? AND ?）
   - 审计日志（WHERE userId = ? ORDER BY createdAt DESC）
   生成：prisma/migrations/0003_performance_indexes/migration.sql

2. 消除 N+1 查询（检查并修复以下接口）：
   - GET /api/meetings（确保用 include 不用多次查询）
   - GET /api/admin/users（关联 _count membership）
   - GET /api/dictionaries/:id/terms（分页，避免先 count 再 select）

3. Redis 缓存补全：
   所有缺少缓存的高频读接口添加缓存：
   - GET /api/users/me                TTL 60s（用户信息变化慢）
   - GET /api/organizations/:id       TTL 60s
   - GET /api/billing/current         TTL 300s

4. Next.js 优化：
   - 会议列表页：添加 revalidate 标签（创建/删除会议时 revalidatePath）
   - Dashboard 图表：懒加载（dynamic import，关闭 SSR）
   - 头像：统一用 next/image，配置 remotePatterns（R2 域名）

5. 性能测试脚本 scripts/perf-test.ts：
   测试以下接口的 P50/P95/P99 响应时间（100 次请求）：
   - GET /api/meetings
   - GET /api/dashboard/stats
   - POST /api/translate

6. 生成性能报告 docs/performance-report.md

交付要求：
- 所有接口 P95 < 500ms（数据库有数据时）
- 无 N+1 查询（Prisma 日志验证）
- 图表组件懒加载（Lighthouse 验证）
```

### Claude 验收清单

- [ ] `migration.sql` 包含新增索引的 `CREATE INDEX IF NOT EXISTS`
- [ ] 会议列表 `include` 避免 N+1（不在循环中查询）
- [ ] `next/image` 配置了 R2 域名的 `remotePatterns`
- [ ] 图表用 `dynamic(() => import(...), { ssr: false })` 懒加载
- [ ] 性能报告存在且有数据

---

## T28 · 部署配置 & CI/CD

### Codex 指令

```
[全局上下文]

Task T28：部署配置 & CI/CD
依赖：T01 已完成

目标：一键部署到 Vercel，GitHub Actions 自动化 CI。

请完成：

1. vercel.json：
   {
     "framework": "nextjs",
     "buildCommand": "pnpm turbo build",
     "installCommand": "pnpm install",
     "regions": ["sin1"],
     "crons": []
   }

2. .github/workflows/ci.yml：
   触发：push to main + PR to main
   步骤：
     - pnpm install
     - pnpm lint（ESLint）
     - pnpm type-check（tsc --noEmit）
     - pnpm test（Vitest，有则运行）
     - pnpm build（构建验证）
   使用 pnpm cache（actions/cache）

3. .github/workflows/deploy.yml：
   触发：push to main（CI 通过后）
   使用 Vercel CLI 部署

4. package.json scripts 完善：
   "dev"        → turbo dev
   "build"      → prisma generate && turbo build
   "start"      → next start
   "lint"       → turbo lint
   "type-check" → tsc --noEmit
   "test"       → vitest run
   "db:migrate" → prisma migrate deploy
   "db:seed"    → ts-node prisma/seed.ts
   "postbuild"  → prisma migrate deploy（Vercel 构建后自动迁移）

5. Cloudflare 配置说明 docs/cloudflare-setup.md：
   - DNS 配置（CNAME 指向 Vercel）
   - Cache Rules（/api/* 不缓存 / /_next/static/* 缓存 1 年）
   - WAF 规则建议

6. 健康检查聚合端点 /api/health：
   并行检查 DB + Redis + R2
   返回 overall 状态 + 各组件延迟

7. 环境变量验证 apps/web/lib/env.ts：
   用 Zod 在启动时验证所有必要环境变量，缺失时抛出清晰错误
   参考：@t3-oss/env-nextjs 或手动实现

8. .github/PULL_REQUEST_TEMPLATE.md：
   包含：变更描述 / 测试方法 / 是否有数据库变更 / 验收清单

交付要求：
- CI 在 PR 时自动运行，失败时阻止合并
- 环境变量缺失时，构建阶段立即失败（不是运行时）
- postbuild 迁移幂等（prisma migrate deploy 可重复运行）
```

### Claude 验收清单

- [ ] `ci.yml` 包含 pnpm cache 步骤（加速构建）
- [ ] `env.ts` 在模块加载时验证，缺失变量立即抛出（不是 undefined）
- [ ] `postbuild` 使用 `prisma migrate deploy`（不是 `migrate dev`）
- [ ] 健康检查用 `Promise.all`（并行，不串行）
- [ ] PR 模板有数据库变更 checklist

---

## 验收工作流（发给 Claude 的格式）

每次 Codex 完成一个 Task，请按以下格式发给 Claude 验收：

```
Task：T0X · [Task 名称]

[将 Codex 生成的代码，或关键文件的内容粘贴在这里]

主要变更文件：
- apps/web/lib/xxx.ts
- apps/web/app/api/xxx/route.ts
- ...
```

Claude 会逐条检查验收清单，给出：
- ✅ 通过的项目
- ❌ 需要修复的问题（含具体说明）
- 🔧 建议改进项（非阻塞）

**全部 ✅ 后，进入下一个 Task。**

---

*本文档由 Claude Cowork 生成 · 2026-06-29*

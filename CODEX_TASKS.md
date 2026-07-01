# Translater Sir 公司内部同声传译工具 — Codex 全量任务文档

> 版本：v1.1 · 日期：2026-07-01  
> 本文档是交给 Codex 的完整开发规范。每个 Task 独立完成、独立测试、独立提交。
> 当前产品定位已调整为公司内部同声传译工具；原 SaaS、计费、API Key、Webhook 相关设计作为后续扩展能力保留。

---

## 总览

### 项目目标

开发公司内部 AI 同声传译工具，核心功能：

- 实时语音识别（ASR）
- AI 实时翻译
- AI TTS 播报
- 实时字幕显示
- 会议录音与记录
- 会议纪要导出（PDF / DOCX / TXT）
- 多语言支持
- 企业术语库
- 用户 / 组织 / 权限系统
- 管理后台与系统健康检查

### 当前范围说明

- 当前主线面向内部会议使用，优先保证会议传译链路、术语库、历史留存、权限和后台运维稳定。
- SaaS 订阅、公开 API Key、Webhook 等模块保留为预留能力，不作为当前产品定位的核心卖点。
- 生产状态总结见 `docs/project-status.md`。

### 技术栈（全局约定，所有 Task 遵守）

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 15 App Router + React + TypeScript |
| UI 组件 | Tailwind CSS + shadcn/ui |
| 后端 | Next.js Route Handler + Server Actions |
| 实时通信 | WebSocket（优先 Edge Runtime） |
| ORM | Prisma |
| 数据库 | PostgreSQL |
| 缓存 | Redis |
| 对象存储 | Cloudflare R2 |
| 身份认证 | NextAuth v5 (Auth.js) |
| 表单验证 | Zod + React Hook Form |
| 日志 | Pino |
| 支付（预留） | Stripe |
| 部署 | Vercel + Cloudflare CDN |

### 全局开发规范（所有 Task 强制执行）

**必须**
- 全量 TypeScript，禁用 `any`
- ESLint + Prettier 格式化
- Prisma Migration（每次 schema 变更）
- Zod 校验所有入参
- Server Actions 用于表单提交
- 所有异常必须捕获并记录
- API 返回统一 `{ data, error, meta }` 结构
- Cursor 分页（禁止 OFFSET 分页超过 10000 条）
- 敏感字段（密码、Token）禁止明文存储或日志输出

**禁止**
- 使用 `any` 类型
- SQL 字符串拼接（全部走 Prisma）
- 未捕获的 Promise rejection
- 硬编码密钥或 URL（全部走环境变量）
- 重复代码（提取公共 util / hook / component）

### 存储分工（全局约定）

| 数据类型 | 存储位置 |
|----------|----------|
| 结构化业务数据 | PostgreSQL |
| Session / JWT 黑名单 / 验证码 / 实时状态 | Redis（必须设置 TTL） |
| 录音、视频、图片、PDF、DOCX 等 >100KB 的文件 | Cloudflare R2 |
| 文件 URL | PostgreSQL 字段 |

### API 统一响应格式

```ts
// 成功
{ "data": T, "error": null, "meta": { "page": 1, "total": 100 } }

// 失败
{ "data": null, "error": { "code": "UNAUTHORIZED", "message": "..." } }
```

---

## 任务总览（28 个独立 Task）

| # | Task | 依赖 |
|---|------|------|
| T01 | 项目初始化 & Monorepo 结构 | — |
| T02 | 数据库 Schema 设计 & Prisma 初始化 | T01 |
| T03 | 身份认证系统（NextAuth v5） | T02 |
| T04 | 用户管理模块 | T03 |
| T05 | 组织 & 团队管理 | T04 |
| T06 | RBAC 权限系统 | T05 |
| T07 | Redis 基础设施 & Session 管理 | T03 |
| T08 | Cloudflare R2 文件存储集成 | T01 |
| T09 | WebSocket 基础设施 | T07 |
| T10 | ASR 语音识别服务集成 | T09 |
| T11 | AI 翻译服务集成 | T10 |
| T12 | TTS 语音合成服务集成 | T11 |
| T13 | 实时字幕系统 | T10 T11 T12 |
| T14 | 会议管理模块 | T06 T09 |
| T15 | 实时传译会议室（核心页面） | T13 T14 |
| T16 | 企业术语库 | T06 |
| T17 | 会议录音 & 文件存储 | T14 T08 |
| T18 | 会议纪要生成 & 导出 | T17 |
| T19 | 全文搜索 | T14 |
| T20 | Dashboard & 数据统计 | T14 |
| T21 | 管理员后台 | T06 T20 |
| T22 | 计费 & 订阅系统（Stripe，预留） | T06 |
| T23 | API Key 管理（内部治理 / 预留开放能力） | T06 |
| T24 | Webhook 系统（预留） | T06 |
| T25 | 限流 & 安全加固 | T07 |
| T26 | 日志 & 审计追踪 | T06 |
| T27 | 性能优化 & 索引 | T02 |
| T28 | 部署配置 & CI/CD | T01 |

---

## 数据库完整 Schema（所有 Task 共用）

```prisma
// 以下为完整 Schema，Task T02 负责建立，后续 Task 按需扩展

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  emailVerified DateTime?
  name          String?
  avatarUrl     String?
  passwordHash  String?
  role          UserRole @default(USER)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  accounts      Account[]
  sessions      Session[]
  memberships   Member[]
  meetings      Meeting[]
  apiKeys       ApiKey[]
  auditLogs     AuditLog[]
}

enum UserRole {
  USER
  ADMIN
  SUPER_ADMIN
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Organization {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  logoUrl     String?
  plan        Plan     @default(FREE)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  members     Member[]
  meetings    Meeting[]
  dictionaries Dictionary[]
  subscriptions Subscription[]
  apiKeys     ApiKey[]
  webhooks    Webhook[]
}

enum Plan {
  FREE
  STARTER
  PROFESSIONAL
  ENTERPRISE
}

model Member {
  id             String     @id @default(cuid())
  userId         String
  organizationId String
  role           MemberRole @default(MEMBER)
  joinedAt       DateTime   @default(now())

  user         User         @relation(fields: [userId], references: [id])
  organization Organization @relation(fields: [organizationId], references: [id])

  @@unique([userId, organizationId])
}

enum MemberRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}

model Meeting {
  id             String        @id @default(cuid())
  organizationId String
  createdById    String
  title          String
  status         MeetingStatus @default(SCHEDULED)
  sourceLanguage String        @default("zh")
  targetLanguage String        @default("en")
  startedAt      DateTime?
  endedAt        DateTime?
  audioUrl       String?       // R2 URL
  summaryUrl     String?       // R2 URL (PDF)
  summaryText    String?       @db.Text
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  organization Organization    @relation(fields: [organizationId], references: [id])
  createdBy    User            @relation(fields: [createdById], references: [id])
  segments     MeetingSegment[]
  files        MeetingFile[]
  aiLogs       AiLog[]
}

enum MeetingStatus {
  SCHEDULED
  LIVE
  PROCESSING
  COMPLETED
  FAILED
}

model MeetingSegment {
  id          String   @id @default(cuid())
  meetingId   String
  sequence    Int
  speakerTag  String?
  originalText String  @db.Text
  translatedText String? @db.Text
  language    String
  startMs     Int
  endMs       Int
  confidence  Float?
  createdAt   DateTime @default(now())

  meeting Meeting @relation(fields: [meetingId], references: [id])

  @@index([meetingId, sequence])
}

model MeetingFile {
  id          String   @id @default(cuid())
  meetingId   String
  type        FileType
  name        String
  url         String   // R2 URL
  sizeBytes   Int
  createdAt   DateTime @default(now())

  meeting Meeting @relation(fields: [meetingId], references: [id])
}

enum FileType {
  AUDIO
  VIDEO
  TRANSCRIPT
  SUMMARY_PDF
  SUMMARY_DOCX
  SUMMARY_TXT
  ATTACHMENT
}

model Dictionary {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  description    String?
  isDefault      Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization    @relation(fields: [organizationId], references: [id])
  terms        DictionaryTerm[]
}

model DictionaryTerm {
  id           String   @id @default(cuid())
  dictionaryId String
  source       String
  target       String
  language     String
  notes        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  dictionary Dictionary @relation(fields: [dictionaryId], references: [id])

  @@index([dictionaryId, source])
}

model AiLog {
  id         String   @id @default(cuid())
  meetingId  String?
  userId     String?
  provider   String
  model      String
  type       AiType
  inputTokens  Int    @default(0)
  outputTokens Int    @default(0)
  latencyMs  Int
  status     String
  error      String?
  createdAt  DateTime @default(now())

  meeting Meeting? @relation(fields: [meetingId], references: [id])
}

enum AiType {
  ASR
  TRANSLATION
  TTS
  SUMMARY
  LLM
}

model Subscription {
  id             String             @id @default(cuid())
  organizationId String
  stripeCustomerId     String?      @unique
  stripeSubscriptionId String?      @unique
  stripePriceId  String?
  status         SubscriptionStatus @default(INACTIVE)
  plan           Plan               @default(FREE)
  currentPeriodStart DateTime?
  currentPeriodEnd   DateTime?
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
}

enum SubscriptionStatus {
  ACTIVE
  INACTIVE
  PAST_DUE
  CANCELED
  TRIALING
}

model ApiKey {
  id             String   @id @default(cuid())
  organizationId String
  userId         String
  name           String
  keyHash        String   @unique
  keyPrefix      String
  lastUsedAt     DateTime?
  expiresAt      DateTime?
  createdAt      DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id])
  user         User         @relation(fields: [userId], references: [id])
}

model Webhook {
  id             String   @id @default(cuid())
  organizationId String
  url            String
  secret         String
  events         String[] // ["meeting.started", "meeting.ended"]
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  action    String
  resource  String
  resourceId String?
  metadata  Json?
  ip        String?
  userAgent String?
  createdAt DateTime @default(now())

  user User? @relation(fields: [userId], references: [id])

  @@index([userId, createdAt])
  @@index([resource, resourceId])
}

model DownloadLog {
  id          String   @id @default(cuid())
  userId      String
  fileUrl     String
  token       String   @unique
  expiresAt   DateTime
  downloadedAt DateTime?
  createdAt   DateTime @default(now())
}
```

---

## 各 Task 详细说明

---

### T01 · 项目初始化 & Monorepo 结构

**目标**：建立可持续扩展的项目骨架，后续所有 Task 在此基础上开发。

**交付物**

```
translater-sir/
├── apps/
│   └── web/                    # Next.js 15 主应用
│       ├── app/
│       │   ├── (auth)/         # 登录注册页（Route Group）
│       │   ├── (dashboard)/    # 登录后页面
│       │   ├── api/            # Route Handlers
│       │   └── layout.tsx
│       ├── components/
│       │   ├── ui/             # shadcn/ui 组件
│       │   └── shared/         # 业务公共组件
│       ├── lib/
│       │   ├── db.ts           # Prisma Client 单例
│       │   ├── redis.ts        # Redis Client 单例
│       │   ├── r2.ts           # R2 Client
│       │   ├── auth.ts         # NextAuth 配置
│       │   └── logger.ts       # Pino 配置
│       ├── hooks/              # React 自定义 Hook
│       ├── types/              # 全局类型定义
│       ├── utils/              # 工具函数
│       └── middleware.ts       # Edge Middleware
├── packages/
│   ├── types/                  # 跨应用共享类型
│   ├── utils/                  # 跨应用工具函数
│   └── ui/                     # （未来）组件库
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── .env.example
├── .eslintrc.json
├── .prettierrc
├── turbo.json
└── package.json
```

**具体步骤**

1. `pnpm create next-app@latest` 配置 App Router + TypeScript + Tailwind
2. 初始化 Turborepo（`packages/types`, `packages/utils`）
3. 安装并初始化 shadcn/ui
4. 配置 ESLint（`@typescript-eslint`, `eslint-config-next`）
5. 配置 Prettier
6. 配置路径别名 `@/` → `apps/web/`
7. 配置 `.env.example`（见下方环境变量清单）
8. 编写 `lib/db.ts`（Prisma Client 单例，防止 Next.js dev 模式重复连接）
9. 编写 `lib/redis.ts`（ioredis 单例）
10. 编写 `lib/r2.ts`（@aws-sdk/client-s3 + R2 endpoint）
11. 编写 `lib/logger.ts`（Pino，production 用 JSON，dev 用 pretty）
12. 编写 `middleware.ts`（路由保护，未登录跳转 /login）

**环境变量清单（`.env.example`）**

```bash
# Database
DATABASE_URL="postgresql://..."

# Redis
REDIS_URL="redis://..."

# Cloudflare R2
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME=""
R2_PUBLIC_URL=""  # CDN 域名

# Auth
NEXTAUTH_SECRET=""
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# AI Services
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
DEEPGRAM_API_KEY=""       # ASR
ELEVENLABS_API_KEY=""     # TTS（可选）

# Stripe（预留）
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_WS_URL="ws://localhost:3000"
```

**验收标准**

- `pnpm dev` 启动无报错
- ESLint + Prettier 检查通过
- 路径别名 `@/` 正常工作
- `lib/db.ts` 导出 Prisma Client 单例
- `lib/redis.ts` 导出 Redis Client 单例
- `lib/r2.ts` 导出 S3 兼容 Client

---

### T02 · 数据库 Schema 设计 & Prisma 初始化

**目标**：建立完整数据库结构，所有后续 Task 的数据基础。

**具体步骤**

1. 将上方完整 Schema 写入 `prisma/schema.prisma`
2. 执行 `prisma migrate dev --name init`
3. 编写 `prisma/seed.ts`：
   - 创建超级管理员账号
   - 创建示例组织
   - 创建示例术语库
4. 为高频查询字段建立索引（见下方索引清单）
5. 编写类型导出文件 `types/prisma.ts`

**必须建立的索引**

```prisma
@@index([organizationId, createdAt])   // Meeting
@@index([meetingId, sequence])         // MeetingSegment
@@index([dictionaryId, source])        // DictionaryTerm
@@index([userId, createdAt])           // AuditLog
@@index([resource, resourceId])        // AuditLog
@@index([keyHash])                     // ApiKey
```

**验收标准**

- `prisma migrate dev` 无报错
- `prisma db seed` 无报错
- `prisma studio` 可以看到所有表
- 所有外键约束正确
- 索引已建立

---

### T03 · 身份认证系统（NextAuth v5）

**目标**：实现登录、注册、OAuth、JWT 管理。

**功能清单**

- 邮箱 + 密码登录
- Google OAuth 登录（可扩展更多 Provider）
- JWT（Access Token 15min + Refresh Token 7d）
- JWT 黑名单（Redis，用于登出）
- 邮箱验证（发送验证邮件）
- 密码重置流程
- 登录失败限流（5次/15min，Redis 计数）

**文件结构**

```
lib/auth.ts                  # NextAuth 配置
app/api/auth/[...nextauth]/route.ts
app/(auth)/login/page.tsx
app/(auth)/login/actions.ts  # Server Action
app/(auth)/register/page.tsx
app/(auth)/register/actions.ts
app/(auth)/forgot-password/page.tsx
app/(auth)/reset-password/page.tsx
components/auth/LoginForm.tsx
components/auth/RegisterForm.tsx
types/auth.ts
utils/password.ts            # bcrypt 封装
utils/token.ts               # JWT 工具
```

**关键实现要点**

```ts
// lib/auth.ts 核心配置
export const authConfig = {
  providers: [
    Credentials({ ... }),
    Google({ ... }),
  ],
  callbacks: {
    jwt({ token, user }) {
      // 将 userId、role、organizationId 注入 token
    },
    session({ session, token }) {
      // 将 token 信息映射到 session
    }
  },
  pages: {
    signIn: '/login',
    error: '/login',
  }
}
```

**Zod Schema**

```ts
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
})

export const RegisterSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(100)
    .regex(/[A-Z]/, '需包含大写字母')
    .regex(/[0-9]/, '需包含数字'),
})
```

**验收标准**

- 邮箱注册 → 发送验证邮件 → 登录成功
- Google 登录成功
- 登录失败 5 次后锁定 15 分钟
- 登出后 JWT 进入黑名单
- `/dashboard` 未登录时重定向到 `/login`

---

### T04 · 用户管理模块

**目标**：用户个人资料、账号设置、头像上传。

**功能清单**

- 查看/编辑个人资料
- 修改密码
- 上传头像（→ R2）
- 账号注销（软删除）
- 个人 AI Provider 设置（可覆盖组织设置）

**API**

```
GET    /api/users/me           # 获取当前用户
PATCH  /api/users/me           # 更新个人资料
POST   /api/users/me/avatar    # 上传头像
POST   /api/users/me/password  # 修改密码
DELETE /api/users/me           # 注销账号
```

**页面**

```
app/(dashboard)/settings/profile/page.tsx
app/(dashboard)/settings/security/page.tsx
```

**验收标准**

- 头像上传到 R2，数据库保存 URL
- 修改密码需验证旧密码
- 所有字段 Zod 校验

---

### T05 · 组织 & 团队管理

**目标**：多租户组织结构，支持邀请成员。

**功能清单**

- 创建组织
- 邀请成员（邮件邀请链接，Token 存 Redis，24h 有效）
- 查看成员列表
- 修改成员角色（OWNER / ADMIN / MEMBER / VIEWER）
- 移除成员
- 离开组织
- 组织设置（名称、Logo → R2）
- 组织切换（用户可属于多个组织）

**API**

```
POST   /api/organizations                        # 创建组织
GET    /api/organizations/:id                    # 获取组织信息
PATCH  /api/organizations/:id                    # 更新组织
GET    /api/organizations/:id/members            # 成员列表
POST   /api/organizations/:id/members/invite     # 发送邀请
PATCH  /api/organizations/:id/members/:memberId  # 修改角色
DELETE /api/organizations/:id/members/:memberId  # 移除成员
POST   /api/invitations/:token/accept            # 接受邀请
```

**页面**

```
app/(dashboard)/settings/organization/page.tsx
app/(dashboard)/settings/members/page.tsx
app/(dashboard)/invitations/[token]/page.tsx
```

**邀请 Token 逻辑**

```ts
// 邀请链接 Token 存 Redis
const token = crypto.randomUUID()
await redis.setex(
  `invitation:${token}`,
  86400, // 24h
  JSON.stringify({ orgId, email, role, invitedBy })
)
```

**验收标准**

- 邀请邮件链接有效期 24h
- 接受邀请后自动加入组织
- 组织 Logo 上传到 R2

---

### T06 · RBAC 权限系统

**目标**：细粒度角色权限控制，所有后续 Task 的权限基础。

**角色权限矩阵**

| 权限 | OWNER | ADMIN | MEMBER | VIEWER |
|------|-------|-------|--------|--------|
| 创建会议 | ✅ | ✅ | ✅ | ❌ |
| 删除会议 | ✅ | ✅ | 仅自己 | ❌ |
| 管理成员 | ✅ | ✅ | ❌ | ❌ |
| 管理术语库 | ✅ | ✅ | ✅ | ❌ |
| 查看账单 | ✅ | ✅ | ❌ | ❌ |
| 管理 API Key | ✅ | ✅ | ❌ | ❌ |

**核心实现**

```ts
// utils/permissions.ts
export type Permission =
  | 'meeting:create'
  | 'meeting:delete'
  | 'meeting:view'
  | 'member:manage'
  | 'dictionary:manage'
  | 'billing:view'
  | 'apikey:manage'
  | 'admin:access'

export function can(role: MemberRole, permission: Permission): boolean {
  const matrix: Record<MemberRole, Permission[]> = {
    OWNER:  ['meeting:create', 'meeting:delete', 'meeting:view', 'member:manage', 'dictionary:manage', 'billing:view', 'apikey:manage', 'admin:access'],
    ADMIN:  ['meeting:create', 'meeting:delete', 'meeting:view', 'member:manage', 'dictionary:manage', 'billing:view', 'apikey:manage'],
    MEMBER: ['meeting:create', 'meeting:view', 'dictionary:manage'],
    VIEWER: ['meeting:view'],
  }
  return matrix[role]?.includes(permission) ?? false
}
```

**Server Action 中的权限检查**

```ts
// 每个需要权限的 Action 都这样写
export async function deleteMeeting(meetingId: string) {
  const session = await auth()
  if (!session) throw new Error('UNAUTHORIZED')

  const member = await getMember(session.user.id, session.user.organizationId)
  if (!can(member.role, 'meeting:delete')) throw new Error('FORBIDDEN')

  // ...业务逻辑
}
```

**中间件保护**

```ts
// middleware.ts
export const config = {
  matcher: ['/dashboard/:path*', '/api/((?!auth).*)']
}
```

**验收标准**

- `can()` 函数单元测试覆盖所有权限组合
- Server Action 权限检查测试
- 无权限时返回 403

---

### T07 · Redis 基础设施 & Session 管理

**目标**：建立 Redis 规范，管理所有缓存 Key 和 TTL。

**Key 命名规范（所有 Task 遵守）**

```
session:{sessionId}              TTL: 7d
jwt:blacklist:{jti}              TTL: 15min（与 Access Token 等长）
verification:{token}             TTL: 24h
invitation:{token}               TTL: 24h
reset-password:{token}           TTL: 1h
ratelimit:{action}:{identifier}  TTL: 按规则设定
meeting:subtitle:{meetingId}     TTL: 会议结束后 30min
meeting:status:{meetingId}       TTL: 会议结束后 30min
meeting:online:{meetingId}       TTL: 会议结束后 30min
ws:connection:{connectionId}     TTL: 30min（心跳刷新）
translate:cache:{hash}           TTL: 1h
ai:context:{meetingId}           TTL: 会议结束后 1h
download:token:{token}           TTL: 5min
```

**封装 Redis 工具**

```ts
// utils/redis-keys.ts
export const RedisKeys = {
  session: (id: string) => `session:${id}`,
  jwtBlacklist: (jti: string) => `jwt:blacklist:${jti}`,
  rateLimit: (action: string, id: string) => `ratelimit:${action}:${id}`,
  meetingSubtitle: (id: string) => `meeting:subtitle:${id}`,
  meetingStatus: (id: string) => `meeting:status:${id}`,
  translateCache: (hash: string) => `translate:cache:${hash}`,
  downloadToken: (token: string) => `download:token:${token}`,
} as const
```

**验收标准**

- 所有 Redis Key 使用 `RedisKeys` 工具生成
- 所有 Key 设置 TTL（`setex` 或 `expire`）
- 编写 Redis 健康检查 `/api/health/redis`

---

### T08 · Cloudflare R2 文件存储集成

**目标**：封装 R2 上传/下载/删除，支持预签名 URL。

**功能清单**

- 上传文件到 R2
- 生成预签名上传 URL（前端直传，减少服务器带宽）
- 生成预签名下载 URL（5min 有效，存 Redis）
- 删除文件
- 按目录组织文件

**R2 目录结构**

```
organizations/{orgId}/
  avatars/{userId}.jpg
  logos/{orgId}.jpg
  meetings/{meetingId}/
    audio/recording.mp3
    exports/summary.pdf
    exports/summary.docx
    exports/transcript.txt
    attachments/{fileId}.{ext}
  logs/{year}/{month}/{day}/
```

**封装**

```ts
// lib/r2.ts
export async function uploadToR2(
  key: string,
  body: Buffer | Readable,
  contentType: string
): Promise<string>  // 返回 R2 公网 URL

export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 300
): Promise<string>

export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 300
): Promise<string>

export async function deleteFromR2(key: string): Promise<void>
```

**文件上传限制**

```ts
// utils/upload-validation.ts
export const ALLOWED_AUDIO_TYPES = ['audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg']
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_AUDIO_SIZE = 500 * 1024 * 1024  // 500MB
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024    // 5MB
```

**API**

```
POST /api/upload/presigned    # 获取预签名上传 URL
POST /api/upload/confirm      # 确认上传成功，写入数据库
GET  /api/download/:fileId    # 获取临时下载 URL（5min Token）
```

**验收标准**

- 前端直传 R2（通过预签名 URL）
- 下载 Token 存 Redis，5min 后失效
- 文件类型和大小校验
- R2 健康检查 `/api/health/r2`

---

### T09 · WebSocket 基础设施

**目标**：建立稳定的 WebSocket 服务，支持会议实时通信。

**技术选型**

- Vercel 上使用 Ably / Pusher / Cloudflare Durable Objects 作为 WebSocket 服务（Vercel Serverless 不支持原生 WebSocket 长连接）
- 开发环境用 `ws` 库
- 推荐：Ably（免费额度充足，Edge 友好）

**消息协议**

```ts
// types/websocket.ts
export type WsMessage =
  | { type: 'subtitle'; data: SubtitlePayload }
  | { type: 'translation'; data: TranslationPayload }
  | { type: 'meeting:status'; data: MeetingStatusPayload }
  | { type: 'audio:chunk'; data: AudioChunkPayload }
  | { type: 'error'; data: ErrorPayload }
  | { type: 'ping' }
  | { type: 'pong' }

export interface SubtitlePayload {
  segmentId: string
  text: string
  isFinal: boolean
  language: string
  timestamp: number
}

export interface TranslationPayload {
  segmentId: string
  originalText: string
  translatedText: string
  sourceLanguage: string
  targetLanguage: string
}
```

**React Hook**

```ts
// hooks/useWebSocket.ts
export function useWebSocket(meetingId: string) {
  // 自动连接、自动重连（指数退避，最多 5 次）
  // 连接状态管理
  // 消息订阅
  // 发送消息
  // 组件卸载时自动断开
}
```

**验收标准**

- 连接断开后自动重连
- 心跳检测（每 30s ping/pong）
- 连接状态 UI 展示（已连接 / 重连中 / 已断开）

---

### T10 · ASR 语音识别服务集成

**目标**：对接 Deepgram（主）/ Whisper API（备），实时转文字。

**支持的 AI Provider**

```ts
export type AsrProvider = 'deepgram' | 'openai-whisper' | 'google-speech'
```

**核心流程**

```
浏览器 MediaRecorder
  → 采集音频（WebM/Opus，chunk 250ms）
  → WebSocket 发送 audio:chunk
  → 服务端收到 chunk
  → 转发 Deepgram Streaming API
  → Deepgram 返回实时转录
  → 写入 Redis meeting:subtitle:{meetingId}
  → 通过 WebSocket 推送给所有订阅者
  → is_final=true 时写入 PostgreSQL MeetingSegment
```

**Deepgram 集成**

```ts
// lib/asr/deepgram.ts
import { createClient } from '@deepgram/sdk'

export async function startDeepgramStream(
  meetingId: string,
  language: string,
  onTranscript: (result: TranscriptResult) => void
)
```

**前端音频采集**

```ts
// hooks/useAudioCapture.ts
export function useAudioCapture() {
  // MediaRecorder + AudioContext
  // 采集 WebM/Opus，每 250ms 发送一个 chunk
  // 音量可视化数据（用于 UI 展示）
  // 静音检测（>3s 静音自动暂停发送）
  return { start, stop, pause, resume, audioLevel }
}
```

**验收标准**

- 实时转录延迟 < 300ms
- 支持中英文切换
- 静音超过 3s 不发送空数据
- ASR 调用记录写入 `AiLog` 表

---

### T11 · AI 翻译服务集成

**目标**：对接 OpenAI / DeepL / Google Translate，术语库优先匹配。

**术语库优先逻辑**

```ts
// 翻译前先查术语库
async function translateWithGlossary(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  organizationId: string
): Promise<string> {
  // 1. 从 Redis 读取术语库缓存（5min TTL）
  // 2. 若术语库命中，替换文本中的术语
  // 3. 调用 AI 翻译，带上替换提示
  // 4. 翻译结果存入 Redis translate:cache:{hash}（1h TTL）
}
```

**翻译缓存（避免重复调用）**

```ts
const hash = md5(`${text}:${source}:${target}:${orgId}`)
const cached = await redis.get(RedisKeys.translateCache(hash))
if (cached) return cached
```

**支持的语言对**

```ts
export const SUPPORTED_LANGUAGE_PAIRS = [
  { source: 'zh', target: 'en', label: '中文 → 英文' },
  { source: 'en', target: 'zh', label: '英文 → 中文' },
  { source: 'zh', target: 'ja', label: '中文 → 日文' },
  { source: 'ja', target: 'zh', label: '日文 → 中文' },
  { source: 'en', target: 'ja', label: '英文 → 日文' },
  // ... 更多语言对
]
```

**验收标准**

- 翻译延迟 < 800ms（含网络）
- 术语库命中率记录到日志
- 缓存命中时不调用 AI API
- 翻译调用记录写入 `AiLog` 表

---

### T12 · TTS 语音合成服务集成

**目标**：将翻译文本转成语音播报，支持音量/语速调节。

**支持的 Provider**

```ts
export type TtsProvider = 'openai' | 'elevenlabs' | 'azure-tts' | 'google-tts'
```

**核心 API**

```ts
// lib/tts/index.ts
export async function synthesizeSpeech(
  text: string,
  language: string,
  options: TtsOptions
): Promise<AudioBuffer>

interface TtsOptions {
  provider: TtsProvider
  voice?: string
  speed?: number   // 0.5 ~ 2.0
  volume?: number  // 0 ~ 1
}
```

**前端播放**

```ts
// hooks/useTtsPlayer.ts
export function useTtsPlayer() {
  // 播放队列（防止多段音频重叠）
  // 音量控制
  // 静音开关
  // 播放进度
  return { play, stop, setVolume, isMuted, toggle }
}
```

**验收标准**

- TTS 播放不与原声重叠（原声静音时播放）
- 支持静音开关
- TTS 调用记录写入 `AiLog` 表

---

### T13 · 实时字幕系统

**目标**：实时显示 ASR 原文 + 翻译结果字幕，流畅无闪烁。

**字幕组件设计**

```tsx
// components/subtitle/SubtitleDisplay.tsx
interface SubtitleDisplayProps {
  meetingId: string
  showOriginal: boolean
  showTranslation: boolean
  fontSize: 'sm' | 'md' | 'lg' | 'xl'
  position: 'bottom' | 'top' | 'floating'
}

// 字幕滚动逻辑：
// - 非 final 的段落显示为半透明（实时预览）
// - final 确认后变为不透明
// - 超过 5 行自动滚动
// - 平滑过渡动画（framer-motion 或 CSS transition）
```

**字幕历史**

```tsx
// components/subtitle/SubtitleHistory.tsx
// 展示历史字幕列表，支持搜索
// 点击某段字幕可跳转到对应录音时间点
```

**验收标准**

- 字幕延迟 < 500ms
- 非 final 字幕有视觉区分（半透明）
- 字体大小可调
- 双语字幕同时显示

---

### T14 · 会议管理模块

**目标**：会议的创建、开始、结束、详情、列表。

**功能清单**

- 创建会议（设置源语言、目标语言、标题）
- 开始会议（状态改为 LIVE，记录开始时间）
- 结束会议（状态改为 PROCESSING，触发后处理）
- 会议列表（分页、筛选、搜索）
- 会议详情（字幕、录音、导出文件）
- 删除会议（同时删除 R2 文件）

**API**

```
GET    /api/meetings              # 列表（Cursor 分页）
POST   /api/meetings              # 创建
GET    /api/meetings/:id          # 详情
PATCH  /api/meetings/:id          # 更新
DELETE /api/meetings/:id          # 删除
POST   /api/meetings/:id/start    # 开始
POST   /api/meetings/:id/end      # 结束
GET    /api/meetings/:id/segments # 字幕列表（Cursor 分页）
```

**Cursor 分页实现**

```ts
// utils/pagination.ts
export async function cursorPaginate<T>(
  query: (cursor: string | undefined, limit: number) => Promise<T[]>,
  cursor: string | undefined,
  limit: number = 20
): Promise<{ items: T[]; nextCursor: string | undefined }>
```

**页面**

```
app/(dashboard)/meetings/page.tsx           # 列表
app/(dashboard)/meetings/new/page.tsx       # 创建
app/(dashboard)/meetings/[id]/page.tsx      # 详情
```

**验收标准**

- 列表使用 Cursor 分页，不使用 OFFSET
- 会议结束后触发后处理任务（生成纪要）
- 删除会议时同步删除 R2 文件

---

### T15 · 实时传译会议室（核心页面）

**目标**：整合 ASR + 翻译 + 字幕 + TTS 的核心功能页面。

**页面布局**

```
┌─────────────────────────────────────────────┐
│  会议标题    状态指示器    结束会议按钮         │
├──────────────────────┬──────────────────────┤
│                      │  控制面板             │
│   实时字幕区          │  ─────────────────── │
│                      │  麦克风开关            │
│   原文 (zh)          │  音量调节             │
│   译文 (en)          │  语速调节             │
│                      │  字体大小             │
│                      │  TTS 开关            │
│                      │  ─────────────────── │
│                      │  连接状态             │
│                      │  在线人数             │
├──────────────────────┴──────────────────────┤
│  音频波形可视化                               │
└─────────────────────────────────────────────┘
```

**组件结构**

```
app/(dashboard)/meetings/[id]/live/page.tsx
components/meeting/
  MeetingRoom.tsx          # 顶层容器
  SubtitleDisplay.tsx      # 字幕区
  AudioVisualizer.tsx      # 波形可视化
  MeetingControls.tsx      # 控制面板
  ConnectionStatus.tsx     # 连接状态
  ParticipantCount.tsx     # 在线人数
```

**状态管理（Zustand）**

```ts
// stores/meeting.store.ts
interface MeetingStore {
  status: 'idle' | 'connecting' | 'live' | 'paused' | 'ended'
  isRecording: boolean
  isMuted: boolean
  ttsEnabled: boolean
  volume: number
  subtitles: Subtitle[]
  // actions
  startMeeting: () => void
  endMeeting: () => void
  toggleMute: () => void
  toggleTts: () => void
}
```

**验收标准**

- 页面加载后自动请求麦克风权限
- 断网后自动重连并显示提示
- 会议结束后跳转到详情页
- 移动端响应式布局

---

### T16 · 企业术语库

**目标**：支持企业自定义专业术语，翻译时优先匹配。

**功能清单**

- 创建术语库
- 批量导入术语（CSV 上传）
- 手动添加/编辑/删除术语
- 设为默认术语库
- 术语搜索
- 导出术语库（CSV）

**CSV 导入格式**

```csv
source,target,language,notes
人工智能,Artificial Intelligence,en,AI 领域核心术语
机器学习,Machine Learning,en,
深度学习,Deep Learning,en,
```

**API**

```
GET    /api/dictionaries              # 列表
POST   /api/dictionaries              # 创建
GET    /api/dictionaries/:id          # 详情
PATCH  /api/dictionaries/:id          # 更新
DELETE /api/dictionaries/:id          # 删除
GET    /api/dictionaries/:id/terms    # 术语列表
POST   /api/dictionaries/:id/terms    # 添加术语
PATCH  /api/dictionaries/:id/terms/:termId
DELETE /api/dictionaries/:id/terms/:termId
POST   /api/dictionaries/:id/import   # CSV 导入
GET    /api/dictionaries/:id/export   # CSV 导出
```

**缓存策略**

```ts
// 组织术语库缓存到 Redis，5min TTL
// 会议开始时预加载到 Redis
const cacheKey = `glossary:${organizationId}:${sourceLanguage}:${targetLanguage}`
```

**验收标准**

- CSV 导入支持 1000 条以上
- 术语列表支持搜索和分页
- 会议中术语库变更实时生效（下一个翻译请求即生效）

---

### T17 · 会议录音 & 文件存储

**目标**：录制会议音频，上传到 R2，管理会议文件。

**录音流程**

```
浏览器 MediaRecorder
  → 录制完整音频流
  → 会议结束后
  → 合并音频 chunks
  → 上传到 R2
  → 写入 MeetingFile 表
  → 更新 Meeting.audioUrl
```

**前端录音 Hook**

```ts
// hooks/useMediaRecorder.ts
export function useMediaRecorder(meetingId: string) {
  // 开始录制
  // 暂停/恢复
  // 停止并上传
  // 上传进度
  return { start, stop, pause, resume, uploadProgress, audioBlob }
}
```

**上传进度**

```ts
// 使用 XMLHttpRequest 实现进度监听
// 大文件（>10MB）使用 R2 Multipart Upload
```

**API**

```
GET  /api/meetings/:id/files          # 文件列表
POST /api/meetings/:id/files/audio    # 上传录音（会议结束后）
DELETE /api/meetings/:id/files/:fileId
```

**验收标准**

- 支持 500MB 以内音频文件上传
- 上传过程显示进度条
- 上传失败支持重试
- 文件删除时同步删除 R2 对象

---

### T18 · 会议纪要生成 & 导出

**目标**：用 LLM 生成结构化会议纪要，导出为 PDF/DOCX/TXT。

**生成流程**

```
会议结束
  → 读取所有 MeetingSegment
  → 拼接原文 + 译文
  → 调用 LLM（GPT-4o / Claude）
  → 提示词：生成纪要（含主题、要点、决策、待办）
  → 结构化输出（JSON Schema）
  → 生成 PDF（Puppeteer / @react-pdf/renderer）
  → 生成 DOCX（docx 库）
  → 上传到 R2
  → 写入 MeetingFile 表
  → 更新 Meeting.summaryUrl
```

**纪要结构**

```ts
interface MeetingSummary {
  title: string
  date: string
  duration: string
  participants: string[]
  overview: string
  keyPoints: string[]
  decisions: string[]
  actionItems: Array<{
    task: string
    owner?: string
    deadline?: string
  }>
  transcript: Array<{
    timestamp: string
    original: string
    translation: string
  }>
}
```

**导出 API**

```
POST /api/meetings/:id/summary/generate   # 触发生成
GET  /api/meetings/:id/summary            # 获取纪要内容
GET  /api/meetings/:id/export/pdf         # 下载 PDF（临时 Token）
GET  /api/meetings/:id/export/docx        # 下载 DOCX
GET  /api/meetings/:id/export/txt         # 下载 TXT
```

**验收标准**

- LLM 生成纪要 < 30s
- PDF 格式规范，含标题/页码/Logo
- 下载 Token 5min 有效
- 记录到 `DownloadLog` 表

---

### T19 · 全文搜索

**目标**：搜索历史会议的字幕内容和纪要。

**技术方案**

- PostgreSQL `tsvector` 全文搜索（无需额外服务）
- 中文支持：使用 `pg_jieba` 或在应用层分词后存储

**Schema 扩展**

```sql
-- 为 MeetingSegment 添加全文搜索向量
ALTER TABLE meeting_segments
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(original_text, '')) ||
    to_tsvector('english', coalesce(translated_text, ''))
  ) STORED;

CREATE INDEX idx_meeting_segments_fts
  ON meeting_segments USING gin(search_vector);
```

**API**

```
GET /api/search?q=keyword&orgId=...&dateFrom=...&dateTo=...
```

**页面**

```
app/(dashboard)/history/page.tsx     # 搜索历史会议
```

**验收标准**

- 搜索响应 < 500ms
- 支持跨会议搜索
- 高亮显示匹配词

---

### T20 · Dashboard & 数据统计

**目标**：展示会议统计、使用量、AI 调用情况。

**统计指标**

```ts
interface DashboardStats {
  // 本月数据
  meetingsThisMonth: number
  hoursTranslatedThisMonth: number
  aiCallsThisMonth: number
  tokensUsedThisMonth: number
  // 趋势（最近 7 天）
  dailyMeetings: Array<{ date: string; count: number }>
  // 语言对分布
  languagePairStats: Array<{ pair: string; count: number }>
  // 最近会议
  recentMeetings: Meeting[]
}
```

**API**

```
GET /api/dashboard/stats       # 统计数据（缓存 5min）
GET /api/dashboard/usage       # 详细使用量
```

**图表库**：Recharts（轻量，已在 Next.js 中使用广泛）

**验收标准**

- 统计数据缓存 5min（Redis）
- 图表响应式
- 数据按组织隔离

---

### T21 · 管理员后台

**目标**：超级管理员管理所有组织、用户、AI 调用监控。

**功能清单**

- 用户列表（搜索、封禁、重置密码）
- 组织列表（查看、暂停）
- AI 调用日志（按 Provider、模型、日期筛选）
- 全局统计（总会议数、总翻译字数、总 Token 消耗）
- 系统健康检查

**路由保护**

```ts
// 只有 UserRole.ADMIN 和 SUPER_ADMIN 可访问
// middleware.ts 中检查
```

**API**

```
GET /api/admin/users
GET /api/admin/organizations
GET /api/admin/ai-logs
GET /api/admin/stats
GET /api/admin/health
```

**页面**

```
app/(dashboard)/admin/page.tsx
app/(dashboard)/admin/users/page.tsx
app/(dashboard)/admin/organizations/page.tsx
app/(dashboard)/admin/logs/page.tsx
```

**验收标准**

- 非管理员访问返回 403
- 日志列表支持分页和筛选
- 健康检查覆盖 DB / Redis / R2

---

### T22 · 计费 & 订阅系统（Stripe）

**目标**：Stripe 订阅集成，计划管理，用量限制。

**计划配置**

```ts
export const PLANS = {
  FREE: {
    meetingsPerMonth: 5,
    minutesPerMeeting: 30,
    aiCallsPerMonth: 100,
    membersLimit: 3,
  },
  STARTER: {
    meetingsPerMonth: 50,
    minutesPerMeeting: 120,
    aiCallsPerMonth: 5000,
    membersLimit: 10,
    price: 29,  // USD/month
  },
  PROFESSIONAL: {
    meetingsPerMonth: -1,  // unlimited
    minutesPerMeeting: 480,
    aiCallsPerMonth: -1,
    membersLimit: 50,
    price: 99,
  },
  ENTERPRISE: {
    meetingsPerMonth: -1,
    minutesPerMeeting: -1,
    aiCallsPerMonth: -1,
    membersLimit: -1,
    price: null,  // 联系销售
  },
}
```

**Stripe Webhook 处理**

```
POST /api/webhooks/stripe
处理事件：
  customer.subscription.created
  customer.subscription.updated
  customer.subscription.deleted
  invoice.payment_succeeded
  invoice.payment_failed
```

**用量检查**

```ts
// 每次创建会议前检查配额
async function checkMeetingQuota(organizationId: string): Promise<boolean>
```

**页面**

```
app/(dashboard)/billing/page.tsx       # 订阅管理
app/(dashboard)/billing/upgrade/page.tsx
```

**验收标准**

- Stripe Webhook 验签
- 订阅状态实时同步到数据库
- 超出配额时给出友好提示和升级引导

---

### T23 · API Key 管理

**目标**：为第三方集成提供 API Key，支持权限范围控制。

**Key 格式**

```
si_live_xxxxxxxxxxxxxxxxxxxxxxxx   # 生产环境
si_test_xxxxxxxxxxxxxxxxxxxxxxxx   # 测试环境
```

**安全存储**

```ts
// 只存储 Hash，不存明文
const key = `si_live_${crypto.randomBytes(32).toString('hex')}`
const keyHash = sha256(key)
const keyPrefix = key.substring(0, 12)  // 用于展示

// 数据库存 keyHash + keyPrefix
// 明文只在创建时返回一次
```

**权限范围（Scopes）**

```ts
export type ApiKeyScope =
  | 'meetings:read'
  | 'meetings:write'
  | 'segments:read'
  | 'dictionaries:read'
  | 'dictionaries:write'
```

**API 认证中间件**

```ts
// 请求头：Authorization: Bearer si_live_xxx
// 1. 提取 Token
// 2. 计算 Hash
// 3. 查数据库
// 4. 检查过期时间
// 5. 检查 Scope
// 6. 记录使用时间
```

**验收标准**

- API Key 只在创建时显示一次明文
- 过期时间可选（永久或指定日期）
- 每次使用更新 `lastUsedAt`

---

### T24 · Webhook 系统

**目标**：会议事件触发 Webhook，通知第三方系统。

**支持的事件**

```ts
export type WebhookEvent =
  | 'meeting.started'
  | 'meeting.ended'
  | 'meeting.summary.ready'
  | 'export.ready'
```

**Webhook Payload**

```ts
interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  data: Record<string, unknown>
  signature: string  // HMAC-SHA256
}
```

**发送逻辑**

```ts
// 发送带签名的 Webhook
// 失败重试（指数退避，最多 3 次）
// 记录发送日志
async function sendWebhook(webhook: Webhook, event: WebhookEvent, data: unknown)
```

**API**

```
GET    /api/webhooks         # 列表
POST   /api/webhooks         # 创建
PATCH  /api/webhooks/:id     # 更新
DELETE /api/webhooks/:id     # 删除
POST   /api/webhooks/:id/test  # 发送测试事件
```

**验收标准**

- Webhook 签名可验证
- 失败重试最多 3 次，间隔 5s/30s/5min
- 发送日志保留 30 天

---

### T25 · 限流 & 安全加固

**目标**：防止滥用，加固安全边界。

**限流规则**

```ts
export const RATE_LIMITS = {
  'auth:login':        { max: 5,    window: 900  },  // 5次/15min
  'auth:register':     { max: 3,    window: 3600 },  // 3次/1h
  'auth:forgot':       { max: 3,    window: 3600 },  // 3次/1h
  'api:global':        { max: 100,  window: 60   },  // 100次/min
  'api:meeting:create':{ max: 10,   window: 3600 },  // 10次/1h
  'api:upload':        { max: 20,   window: 3600 },  // 20次/1h
  'webhook:send':      { max: 1000, window: 3600 },  // 1000次/1h
}
```

**实现方式**

```ts
// utils/rate-limit.ts
// 使用 Redis sliding window 算法
export async function rateLimit(
  identifier: string,
  action: keyof typeof RATE_LIMITS
): Promise<{ success: boolean; remaining: number; resetAt: number }>
```

**安全 Headers（Next.js `next.config.ts`）**

```ts
headers: [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'microphone=(self)' },
  { key: 'Content-Security-Policy', value: "..." },
]
```

**CSRF 保护**

- Next.js Server Actions 内置 CSRF Token
- Route Handler 使用 `Origin` 头验证

**验收标准**

- 所有 Auth API 有限流
- 安全 Headers 通过 securityheaders.com 测试
- 文件上传有类型和大小校验

---

### T26 · 日志 & 审计追踪

**目标**：记录所有关键操作，支持审计查询。

**日志级别**

```ts
// lib/logger.ts (Pino)
// development: pretty print
// production: JSON to stdout (Vercel 收集)
```

**需要审计的操作**

```
user.login / user.logout / user.register
user.password.change / user.account.delete
org.create / org.member.invite / org.member.remove
meeting.start / meeting.end / meeting.delete
apikey.create / apikey.delete
billing.subscribe / billing.cancel
admin.user.ban
```

**审计记录函数**

```ts
// utils/audit.ts
export async function auditLog(params: {
  userId?: string
  action: string
  resource: string
  resourceId?: string
  metadata?: Record<string, unknown>
  request?: Request
}): Promise<void>
```

**API**

```
GET /api/admin/audit-logs?userId=&action=&dateFrom=&dateTo=
```

**验收标准**

- 所有关键操作有审计记录
- 审计日志不可删除（只读）
- 支持按用户/操作/日期筛选

---

### T27 · 性能优化 & 索引

**目标**：确保系统在高并发下稳定运行。

**数据库优化**

```sql
-- 验证所有索引已建立
EXPLAIN ANALYZE SELECT * FROM meeting_segments
  WHERE meeting_id = '...' ORDER BY sequence LIMIT 50;

-- 确认无全表扫描（Seq Scan on large tables）
```

**N+1 查询检查**

```ts
// 使用 Prisma 的 include 替代多次查询
const meetings = await prisma.meeting.findMany({
  include: {
    createdBy: { select: { name: true, avatarUrl: true } },
    _count: { select: { segments: true } },
  }
})
```

**Redis 缓存清单**

```ts
// 以下数据必须缓存：
// - Dashboard 统计（5min）
// - 术语库（5min）
// - 用户权限（1min）
// - 翻译结果（1h）
```

**Next.js 缓存策略**

```ts
// 静态页面：Landing、文档
export const revalidate = 3600

// 动态数据：Dashboard
export const dynamic = 'force-dynamic'

// 会议列表：按需重验证
revalidatePath('/dashboard/meetings')
```

**图片优化**

```ts
// 所有图片使用 next/image
// R2 图片通过 Cloudflare CDN 分发
// 头像压缩为 WebP，最大 200x200
```

**验收标准**

- Lighthouse 性能分数 > 85
- 页面首次加载 < 2s（FCP）
- API 响应 P95 < 500ms
- 数据库无慢查询（> 100ms）

---

### T28 · 部署配置 & CI/CD

**目标**：一键部署到 Vercel，自动化 CI/CD 流程。

**Vercel 配置**

```json
// vercel.json
{
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "regions": ["sin1", "hkg1"],  // 新加坡 + 香港
  "env": { ... }
}
```

**环境清单**

```
production  → main 分支
preview     → PR 自动创建
development → 本地
```

**GitHub Actions CI**

```yaml
# .github/workflows/ci.yml
on: [push, pull_request]
jobs:
  ci:
    steps:
      - checkout
      - pnpm install
      - pnpm lint          # ESLint
      - pnpm type-check    # tsc --noEmit
      - pnpm test          # Vitest
      - pnpm build         # Next.js build
```

**数据库迁移策略**

```bash
# 部署前自动运行
# vercel.json 或 package.json
"postbuild": "prisma migrate deploy"
```

**Cloudflare 配置**

```
DNS: CNAME → cname.vercel-dns.com
Cache Rules:
  - /api/* → No Cache
  - /_next/static/* → Cache 1 year
  - /images/* → Cache 1 month
```

**健康检查端点**

```
GET /api/health           # 全量检查
GET /api/health/db        # PostgreSQL
GET /api/health/redis     # Redis
GET /api/health/r2        # Cloudflare R2
```

**验收标准**

- `main` 分支推送自动部署
- CI 全部通过才允许合并
- 健康检查全绿
- 数据库迁移在部署时自动执行

---

## 性能 & 安全要求汇总

| 指标 | 要求 |
|------|------|
| 页面首次加载（FCP） | < 2s |
| 实时字幕延迟 | < 500ms |
| AI 翻译延迟（P95） | < 800ms |
| API 响应（P95） | < 500ms |
| WebSocket 重连 | 指数退避，最多 5 次 |
| Redis Key TTL | 全部设置，无例外 |
| R2 文件 CDN | Cloudflare 缓存 |
| 数据库查询 | 有索引，无全表扫描 |
| HTTPS | 强制，无 HTTP |
| 密码存储 | bcrypt，cost=12 |
| SQL | 全部走 Prisma，无拼接 |
| 敏感数据 | 不出现在日志中 |

---

## 版本路线图

| 版本 | 功能 |
|------|------|
| V1（当前） | 实时 ASR + 翻译 + 字幕 + 会议记录 + 导出 |
| V2 | AI 纪要自动生成 + 多人会议 + 术语学习 |
| V3 | Zoom / Teams / 飞书 / 腾讯会议接入 |
| V4 | iOS / Android / Electron 桌面客户端 |

---

*本文档由 Claude Cowork 生成 · 2026-06-29*

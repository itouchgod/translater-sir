# Codex 部署配置自动化指令

> 本文档用于指导 Codex 通过 Chrome 完成 translater-sir 项目的所有第三方服务注册与 Vercel 环境变量配置。
> 执行前确认：已有账号或可注册新账号。所有获取到的值最终写入 Vercel 环境变量。
> 账号邮箱：henryluo2022@gmail.com

---

## 最新执行状态（2026-06-30）

### 当前结论

- 生产站点域名：`https://www.translatersir.com`
- 根域名 `https://translatersir.com` 已接入，但应用配置以 `www` 为规范域名。
- Vercel 已能完成构建与部署，站点可访问。
- 邮箱密码登录已恢复，管理员账号可登录后台。
- Google OAuth 已创建客户端，需保持 `www` 与非 `www` 两套回调地址同时存在。
- 头像上传已改为服务端代理上传：优先写入 Cloudflare R2；R2 异常时，小图会临时回退存入数据库，避免用户资料页直接失败。

### 已完成配置

```
域名
  NEXTAUTH_URL        = https://www.translatersir.com
  NEXT_PUBLIC_APP_URL = https://www.translatersir.com
  NEXT_PUBLIC_WS_URL  = https://www.translatersir.com

Neon
  DATABASE_URL 已填入 Vercel Production / Preview

Upstash
  REDIS_URL 已填入 Vercel Production / Preview

Cloudflare R2
  R2_ACCOUNT_ID  = 96b38e3d16f403104f1535e4710e0410
  R2_BUCKET_NAME = translater-sir
  R2_PUBLIC_URL  = https://pub-4ad191e6ae9341e3b9b302af4b0023bb.r2.dev
  R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY 已填入 Vercel
  本地 .env.local 如需测试 R2，仍需重新创建 R2 Token 后补齐这两个值

Deepgram
  DEEPGRAM_API_KEY 已填入 Vercel

OpenAI
  OPENAI_API_KEY / OPENAI_BASE_URL / AI_TRANSLATION_MODEL / AI_SUMMARY_MODEL 已填入 Vercel

SMTP / Resend
  EMAIL_FROM / SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / SMTP_SECURE 已填入 Vercel

Stripe
  STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY 已填入 Vercel

Google OAuth
  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 已填入 Vercel
  Authorized JavaScript origins:
    https://translatersir.com
    https://www.translatersir.com
  Authorized redirect URIs:
    https://translatersir.com/api/auth/callback/google
    https://www.translatersir.com/api/auth/callback/google

Auth
  AUTH_SECRET / NEXTAUTH_SECRET 已填入 Vercel
```

### 已完成应用修复

- 修复 `vercel.json` 的 monorepo 输出目录配置。
- 修复生产环境 Auth Cookie / Middleware 识别问题。
- 修复 `NEXTAUTH_URL`、Google OAuth 回调与 `www` 域名不一致导致的登录失败。
- 创建生产管理员用户：`admin@translatersir.com`，角色 `SUPER_ADMIN`。
- 禁用默认测试管理员 `admin@example.com`。
- 用户管理页已支持封禁、解封、删除用户。
- 全站 Logo、favicon、manifest 图标已基于 `logo001.png` 更新。
- 会议实时页已将黑色字幕区域在无字幕时显示为等待状态，避免误以为是视频区域。
- Dashboard 导航已简化为主导航 + 头像菜单；设置、个人资料、成员管理、安全、API Key、Webhooks、平台管理、退出登录已合并到头像菜单。
- 头像上传接口已改为应用服务端处理，避免浏览器直连 R2；上传完成后会自动刷新右上角头像。
- 个人资料页的“保存资料”按钮现在只用于保存姓名，头像上传为自动保存流程。

### 后续注意事项

- Cloudflare R2 的 Secret Access Key 只显示一次，Vercel 已填即可；如果本地 `.env.local` 还没填，需新建 R2 Token 重新获取。
- 修改 Vercel 环境变量后，需要在 Vercel 重新部署，并取消使用旧 Build Cache。
- 如需快速检查生产依赖，可登录管理员后访问：
  `https://www.translatersir.com/api/admin/health`
- 如果确认 R2 上传长期稳定，可以后续移除头像上传的数据库 data URL 回退逻辑。
- `@repo/types#build`、`@repo/utils#build` 的 no output files warning 不影响部署；这是 Turborepo outputs 配置提示。
- Prisma `package.json#prisma` deprecation warning 不影响当前部署，可后续迁移到 `prisma.config.ts`。

---

## 执行顺序

```
Step 1: 修复 vercel.json（本地文件操作）
Step 2: Neon → 获取 DATABASE_URL
Step 3: Upstash → 获取 REDIS_URL
Step 4: Cloudflare → 创建 R2，获取 4 个 R2 变量
Step 5: Deepgram → 获取 DEEPGRAM_API_KEY
Step 6: OpenAI → 获取 OPENAI_API_KEY
Step 7: Resend → 获取 SMTP 参数
Step 8: Stripe → 获取 3 个 Stripe 变量
Step 9: Google Cloud → 获取 GOOGLE_CLIENT_ID / SECRET
Step 10: 生成 AUTH_SECRET
Step 11: Vercel → 批量设置所有环境变量 + 触发重新部署
```

---

## Step 1 · 修复 vercel.json（文件操作）

打开项目根目录下的 `vercel.json`，将内容替换为：

```json
{
  "framework": "nextjs",
  "buildCommand": "pnpm turbo build",
  "installCommand": "pnpm install",
  "outputDirectory": "apps/web/.next",
  "regions": ["sin1"],
  "crons": []
}
```

保存文件，然后在终端执行：
```bash
cd /path/to/translater-sir
git add vercel.json
git commit -m "fix: add outputDirectory to vercel.json for monorepo"
git push origin main
```

> ✅ 完成标志：vercel.json 已含 `outputDirectory` 字段，已推送到 GitHub。

---

## Step 2 · Neon（PostgreSQL 数据库）

**目标变量：`DATABASE_URL`**

### 操作步骤

1. 用 Chrome 打开 `https://neon.tech`
2. 点击右上角 **Sign Up** 或 **Get Started**，用 Google 登录（henryluo2022@gmail.com）
3. 登录成功后进入控制台，点击 **New Project**
4. 填写表单：
   - Project name: `translater-sir`
   - PostgreSQL version: `16`（默认即可）
   - Region: **Singapore** 或 **Asia Pacific**（选最近的）
5. 点击 **Create Project**
6. 创建完成后，页面会显示连接字符串，找到 **Connection string** 区域
7. 在下拉菜单中选择 **Prisma** 模式
8. 复制连接字符串，格式类似：
   ```
   postgresql://username:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
9. 将此值记录为 `DATABASE_URL`

> ✅ 完成标志：获得 `DATABASE_URL`，格式含 `neon.tech`，末尾含 `?sslmode=require`。

---

## Step 3 · Upstash（Redis）

**目标变量：`REDIS_URL`**

### 操作步骤

1. 用 Chrome 打开 `https://upstash.com`
2. 点击 **Sign Up**，用 Google 登录（henryluo2022@gmail.com）
3. 登录后进入控制台，点击 **Create Database**
4. 填写：
   - Name: `translater-sir`
   - Type: **Regional**
   - Region: **AP-Southeast-1（Singapore）**
   - TLS (SSL): **开启**（默认已开启）
5. 点击 **Create**
6. 创建完成后，点击数据库名称进入详情
7. 在 **REST API** 或 **Details** 标签页，找到 **UPSTASH_REDIS_REST_URL** 和 **UPSTASH_REDIS_REST_TOKEN**
8. 向下滚动找到 **Redis Compatible** 区域，复制 **Redis URL**，格式：
   ```
   rediss://default:xxxxx@xxx.upstash.io:6379
   ```
9. 将此值记录为 `REDIS_URL`

> ✅ 完成标志：获得 `REDIS_URL`，格式以 `rediss://` 开头（注意是双 s）。

---

## Step 4 · Cloudflare R2（对象存储）

**目标变量：`R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` / `R2_PUBLIC_URL`**

### 4-A：获取 Account ID

1. 打开 `https://dash.cloudflare.com`，用 henryluo2022@gmail.com 登录
2. 登录后，右侧边栏可见 **Account ID**（32位十六进制字符串）
3. 复制并记录为 `R2_ACCOUNT_ID`

### 4-B：创建 R2 Bucket

1. 左侧菜单点击 **R2 Object Storage**
2. 如提示需要添加支付方式，先添加（R2 有免费额度，不会立即扣费）
3. 点击 **Create bucket**
4. 填写：
   - Bucket name: `translater-sir`
   - Location: **APAC（Asia Pacific）**
5. 点击 **Create bucket**
6. 创建成功后，记录 `R2_BUCKET_NAME` = `translater-sir`

### 4-C：开启公共访问（Public URL）

1. 进入刚创建的 bucket `translater-sir`
2. 点击 **Settings** 标签
3. 找到 **Public access** 区域，点击 **Allow Access**
4. 找到 **R2.dev subdomain** 区域，点击 **Enable**
5. 记录生成的公共 URL，格式：
   ```
   https://pub-xxxxxxxxxxxx.r2.dev
   ```
6. 将此值记录为 `R2_PUBLIC_URL`

### 4-D：创建 API Token

1. 回到 R2 主页，点击右上角 **Manage R2 API Tokens**
2. 点击 **Create API Token**
3. 填写：
   - Token name: `translater-sir`
   - Permissions: **Object Read & Write**
   - Specify bucket: 选择 `translater-sir`
4. 点击 **Create API Token**
5. 页面显示 Token 信息，复制：
   - **Access Key ID** → 记录为 `R2_ACCESS_KEY_ID`
   - **Secret Access Key** → 记录为 `R2_SECRET_ACCESS_KEY`（仅显示一次，立即保存）

> ✅ 完成标志：获得全部 5 个 R2 变量。

---

## Step 5 · Deepgram（语音识别 ASR）

**目标变量：`DEEPGRAM_API_KEY`**

### 操作步骤

1. 打开 `https://console.deepgram.com`
2. 点击 **Sign Up**，用 Google 登录（henryluo2022@gmail.com）
3. 注册时选择用途：**Speech-to-Text / ASR**，直接跳过引导
4. 进入控制台后，左侧菜单点击 **API Keys**
5. 点击 **Create a New API Key**
6. 填写：
   - Comment: `translater-sir production`
   - Permissions: **Member**（默认）
7. 点击 **Create Key**
8. 复制显示的 API Key（仅显示一次）
9. 记录为 `DEEPGRAM_API_KEY`

> ✅ 完成标志：获得 `DEEPGRAM_API_KEY`（32位十六进制字符串）。

---

## Step 6 · OpenAI

**目标变量：`OPENAI_API_KEY`**

### 操作步骤

1. 打开 `https://platform.openai.com`
2. 用 Google 登录（henryluo2022@gmail.com）
3. 左侧菜单点击 **API Keys**（或访问 `https://platform.openai.com/api-keys`）
4. 点击 **Create new secret key**
5. 填写：
   - Name: `translater-sir`
6. 点击 **Create secret key**
7. 复制显示的 Key（`sk-proj-...` 或 `sk-...`，仅显示一次）
8. 记录为 `OPENAI_API_KEY`

> ⚠️ 注意：需要账户有余额或添加支付方式，否则 API 调用会失败。
> ✅ 完成标志：获得 `OPENAI_API_KEY`，以 `sk-` 开头。

---

## Step 7 · Resend（邮件发送 SMTP）

**目标变量：`EMAIL_FROM` / `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_SECURE`**

### 操作步骤

1. 打开 `https://resend.com`
2. 点击 **Sign Up**，用 Google 登录（henryluo2022@gmail.com）
3. 登录后进入控制台

### 7-A：获取 API Key（作为 SMTP 密码）

1. 左侧菜单点击 **API Keys**
2. 点击 **Create API Key**
3. 填写：
   - Name: `translater-sir`
   - Permission: **Full Access**
4. 点击 **Create**
5. 复制 API Key（以 `re_` 开头，仅显示一次）
6. 记录为 `SMTP_PASSWORD`

### 7-B：域名配置（可选，使用 onboarding 域名快速测试）

如果没有自己的域名，Resend 提供 `onboarding@resend.dev` 可用于测试。

记录以下固定值：
```
EMAIL_FROM  = onboarding@resend.dev
SMTP_HOST   = smtp.resend.com
SMTP_PORT   = 587
SMTP_USER   = resend
SMTP_PASSWORD = （刚才复制的 API Key，re_xxx）
SMTP_SECURE = false
```

> 如果有自己的域名，在 Resend 控制台 → **Domains** → **Add Domain** 验证域名后，`EMAIL_FROM` 改为 `no-reply@你的域名`。

> ✅ 完成标志：获得全部 6 个 SMTP 变量。

---

## Step 8 · Stripe（支付）

**目标变量：`STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`**

### 操作步骤

### 8-A：获取 API Keys

1. 打开 `https://dashboard.stripe.com`
2. 用 Google 或邮箱登录
3. 登录后，如处于 **Test mode**（页面右上角有测试模式切换），保持测试模式即可
4. 左侧菜单点击 **Developers → API Keys**
5. 复制：
   - **Publishable key**（以 `pk_test_` 开头）→ 记录为 `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - **Secret key** 点击 **Reveal test key**（以 `sk_test_` 开头）→ 记录为 `STRIPE_SECRET_KEY`

### 8-B：创建 Webhook

1. 左侧菜单点击 **Developers → Webhooks**
2. 点击 **Add endpoint**
3. 填写：
   - Endpoint URL: `https://www.translatersir.com/api/webhooks/stripe`
   - Events to listen：点击 **Select events**，勾选：
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
4. 点击 **Add endpoint**
5. 进入新创建的 Webhook 详情，找到 **Signing secret**，点击 **Reveal**
6. 复制 Webhook Secret（以 `whsec_` 开头）→ 记录为 `STRIPE_WEBHOOK_SECRET`

> ✅ 完成标志：获得全部 3 个 Stripe 变量。

---

## Step 9 · Google Cloud（OAuth 登录）

**目标变量：`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`**

### 操作步骤

1. 打开 `https://console.cloud.google.com`
2. 用 henryluo2022@gmail.com 登录
3. 如果没有项目，点击 **Create Project**：
   - Project name: `translater-sir`
   - 点击 **Create**
4. 确保当前选择的是 `translater-sir` 项目

### 9-A：启用 API

1. 左侧菜单 → **APIs & Services → Library**
2. 搜索 **Google+ API** 或 **Google Identity**，找到 **Google People API** 并启用

### 9-B：配置 OAuth 同意屏幕

1. 左侧菜单 → **APIs & Services → OAuth consent screen**
2. 选择 **External**，点击 **Create**
3. 填写：
   - App name: `Translater Sir`
   - User support email: `henryluo2022@gmail.com`
   - Developer contact email: `henryluo2022@gmail.com`
4. 点击 **Save and Continue**
5. Scopes 页面直接点击 **Save and Continue**
6. Test users 页面直接点击 **Save and Continue**
7. Summary 页面点击 **Back to Dashboard**

### 9-C：创建 OAuth 客户端

1. 左侧菜单 → **APIs & Services → Credentials**
2. 点击 **Create Credentials → OAuth client ID**
3. 选择 Application type: **Web application**
4. 填写：
   - Name: `translater-sir`
   - Authorized JavaScript origins:
     - `http://localhost:3000`
     - `https://translatersir.com`
     - `https://www.translatersir.com`
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://translatersir.com/api/auth/callback/google`
     - `https://www.translatersir.com/api/auth/callback/google`
5. 点击 **Create**
6. 弹窗显示：
   - **Client ID** → 记录为 `GOOGLE_CLIENT_ID`
   - **Client Secret** → 记录为 `GOOGLE_CLIENT_SECRET`

> ✅ 完成标志：获得 `GOOGLE_CLIENT_ID`（以 `.apps.googleusercontent.com` 结尾）和 `GOOGLE_CLIENT_SECRET`。

---

## Step 10 · 生成 AUTH_SECRET

在终端执行以下命令生成随机密钥：

```bash
openssl rand -base64 32
```

复制输出结果，记录为 `AUTH_SECRET`。

---

## Step 11 · Vercel 设置所有环境变量

### 11-A：确认 Vercel 部署域名

1. 打开 `https://vercel.com/dashboard`
2. 找到 `translater-sir` 项目
3. 点击进入，记录项目域名，格式：`translater-sir-xxx.vercel.app`
4. 将此域名替换前面步骤中的所有占位符（Google OAuth、Stripe Webhook）

### 11-B：批量添加环境变量

1. 进入 Vercel 项目 → **Settings → Environment Variables**
2. 将以下所有变量逐一添加，Environment 选择 **Production、Preview、Development** 全部勾选

按照下表，逐行点击 **Add New**，填写 **Name** 和 **Value**，然后点击 **Save**：

```
变量名                              值（来源）
─────────────────────────────────────────────────────
DATABASE_URL                        Step 2 获取的 Neon 连接字符串
REDIS_URL                           Step 3 获取的 Upstash Redis URL
AUTH_SECRET                         Step 10 生成的随机字符串
NEXTAUTH_SECRET                     与 AUTH_SECRET 相同的值
NEXTAUTH_URL                        https://www.translatersir.com
NEXT_PUBLIC_APP_URL                 https://www.translatersir.com

R2_ACCOUNT_ID                       96b38e3d16f403104f1535e4710e0410
R2_ACCESS_KEY_ID                    Step 4-D 获取
R2_SECRET_ACCESS_KEY                Step 4-D 获取
R2_BUCKET_NAME                      translater-sir
R2_PUBLIC_URL                       https://pub-4ad191e6ae9341e3b9b302af4b0023bb.r2.dev

OPENAI_API_KEY                      Step 6 获取
OPENAI_BASE_URL                     https://api.openai.com/v1
DEEPGRAM_API_KEY                    Step 5 获取
AI_TRANSLATION_MODEL                gpt-4o-mini
AI_SUMMARY_MODEL                    gpt-4o-mini

EMAIL_FROM                          Step 7 获取
SMTP_HOST                           smtp.resend.com
SMTP_PORT                           587
SMTP_USER                           resend
SMTP_PASSWORD                       Step 7 获取的 re_xxx
SMTP_SECURE                         false

STRIPE_SECRET_KEY                   Step 8-A 获取
STRIPE_WEBHOOK_SECRET               Step 8-B 获取
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  Step 8-A 获取

GOOGLE_CLIENT_ID                    Step 9-C 获取
GOOGLE_CLIENT_SECRET                Step 9-C 获取

ABLY_API_KEY                        （暂留空，可部署后再填）
NEXT_PUBLIC_ABLY_CLIENT_KEY         （暂留空）
NEXT_PUBLIC_WS_URL                  https://www.translatersir.com
LOG_LEVEL                           info
SKIP_ENV_VALIDATION                 0
```

### 11-C：触发重新部署

1. 进入 Vercel 项目 → **Deployments**
2. 找到最新的部署，点击右侧 **⋯ → Redeploy**
3. 勾选 **Use existing Build Cache** → 取消勾选（强制全量重建）
4. 点击 **Redeploy**
5. 等待部署完成（约 2-5 分钟）
6. 部署成功后，点击 **Visit** 访问网站

### 11-D：更新 Google OAuth 回调地址

回到 Step 9，将 Google Cloud Console 中的占位符替换为真实 Vercel 域名：
- Authorized JavaScript origins:
  - `https://translatersir.com`
  - `https://www.translatersir.com`
- Authorized redirect URIs:
  - `https://translatersir.com/api/auth/callback/google`
  - `https://www.translatersir.com/api/auth/callback/google`

---

## 验收清单

完成后，检查以下项目：

```
[ ] Vercel 部署状态为 Ready（绿色）
[ ] 访问 https://www.translatersir.com/api/health 返回 200
[ ] 访问 https://www.translatersir.com/login 页面正常显示
[ ] 注册新账号，收到验证邮件
[ ] Google 登录正常跳转
[ ] 上传文件（头像测试）成功存储到 R2
```

---

## 收集到的变量汇总（执行过程中填写）

执行完毕后，将以下表格填写完整，以备备份：

```
DATABASE_URL                = 已填入 Vercel，勿写入文档
REDIS_URL                   = 已填入 Vercel，勿写入文档
AUTH_SECRET                 = 已填入 Vercel，勿写入文档
NEXTAUTH_URL                = https://www.translatersir.com
NEXT_PUBLIC_APP_URL         = https://www.translatersir.com
NEXT_PUBLIC_WS_URL          = https://www.translatersir.com
R2_ACCOUNT_ID               = 96b38e3d16f403104f1535e4710e0410
R2_ACCESS_KEY_ID            = 已填入 Vercel，勿写入文档
R2_SECRET_ACCESS_KEY        = 已填入 Vercel，勿写入文档
R2_BUCKET_NAME              = translater-sir
R2_PUBLIC_URL               = https://pub-4ad191e6ae9341e3b9b302af4b0023bb.r2.dev
OPENAI_API_KEY              = 已填入 Vercel，勿写入文档
DEEPGRAM_API_KEY            = 已填入 Vercel，勿写入文档
SMTP_PASSWORD               = 已填入 Vercel，勿写入文档
STRIPE_SECRET_KEY           = 已填入 Vercel，勿写入文档
STRIPE_WEBHOOK_SECRET       = 已填入 Vercel，勿写入文档
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 已填入 Vercel
GOOGLE_CLIENT_ID            = 已填入 Vercel
GOOGLE_CLIENT_SECRET        = 已填入 Vercel，勿写入文档
```

---

*生成日期：2026-06-30 · 项目：translater-sir*

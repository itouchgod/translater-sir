# Translater Sir

公司内部同声传译工具，用于会议场景下的实时语音识别、AI 翻译、字幕展示、术语库辅助和会后资料留存。

当前产品定位优先服务内部团队：先保证账号、组织、会议、实时传译、术语库、文件存储和后台健康检查稳定可用；计费、公开 API、Webhook 等能力保留为后续扩展，不作为当前核心商业化目标。

## 当前状态

更新时间：2026-07-01

- 生产域名：`https://www.translatersir.com`
- 部署平台：Vercel，应用区域配置为 Singapore。
- 健康检查：`/api/health` 当前返回 `healthy`。
- 数据依赖：PostgreSQL、Redis、Cloudflare R2 均已接入并通过生产健康检查。
- R2 状态：API 令牌已重建，`/api/health/r2` 当前返回 `ok`。
- 管理后台：支持用户、组织、AI 日志、审计日志和 DB / Redis / R2 健康状态查看。
- 会议能力：支持会议创建、开始、结束、实时字幕、TTS 播放、录音文件上传和历史回看。
- 文档入口：当前状态总结见 [docs/project-status.md](/Users/roger/website/translater-sir/docs/project-status.md)。

## 技术栈

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Prisma
- PostgreSQL
- Redis
- Cloudflare R2
- NextAuth v5
- Turborepo
- pnpm

## 本地启动

1. 安装依赖：

   ```bash
   pnpm install
   ```

2. 准备环境变量：

   ```bash
   cp .env.example .env.local
   ```

   R2 本地调试需要填入 `R2_ACCESS_KEY_ID` 和 `R2_SECRET_ACCESS_KEY`；Cloudflare 的 Secret Access Key 只显示一次，丢失后需要重新创建 R2 API Token。

3. 启动开发服务器：

   ```bash
   pnpm dev
   ```

4. 打开 `http://localhost:3000`。

## 常用命令

```bash
pnpm lint
pnpm type-check
pnpm build
pnpm test
```

## RBAC 权限矩阵

| 权限 | OWNER | ADMIN | MEMBER | VIEWER |
|------|-------|-------|--------|--------|
| `meeting:create` | ✅ | ✅ | ✅ | ❌ |
| `meeting:delete` | ✅ | ✅ | ❌ | ❌ |
| `meeting:view` | ✅ | ✅ | ✅ | ✅ |
| `member:manage` | ✅ | ✅ | ❌ | ❌ |
| `dictionary:manage` | ✅ | ✅ | ✅ | ❌ |
| `billing:view` | ✅ | ✅ | ❌ | ❌ |
| `billing:manage` | ✅ | ❌ | ❌ | ❌ |
| `apikey:manage` | ✅ | ✅ | ❌ | ❌ |
| `webhook:manage` | ✅ | ✅ | ❌ | ❌ |
| `admin:access` | ✅ | ❌ | ❌ | ❌ |

## 目录结构

```text
apps/web/        Next.js 主应用
packages/types/ 共享类型
packages/utils/ 共享工具函数
```

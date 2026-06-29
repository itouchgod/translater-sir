# Speech Interpreter

AI 同声传译平台的 monorepo 骨架。

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
   cp .env.example .env
   ```

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

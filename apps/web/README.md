# Translater Sir Web

Next.js 主应用，服务于公司内部同声传译工具。

当前核心页面和接口覆盖：

- 登录、注册、Google OAuth 和账号安全。
- Dashboard、会议、历史、术语库、计费入口。
- 实时会议室：音频采集、字幕展示、TTS 播放、录音上传和连接状态。
- 组织设置、成员管理、个人资料和头像上传。
- 管理员后台：用户、组织、AI 日志、审计日志和系统健康。

## Getting Started

在仓库根目录安装依赖后，可在 `apps/web` 启动开发服务器：

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

环境变量来自仓库根目录 `.env.local`。R2 本地调试需要 `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`；生产状态和重建步骤见 [../../docs/project-status.md](/Users/roger/website/translater-sir/docs/project-status.md) 和 [../../CODEX_DEPLOY_SETUP.md](/Users/roger/website/translater-sir/CODEX_DEPLOY_SETUP.md)。

## Useful Commands

```bash
pnpm lint
pnpm type-check
pnpm build
pnpm test
```

## Production

Production URL: `https://www.translatersir.com`

Health checks:

- `https://www.translatersir.com/api/health`
- `https://www.translatersir.com/api/health/r2`

As of 2026-07-01, DB / Redis / R2 are all healthy in production.

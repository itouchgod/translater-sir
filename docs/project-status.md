# 项目状态总结

更新时间：2026-07-01

## 产品定位

Translater Sir 当前定位为公司内部同声传译工具，核心目标是在内部会议中提供稳定、可追踪、可复用的实时传译能力。

现阶段优先级：

1. 内部账号与组织权限稳定。
2. 会议创建、实时传译、字幕展示、录音留存流程可用。
3. 术语库、历史记录和会后文件便于内部复盘。
4. 管理后台能看到用户、组织、AI 调用、审计日志和基础设施健康状态。

暂不作为当前主线的能力：

- 对外 SaaS 商业化计费。
- 面向第三方开发者的大规模公开 API。
- 外部客户自助开通和复杂套餐运营。

这些模块可以保留代码和数据结构，但产品叙事应按“内部工具优先，商业化能力预留”处理。

## 生产环境

| 项目 | 当前状态 |
|------|----------|
| 生产域名 | `https://www.translatersir.com` |
| 根域名 | `https://translatersir.com` 已接入，应用规范域名使用 `www` |
| 部署 | Vercel |
| 数据库 | Neon PostgreSQL，已接入 |
| 缓存 | Upstash Redis，已接入 |
| 对象存储 | Cloudflare R2 bucket `translater-sir` |
| R2 公共地址 | `https://pub-4ad191e6ae9341e3b9b302af4b0023bb.r2.dev` |
| 认证 | NextAuth v5，邮箱密码登录和 Google OAuth 已配置 |
| 管理员 | `admin@translatersir.com` 已创建为 `SUPER_ADMIN` |

## 健康检查

2026-07-01 验证结果：

```json
{
  "overall": "healthy",
  "components": {
    "db": { "status": "ok" },
    "redis": { "status": "ok" },
    "r2": { "status": "ok" }
  }
}
```

可用检查入口：

- 全量健康检查：`https://www.translatersir.com/api/health`
- R2 单项检查：`https://www.translatersir.com/api/health/r2`
- 管理后台健康检查：登录管理员后访问 `https://www.translatersir.com/api/admin/health`

## 已具备能力

- 账号注册、登录、登出、密码相关流程。
- Google OAuth 登录。
- 组织、成员、角色和 RBAC 权限。
- 会议创建、列表、详情、开始、结束、删除。
- 实时会议室：音频采集、连接状态、字幕展示、TTS 播放、录音状态。
- ASR / 翻译 / TTS 的服务端调用链与 AI 调用日志。
- 企业术语库与术语管理。
- 会议文件、头像、组织 Logo 等 R2 存储。
- 会议历史、搜索、Dashboard 统计。
- 管理员后台：用户、组织、AI 日志、审计日志、系统健康。
- 安全基础设施：限流、审计日志、JWT 黑名单、环境变量校验、安全响应头。

## 最新处理记录

- R2 API 令牌被删除后已重建。
- Vercel 中 `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` 已更新。
- 生产 `/api/health/r2` 已恢复为 `ok`。
- R2 health check 逻辑会执行真实上传和删除，因此能覆盖凭据、bucket 权限和 S3 endpoint 可用性。

## 风险与后续事项

- 头像上传仍保留小图数据库 data URL 回退逻辑；确认 R2 长期稳定后可移除。
- R2 Secret Access Key 只显示一次，需要妥善保管；丢失或删除 token 后只能重新创建。
- 修改 Vercel 环境变量后必须重新部署，必要时取消旧 Build Cache。
- 当前实时能力跑在 Vercel Serverless 约束下，长连接能力以 Ably/SSE 方案为主，避免依赖原生 WebSocket upgrade。
- 计费、API Key、Webhook 可保留为内部治理或未来外部化能力，但近期产品表达不应把它们放在核心位置。

# 语音速记（语音输入工具）功能扩展设计

> 版本：v1.0 · 日期：2026-07-01
> 定位：在现有「会议传译」能力之外，新增面向个人日常场景的「语音速记」模块，并作为登录后默认首页。
> 参考：[Superwhisper 文档](https://superwhisper.com/docs/modes/modes)、[Superwhisper Use Cases](https://superwhisper.com/use-cases)、[Typeless 官网](https://www.typeless.com)

---

## 1. 背景

Translater Sir 当前定位为公司内部同声传译工具，核心链路是"多人会议 → 实时 ASR → AI 翻译 → 字幕/TTS → 会后纪要"（详见 `CODEX_TASKS.md`、`docs/project-status.md`）。这套链路已经具备 ASR（Deepgram）、AI 翻译（OpenAI + 术语库）、TTS、WebSocket 实时推送、Redis 缓存、R2 存储、RBAC 权限等完整基础设施。

Superwhisper 和 Typeless 代表的是另一类语音产品形态：**面向个人的高频碎片化语音输入**——不是"开会"，而是"随时说话，随时得到一段可用的文字"。这类产品的核心价值是"说话 → AI 整理 → 直接可用的文本"，而不是会议级的多人实时字幕。

本设计的目标：把这套"个人语音速记"能力叠加到 Translater Sir 上，成为登录后的**默认首页**，与「会议传译」并列成为产品的两大核心场景，同时最大化复用已有的 ASR / 翻译 / TTS / 术语库 / 权限基础设施，控制新增成本。

---

## 2. 竞品能力拆解

| 能力 | Superwhisper | Typeless | 是否引入 Translater Sir |
|---|---|---|---|
| 系统级全局语音输入（任意 App 内） | ✅ 桌面/移动原生应用 | ✅ 桌面/移动原生应用 | ❌ MVP 不做（Web 应用限制），**V3 预留**方向 |
| 多种"模式"（Message / Email / Note / Meeting / Custom），按场景定制 AI 后处理 | ✅ | 部分（按 App 自动切换语气） | ✅ MVP 引入，简化为 5 个内置模式 + 自定义 |
| 按当前使用的 App/网站自动切换模式或语气 | ✅ Auto-Activation Rules | ✅ Different tones for each app | ❌ Web 场景无法感知外部 App，改为**手动选择模式**，默认记忆上次选择 |
| 去口癖、去重复、自我纠正保留最终意图 | 部分（依赖 AI 处理） | ✅ 核心卖点 | ✅ MVP 引入，作为 AI 后处理管线的默认行为 |
| 自动格式化（口述列表 → 结构化列表/步骤） | 部分 | ✅ | ✅ MVP 引入 |
| 个人词典 / 自定义词汇 | 部分 | ✅ Personal dictionary | ✅ 复用现有企业术语库模型，新增"个人"作用域 |
| 语音实时翻译 | ✅（设置目标语言） | ✅ Translates as you speak | ✅ 直接复用现有 T11 翻译链路 |
| 选中文本 + 语音指令二次编辑（改语气/精简/翻译） | 部分 | ✅ Ask Anything | 🔶 V2 引入 |
| 文件转写（上传音频/视频） | ✅ | — | 🔶 V2，可复用 R2 + Deepgram 批量转写 |
| 说话人分离（会议场景） | ✅ Identify Speakers | — | 🔶 V3，与会议传译模块融合 |
| 本地/离线语音模型，音频不出设备 | ✅ 核心卖点 | — | ❌ Web 架构下无法做到，需在隐私说明中明确告知用户音频会经过服务端 |
| 零数据留存 / 不用于训练 | ✅ SOC2/HIPAA | ✅ | ✅ 产品承诺层面对齐，技术上默认不做模型训练，历史记录可删除、可设为"临时模式" |
| 个性化语气学习 | — | ✅ Personalized style and tone | 🔶 V2，先用"用户历史片段注入 Prompt"的轻量方案，不做模型微调 |

---

## 3. 产品定位与边界

语音速记（内部代号 **Voice Notes**，页面路由 `/voice`）与会议传译室的关系：

| 维度 | 会议传译（既有） | 语音速记（新增） |
|---|---|---|
| 使用场景 | 多人会议，实时双语字幕 | 单人日常输入：写消息、写邮件、记笔记、整理会议纪要草稿、临时翻译 |
| 会话形态 | 持续的会议（有开始/结束） | 一次次独立、短平快的"速记片段" |
| 核心产出 | 字幕流 + 会议纪要 + 录音 | 一段"AI 整理好可直接使用"的文本 |
| 底层能力 | ASR + 翻译 + TTS + WebSocket 广播 | 复用同一套 ASR + 翻译，新增"AI 后处理"层，弱化 WebSocket 广播（单人无需广播） |
| 入口 | `/meetings/*` | `/voice`（**登录后默认首页**） |

MVP 明确不做（Web 应用边界）：系统级/跨 App 的全局语音输入、离线本地识别、跨设备热键。这类能力放入 V3 路线图作为预留方向，不在本次设计范围内展开工程细节，仅作架构预留说明（见第 9 节）。

---

## 4. 首页信息架构与线框

### 4.1 顶部导航调整

```
[Logo]  语音速记(默认)   会议传译   历史记录   术语库   Dashboard统计        [组织切换] [头像]
```

- 登录成功 / 打开根路径 `/` → 跳转 `/voice`（原先跳转 `/dashboard`）。
- `/dashboard` 统计页保留，作为导航项之一，不再是登录后的第一落地页。
- middleware 路由保护矩阵新增 `/voice` 到受保护路径。

### 4.2 `/voice` 页面布局（桌面端，≥1024px）

```
┌───────────────────────────────────────────────────────────────────┐
│  语音速记                                    [隐私说明] [临时模式⏻]  │
├───────────┬───────────────────────────────────────┬───────────────┤
│ 模式选择   │                                       │  设置面板       │
│ ─────────  │        ●  点击说话 / 松开结束           │ ─────────      │
│ 💬 消息    │                                       │ 语言：中文 ▾    │
│ 📧 邮件    │   ┌─────────────────────────────────┐ │ 目标语言：无 ▾  │
│ 📝 笔记    │   │ 实时转写预览（半透明，识别中）      │ │                │
│ 🗒 会议纪要 │   └─────────────────────────────────┘ │ AI 后处理：      │
│ 🌐 翻译    │   ┌─────────────────────────────────┐ │ ☑ 去口癖        │
│ ⚙ 自定义…  │   │ AI 整理后文本（可编辑，卡片样式）    │ │ ☑ 去重复        │
│           │   │                                   │ │ ☑ 自动格式化     │
│ ─────────  │   └─────────────────────────────────┘ │ ☑ 术语库匹配     │
│ 最近速记    │   [复制] [重新生成] [朗读] [保存/丢弃]  │                │
│ · 09:12 消息│                                       │ 个人词典 →      │
│ · 昨天 邮件 │                                       │                │
│ 查看全部 → │                                       │                │
└───────────┴───────────────────────────────────────┴───────────────┘
```

移动端（<1024px）：模式选择器收为顶部横向可滑动 Chips；设置面板收进右上角抽屉；录音按钮固定在底部，转写/整理结果单列纵向展示。

### 4.3 交互流程

1. 用户选择模式（默认记忆上次使用的模式，存 `localStorage` + 用户级默认设置）。
2. 按住/点击麦克风开始说话（复用 T10 `useAudioCapture`）。
3. 实时转写以半透明文字展示（非 final 段落），say 完/停顿后 AI 后处理生成整理后文本。
4. 用户可编辑整理后文本、点击"重新生成"（换一种整理方式）、复制、朗读（复用 T12 TTS）、保存到历史或丢弃。
5. "临时模式"开启时，本次速记不写入历史记录，仅当前会话可见，关闭页面即清空。

---

## 5. 核心功能模块设计

### 5.1 模式系统（Modes）

内置 5 个模式 + 自定义：

| 模式 | 用途 | AI 后处理行为 |
|---|---|---|
| 消息 Message | IM/聊天场景 | 口语化整理，保留语气，去口癖 |
| 邮件 Email | 正式邮件草稿 | 转换为正式书面语，补全称呼/结尾 |
| 笔记 Note | 个人笔记/待办 | 结构化为要点列表，识别待办项 |
| 会议纪要草稿 Meeting Note | 快速记要点 | 按"主题/要点/待办"结构化，可一键转入某个 `Meeting` |
| 翻译 Translate | 语音直接翻译 | 跳过风格整理，直接调用现有翻译链路（T11），输出目标语言译文 |
| 自定义 Custom | 高级用户 | 用户自写 System Prompt，参考 Superwhisper Custom Mode |

模式配置项：语言、AI 后处理开关（去口癖/去重复/自动格式化/术语库匹配）、目标语言（仅翻译模式）。组织管理员可以创建"组织级预设模式"供全员使用（例如统一的邮件签名风格）。

### 5.2 实时转写 + AI 后处理管线

```
浏览器 MediaRecorder（复用 useAudioCapture）
  → 音频 chunk（250ms）
  → 复用 Deepgram ASR（T10）→ 非 final 转写预览 / final 转写文本
  → 【新增】AI 后处理层 lib/dictation/postprocess.ts
       输入：raw transcript + 模式配置 + 个人/组织词典
       处理：去口癖 → 去重复/自我纠正 → 自动格式化 → 术语替换 → （翻译模式）调用翻译链路
       输出：processedText
  → 前端展示可编辑卡片，用户确认后落库 VoiceNote
```

AI 后处理 Prompt 示例（消息/笔记类模式）：

```
你是语音输入清理助手。输入是一段语音转写的原始文本，可能包含口头禅（嗯/呃/就是说）、
重复表达、说话中途的自我纠正。请：
1. 去除口头禅和无意义重复
2. 保留说话人修正后的最终意图，不要保留被推翻的表述
3. 如果原文包含可枚举的要点或步骤，整理为列表
4. 不要新增原文没有的信息，不要过度改写语气
5. 直接输出整理后的文本，不要解释
```

延迟目标：参考 T11 翻译延迟规范，AI 后处理请求 P95 < 1.2s（比纯翻译宽松，因为要处理更长的整段文本而非单句）。

### 5.3 个人 / 组织词典

复用 T16 `Dictionary` / `DictionaryTerm` 模型，新增作用域字段区分组织级与个人级（见第 6 节 Schema）。语音速记默认按优先级合并加载：**个人词典优先于组织词典**（同一 source 冲突时取个人词典的 target）。个人词典入口放在 `/voice` 设置面板，复用现有 T16 的增删改查、CSV 导入导出组件。

### 5.4 历史记录与搜索

新增 `VoiceNote` 表存储每条速记（原文 + 整理后文本 + 模式 + 语言）。历史列表支持：按模式筛选、关键词全文搜索（复用 T19 `tsvector` 方案，扩展到 `VoiceNote.original_text`/`processed_text`）、单条编辑/删除/复制、批量清空。

### 5.5 选中文本 + 语音指令编辑（V2，对标 Typeless "Ask Anything"）

在整理后文本卡片中选中一段文字，触发语音指令（"更简洁"/"换正式语气"/"翻译成英文"），调用 LLM 编辑接口只替换选中片段。技术上复用现有 OpenAI 调用封装（`lib/translation`、`lib/summary` 已有的 LLM 调用模式），新增 `lib/dictation/edit-selection.ts`。

### 5.6 隐私与数据策略

Web 架构下音频必须经服务端转写，与 Superwhisper 的本地模型不同，需要在页面显著位置说明：

- 语音数据仅用于转写与 AI 整理，不用于模型训练。
- 默认不保留原始音频（短速记场景下音频转文字后即丢弃，不上传 R2），仅超过设定时长阈值（如 3 分钟）或用户主动"保存音频"时才存 R2，降低存储成本。
- 支持"临时模式"：本次速记不写入数据库历史，关闭页面即清空（对齐 Typeless 的"零留存"心智，但注意这是产品层面的临时开关，不是端到端不落库的强隐私保证，需要在文案上准确表达）。
- 历史记录随时可删除，删除即物理删除数据库记录。

---

## 6. 数据模型扩展建议

在 `prisma/schema.prisma` 现有基础上新增/修改（沿用项目现有的 cuid 主键、camelCase 字段、`@@index` 规范）：

```prisma
// 术语库新增作用域，支持个人词典
enum DictionaryScope {
  ORGANIZATION
  PERSONAL
}

model Dictionary {
  // ...现有字段保持不变
  scope DictionaryScope @default(ORGANIZATION)
  userId String?          // scope = PERSONAL 时必填，归属用户
  user   User? @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([organizationId, scope])
  @@index([userId, scope])
}

// 语音速记模式（内置 + 组织预设 + 用户自定义）
model DictationMode {
  id             String   @id @default(cuid())
  organizationId String?
  userId         String?
  key            String   // "message" | "email" | "note" | "meeting_note" | "translate" | "custom"
  name           String
  icon           String?
  systemPrompt   String   @db.Text
  targetLanguage String?
  isBuiltin      Boolean  @default(false)
  isDefault      Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
  voiceNotes   VoiceNote[]

  @@index([organizationId])
  @@index([userId])
}

// 语音速记记录
model VoiceNote {
  id             String          @id @default(cuid())
  userId         String
  organizationId String
  modeId         String?
  rawText        String          @db.Text
  processedText  String?         @db.Text
  language       String
  targetLanguage String?
  durationMs     Int
  audioUrl       String?         // 仅超阈值或用户选择保留音频时写入（R2 URL）
  status         VoiceNoteStatus @default(COMPLETED)
  isEphemeral    Boolean         @default(false)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  mode         DictationMode? @relation(fields: [modeId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt])
  @@index([organizationId, createdAt])
}

enum VoiceNoteStatus {
  PROCESSING
  COMPLETED
  FAILED
}
```

`AiLog.type`（`AiType` 枚举）新增一个值 `DICTATION_POSTPROCESS`，用于记录语音速记 AI 后处理的调用日志，复用现有 `AiLog` 表结构，无需新建日志表。

---

## 7. API 设计

沿用项目统一响应格式 `{ data, error, meta }` 和 Cursor 分页规范：

```
POST   /api/voice-notes                创建速记（提交转写文本 + 模式 → 触发 AI 后处理 → 落库）
GET    /api/voice-notes                历史列表（Cursor 分页，支持 mode/keyword 筛选）
GET    /api/voice-notes/:id            详情
PATCH  /api/voice-notes/:id            编辑整理后文本
DELETE /api/voice-notes/:id            删除
POST   /api/voice-notes/:id/reprocess  按新模式重新生成

GET    /api/dictation-modes            模式列表（内置 + 组织预设 + 个人自定义）
POST   /api/dictation-modes            创建自定义模式
PATCH  /api/dictation-modes/:id
DELETE /api/dictation-modes/:id

# 复用现有术语库 API，新增 scope 参数区分个人/组织
GET    /api/dictionaries?scope=personal
POST   /api/dictionaries?scope=personal

# V2
POST   /api/voice-notes/:id/edit-selection   选中片段 + 语音指令 → 返回替换文本
```

权限点（扩展 T06 权限矩阵）：`voicenote:create` / `voicenote:delete`，默认所有已登录组织成员可用（语音速记是个人工具，不需要 OWNER/ADMIN 级别限制），个人词典的增删改只对本人开放。

---

## 8. 与会议传译模块的整合点

- 语音速记的"会议纪要草稿"模式产出，可"一键发送到某个会议"，写入对应 `Meeting.summaryText` 或作为附加片段。
- 会议详情页可提供"发送到语音速记二次编辑"入口，把某段会议文字拉到 `/voice` 用语音指令再加工（V2 能力，依赖 5.5）。
- 两个模块共享：`AiLog` 调用记录、`Dictionary` 术语库、Redis 翻译缓存（`translate:cache:{hash}`）、R2 存储规范。

---

## 9. 技术实现要点（复用 vs 新增）

| 组件 | 复用现有能力 | 新增工作 |
|---|---|---|
| 音频采集 | `useAudioCapture`（T10） | 单人场景放宽静音检测阈值，去掉会议室的多人广播逻辑 |
| ASR | Deepgram 流式转写（T10） | 无需改动 |
| AI 后处理 | 无（新模块） | `lib/dictation/postprocess.ts`，Prompt 工程 + Zod 校验输出结构 |
| 翻译 | OpenAI + 术语库（T11） | 直接复用，翻译模式下跳过后处理，直接走翻译链路 |
| TTS | 现有播放能力（T12） | 复用"朗读"按钮 |
| 词典 | `Dictionary`/`DictionaryTerm`（T16） | 增加 `scope`/`userId` 字段和个人词典 UI |
| 历史/搜索 | `tsvector` 全文搜索方案（T19） | 扩展到 `VoiceNote` 表 |
| 存储 | R2（T08） | 新策略：短速记默认不留音频，仅长音频/用户选择时上传 |
| 权限 | RBAC `can()`（T06） | 新增两个权限点，默认全员可用 |
| 首页路由 | — | `app/page.tsx` 重定向目标从 `/dashboard` 改为 `/voice`；middleware matcher 增加 `/voice` |

---

## 10. 分阶段路线图

**V1（MVP，本次设计范围）**
- `/voice` 成为登录后默认首页，完整替换现有 `/dashboard` 跳转
- 5 个内置模式 + 1 个自定义模式
- 个人词典（基于 `Dictionary.scope` 扩展）
- 历史记录列表、全文搜索、复制/编辑/删除
- 隐私说明 + 临时模式开关
- AI 后处理（去口癖/去重复/自动格式化/术语匹配）

**V2**
- 选中文本 + 语音指令二次编辑（Ask Anything）
- 个性化语气：记录用户对整理结果的手动修改，作为"用户偏好片段"注入后续 Prompt（不做模型微调）
- 语音速记 ↔ 会议模块互通（转会议纪要 / 拉取会议片段二次编辑）
- 文件转写（上传音频/视频批量转文字，复用 R2 + Deepgram）

**V3（系统级输入方向，架构预留，暂不展开工程细节）**
- 桌面客户端（Electron/Tauri）+ 全局热键 + 系统级文本注入，对齐 Superwhisper/Typeless 的"任意 App 内语音输入"体验
- 浏览器插件版本，在任意网页输入框内唤起语音速记面板
- 本地/离线 ASR 选项评估（面向对隐私要求更高的组织客户）
- 会议场景的说话人分离（Identify Speakers）与语音速记模式融合

---

## 11. 待确认事项

- 短语音是否默认保留原始音频：当前建议默认不保留（降低 R2 成本），用户可手动"保存音频"。
- 个人词典与组织词典冲突时的优先级：建议个人词典优先，需产品侧确认是否符合团队使用习惯。
- AI 后处理会在 ASR 结果之上再叠加一次 LLM 调用，实际延迟需要用现有 `scripts/perf-test.ts` 方式实测后再定最终的体验预算（当前设计目标 P95 < 1.2s）。
- 首页从 `/dashboard` 切换到 `/voice` 后，原有依赖"登录即看统计"的使用习惯需要一次产品内引导（首次访问 Tooltip 或公告）。

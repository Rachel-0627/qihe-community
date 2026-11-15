# 启禾社区 · 项目上下文

> 基于 2026-11-15 本地 `main` 提交 `9fb633acaff6f4a67776a4bf1240d0e10fca961c` 的代码梳理。产品表述以当前代码与 `README.md` 为准；旧 PRD 与迁移记录可能反映历史阶段。

## 协作与资源归属

GitHub 仓库和 Supabase 项目由用户朋友持有；用户作为协作者提出优化需求。涉及这两项资源的权限、配置或数据库操作，先明确是否需要朋友配合，并提前告知用户协调。

## 产品与角色

启禾社区是聚焦 AI 实践的共创社区，展示案例、项目、城市活动、讨论内容与工具，帮助用户把 AI 用到工作中。访客可浏览公开内容；登录用户可投稿、互动、报名、管理个人资料及按等级权益解锁项目；管理员在后台管理内容、审核投稿、配置站点与账号。

## 技术架构

- 前端：React 18、TypeScript、Vite 8、React Router、Tailwind CSS、shadcn/ui，入口 `src/main.tsx`，页面路由 `src/routes.tsx`，顶层状态 `src/App.tsx` 与 `src/contexts/`。
- 数据：Supabase Postgres、Auth、Storage、RPC 与 Edge Functions。`src/db/supabase.ts` 创建客户端；`src/lib/` 处理数据读写和业务辅助逻辑；`src/types/` 放类型。
- 服务端：`api/share.ts` 为详情页生成分享元信息与可抓取内容，`api/sitemap.ts` 生成站点地图；`supabase/functions/` 有 AI 助手、翻译、生图、用户生图配置和管理员账号操作。
- 部署：`vercel.json` 配置 pnpm 冻结锁文件安装、Vite 构建和路由重写。仓库文档称 `main` 推送触发 Vercel 部署；本轮未验证线上连接或部署状态。

## 目录与业务流

| 路径 | 用途 |
|---|---|
| `src/pages/` | 首页、案例、项目、活动、讨论、工具、权益、登录、个人中心、投稿、后台等页面 |
| `src/components/` | 布局、卡片、编辑器、投稿、讨论、后台模块和通用 UI |
| `src/contexts/` | 登录、站点设置、文案、中英切换、AI 助手状态 |
| `src/lib/` | Supabase 数据访问、投稿和讨论 API、编辑器与导入工具 |
| `api/` | Vercel 服务端分享页和 sitemap |
| `supabase/migrations/` | 当前版本含 52 个迁移文件；00052 的新增社区能力尚未应用到 Supabase |
| `supabase/schema.sql` | 数据库结构快照，需与迁移和实际线上库分别核对 |
| `supabase/functions/` | 5 个 Edge Functions |
| `public/` | 图片、图标、字体等静态资源 |
| `docs/`、`PROJECT_MAP.md` | 历史需求、视觉说明与详细代码地图 |

- 公开内容：案例、项目、活动、讨论与工具；项目详情有免费/权益解锁判断，正文获取涉及 `get_project_content()` 等数据库函数。
- 登录：`AuthContext.tsx` 用 Supabase Auth；用户名转为历史邮箱格式 `<用户名>@miaoda.com`。`RouteGuard.tsx` 拦截需登录路由；后台再检查 `profiles.role === 'admin'`。数据库 RLS / RPC 才是数据操作的权限边界。
- 投稿审核：案例、项目、帖子投稿先写 `content_submissions`；管理员在 `AdminSubmissions.tsx` 审核，通过后经 `review_submission()` 写到正式表。待审、退回、草稿与已发布修改申请有不同流程；帖子表单独立实现。
- 互动与权益：签到、点赞收藏、活动报名、等级和免费解锁额度通过 Supabase 表及 RPC 实现。具体规则应以对应迁移和页面代码核实。
- 后台：`AdminPage.tsx` 按工作台、内容中心、社区治理、投稿审核、页面装修、会员权益、智能助手、账号管理分栏。社区治理依赖待部署迁移中的管理 RPC 与 RLS。
- 交流与连接：`/discuss` 保留历史 URL，现有审核发帖、详情和评论不变；新增交流分类、搜索/排序/客户端分页、独立互动和举报入口。成员匹配用独立连接档案与 Supabase RPC，服务端按公开授权筛选推荐，连接申请、联系方式与通知受数据库权限控制。结构定义在 `00052_community_connections.sql`，生产数据库没有执行本地迁移。

## 配置与验证入口

- 本地包管理：`pnpm-lock.yaml`；Node 要求 `>=20.11`。本地安装依赖不更改锁文件。
- 前端必需：`.env` 中 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_ANON_KEY`；`.env.example` 另列 `VITE_APP_ID`，当前代码搜索未发现使用。`VITE_SENTRY_DSN` 在 `src/main.tsx` 可选使用。
- Vercel API：`SUPABASE_URL`、`SUPABASE_ANON_KEY`。Edge Functions 读取 Supabase 服务端变量；AI 助手/翻译还读取 `INTEGRATIONS_API_KEY`，历史文档指出其上游网关迁移问题，需实测现状。
- 命令：`pnpm dev`、`npm run build`、`pnpm exec vitest run`、`pnpm exec tsgo -p tsconfig.check.json`、`pnpm exec biome lint .`。构建通过不代表后端已连接。

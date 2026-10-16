# 启禾社区 QIHE

聚焦 AI 实践的共创社区：汇聚案例、项目、城市组局活动与精选工具，
目标是带各行各业的人把 AI 真正用进自己的工作里。

线上地址：<https://qihe.bj.cn>

## 技术栈

| 层 | 用什么 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Tailwind + shadcn/ui |
| 后端 | Supabase（Postgres + Auth + Storage + Edge Functions） |
| 部署 | Vercel，推 `main` 自动部署 |

## 本地跑起来

```bash
pnpm install        # 安装依赖
npm run lint        # 类型检查 + 代码检查 + 规则扫描 + 试构建
```

> `dev` 与 `build` 两个命令目前在 `package.json` 里是禁用状态（留着的平台限制），
> 日常用 `lint` 做检查，正式构建交给 Vercel。需要本地起服务时再解开。

### 环境变量

复制 `.env.example` 为 `.env` 并填写：

| 变量 | 说明 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase 项目地址，必须是 `https://rrotrtbhqthvfuteoryv.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |

服务端函数（`api/`）另外需要在 Vercel 配 `SUPABASE_URL`、`SUPABASE_ANON_KEY`——
它们读不到 `VITE_` 开头的变量。

⚠️ `.env` 不在版本库里，容易指错后端。确认线上实际连的是哪个库：

```bash
curl -s https://qihe.bj.cn/ | grep -o 'assets/index-[^"]*\.js'   # 拿到产物名
curl -s https://qihe.bj.cn/assets/index-xxxx.js | grep -o 'https://[a-z0-9]*\.supabase\.co'
```

## 代码结构

每个文件、每个模块负责什么，见 **[PROJECT_MAP.md](PROJECT_MAP.md)**——
新增或改动文件时要同步更新它。

```
src/pages/        页面
src/components/   组件（layouts / home / cards / editor / admin / common）
src/contexts/     全局状态（登录、站点设置、文案、中英切换）
src/lib/          数据读写与工具函数
supabase/         数据库迁移与 Edge Functions
api/              Vercel 服务端函数（详情页分享卡片）
.rules/           ast-grep 自定义规则，由 npm run lint 调用
```

## 几个容易踩的点

- **分享卡片**：详情页的标题与封面由 `api/share.ts` 在服务端写入 HTML，
  因为微信等抓取方不执行 JS。改动 `vercel.json` 的重写规则时，
  详情页两条必须排在 `/(.*)` 兜底之前。
- **AI 助手与翻译**：两个 Edge Function 仍调用外部网关（见 `MIGRATION.md`），
  依赖 `INTEGRATIONS_API_KEY`。
- **登录邮箱格式**：用户名会拼成 `<用户名>@miaoda.com` 去调 Supabase Auth，
  这是历史格式，老用户的账号都按这个存，不能随便改。

## 相关文档

- [PROJECT_MAP.md](PROJECT_MAP.md) — 文件与模块职责清单
- [MIGRATION.md](MIGRATION.md) — 迁移到 Vercel + Supabase 的历史记录
- `docs/prd.md` / `docs/DESIGN.md` — 产品需求与设计说明

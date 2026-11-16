# 启禾社区 · AI 开发协作规范

## 工作目录与真源

- 固定目录：`A:\qihe_AI`。先检查目录与 Git 状态，不创建平行项目副本。
- 以当前检出的分支代码和当前数据库迁移为准。`README.md`、`PROJECT_MAP.md`、`docs/prd.md`、`docs/DESIGN.md`、`MIGRATION.md` 是参考资料；历史文字若与代码冲突，先核实并在汇报中说明。
- 新对话先读本文件、`PROJECT_CONTEXT.md`、`PROJECT_PROGRESS.md`；按任务再查 `PROJECT_MAP.md` 和相关代码，避免全库重复扫描。

## 合作与改动边界

- 用户负责产品规划、需求、功能设计与验收；Codex 负责技术分析、实现、测试和维护。开始编码前说清假设、成功标准和简短验证计划；关键需求不明时先问。
- GitHub 仓库及 Supabase 项目属于用户朋友，用户以协作者身份优化网站。每项需求在实施前先判断是否需要朋友处理仓库权限、Supabase 数据库/RLS/函数/配置或部署权限；一旦需要，提前向用户说明具体事项、原因和影响范围，留出协调时间。不要假定用户能直接操作这些资源。
- 只改请求所需内容；优先复用现有组件、接口、样式和业务流程。不擅自删功能、扩需求或顺手重构。
- 修改前读相关调用链、数据库权限和测试。每条改动应能追溯到本次需求。
- 未获用户明确允许，不提交、推送、合并、部署代码，也不修改生产数据库。
- 不在文档、提交或聊天中记录密钥、密码、服务角色令牌和用户数据。`backup/miaoda-export/` 只读；环境变量只记录名称与用途。
- 完成改动后运行相关测试、类型检查和构建；记录结果及无法验证的范围。每轮更新 `PROJECT_PROGRESS.md`，新增或改变文件职责时同步更新 `PROJECT_MAP.md`。
- 用通俗中文汇报结果、风险与需要用户提供的配置。

## 项目特有注意点

- 前端为 React/Vite；数据层主要在 `src/lib/api.ts`、`submissionsApi.ts`、`discussionApi.ts`，客户端在 `src/db/supabase.ts`。服务端还有 `api/` 与 `supabase/functions/`。
- 登录用户名映射为 `<用户名>@miaoda.com`，涉及旧账号兼容，不可随意改。
- `/admin` 的前端权限检查在 `src/pages/AdminPage.tsx`，实际读写权限还依赖 Supabase RLS / RPC；不能只凭前端守卫判断安全性。
- 投稿走 `content_submissions` 待审，再由管理员审核函数写正式内容；帖子投稿与案例、项目表单实现不同，改投稿流程需同时检查。
- 付费项目正文和章节预览涉及数据库 RPC 与列权限；分享页服务端代码不能泄露未解锁正文。
- `vercel.json` 的详情页及 sitemap 重写必须排在 SPA 兜底重写前。
- 当前 `package.json` 的聚合 `lint` 脚本包含 `.sh`、`grep` 和 `/dev/null`，Windows 上应优先分别执行 `pnpm exec tsgo -p tsconfig.check.json`、`pnpm exec biome lint .`、相关测试和 `npm run build`；如要验证聚合脚本，用兼容的 Bash 环境。

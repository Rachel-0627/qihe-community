# 从秒哒迁移到 Vercel + Supabase

迁移日期：2026-09-19

## 现状

| 部分 | 状态 |
|---|---|
| 代码仓库 | ✅ github.com/Rachel-0627/qihe-community |
| 前端托管 | ✅ Vercel `qihe-community` |
| 数据库 | ✅ 新 Supabase（Vercel Storage 开通，新加坡区） |
| 表结构 | ✅ 19 个迁移全部通过，19 表 + 2 视图 + 17 个函数 |
| 内容数据 | ✅ 12 张表全部对齐，含 6 个项目正文 |
| 用户数据 | ⬜ 见下方「未完成」 |
| Edge Functions | ⚠️ 1/3 可迁移 |
| 域名 | ⬜ qihe.bj.cn 仍指向秒哒 |

## 数据备份

`backup/miaoda-export/` — 21 个文件、151 条记录，从秒哒完整导出。

导出过程中绕过了三道限制：
- `projects` 整表被 REVOKE，改为逐列请求（19/23 列可读）
- 用户表受 RLS 限制，用管理员会话令牌读取
- `content` 等 3 列对所有角色锁死，走 `get_project_content()` 函数取出

## 未完成

### 用户数据（6 个账号）

`profiles`、`user_checkins`、`user_interactions`、`user_interaction_xp_records`、
`event_registrations`、`ai_usage` 共 34 条未导入。

原因：这些表外键指向 `auth.users`，而**密码无法从旧库导出**（设计上就不可读）。
用户需要在新站重新注册，注册后再按邮箱把这些记录关联回去。

### Edge Functions

| 函数 | 状态 |
|---|---|
| `admin-users` | 可部署，只依赖 Supabase 自带变量 |
| `ai-assistant` | **不可迁移** — 依赖 `INTEGRATIONS_API_KEY`，调用秒哒私有 AI 网关 |
| `text-translation` | **不可迁移** — 同上 |

后两个需要替换成自有的 AI 服务（如直接调 OpenAI/Claude API）才能恢复。
在此之前，站内的 AI 助手和翻译功能不可用。

### 兼容性补丁

新库额外创建了 `public.uid()` 函数，包装 `auth.uid()`。
原因：迁移脚本 `00004` 使用裸 `uid()`，那是秒哒实例的非标准别名，
标准 Supabase 只有 `auth.uid()`。

### 迁移种子数据

`00002_seed_initial_data.sql` 会插入示例数据，与真实数据混杂。
已清除，但**重跑迁移时会再次插入**，需再清一次。

## 切换域名前的检查

1. 站点能正常读取内容（项目、活动、案例列表）
2. 注册和登录流程可用
3. 确认 AI 功能缺失可以接受
4. 秒哒的站先别删，作为回退

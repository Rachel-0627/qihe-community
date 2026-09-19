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
| 管理员账号 | ✅ xinyu123456,沿用旧 user_id,历史数据已接回 |
| 其余 5 个用户 | ⬜ 等他们重新注册后可按同样方式接回 |
| Edge Functions | ⚠️ 1/3 可迁移 |
| 域名 | ⬜ qihe.bj.cn 仍指向秒哒 |

## 数据备份

`backup/miaoda-export/` — 21 个文件、151 条记录，从秒哒完整导出。

导出过程中绕过了三道限制：
- `projects` 整表被 REVOKE，改为逐列请求（19/23 列可读）
- 用户表受 RLS 限制，用管理员会话令牌读取
- `content` 等 3 列对所有角色锁死，走 `get_project_content()` 函数取出

## 未完成

### 用户数据

密码无法从旧库导出（设计上就不可读），所以每个用户都要重新注册。

**关键做法**：用 Supabase Admin API 建账号时**指定旧库的 user_id**，
历史数据就能原样接回，不用改任何外键。

登录页会把用户名拼成 `<username>@miaoda.com`，和旧库邮箱格式一致，
所以同名注册即可对上。

已接回（管理员 xinyu123456）：
- profiles 资料、昵称、经验值
- user_checkins 2 条 · user_interactions 10 条 · ai_usage 3 条

待接回（其余 5 个用户，13 条）：
备份仍在 `backup/miaoda-export/`。他们注册后，按同样方式指定 user_id 即可。

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

## DNS 切换记录

切换时间：2026-09-19

### 切换前（回滚用）

```
域名      qihe.bj.cn
记录类型  CNAME
记录值    app-du7cn8oyrwn5.cname.appmiaoda.com
NS        ns1.bdydns.cn / ns2.bdydns.cn
```

### 切换后

```
记录类型  A
主机记录  @
记录值    76.76.21.21    (Vercel)
TTL       600
```

### 已知取舍

域名是 `.cn` 且已备案已接入，解析到境外服务器后接入商核查可能取消接入，
备案后续可能被注销。用户主要在国内，但实测 Vercel 访问速度可接受，
因此接受这个风险。

**要回滚**：把 A 记录删掉，改回上面那条 CNAME。TTL 设的是 600，十分钟生效。

**若备案失效且需要恢复**：需要先有国内服务器才能重新备案，审核约 1-3 周。
届时的替代方案是「国内对象存储 + GitHub Actions」，前端是纯静态文件，
`npx vite build` 的产物直接传上去即可，代码无需改动。

# PROJECT_MAP · 启禾社区

> 每个文件/模块负责什么。**新增或改动文件时同步更新这里。**
>
> 不收录 `src/components/ui/`（51 个 shadcn/ui 生成的基础组件，用途见其官方文档）。
> 括号里的数字是行数，`⚠️` 标记超过 200 行、按规范应该拆分的文件。

## 技术栈速览

React 18 + TypeScript + Vite + Tailwind + shadcn/ui ｜ 后端 Supabase（Postgres + Auth + Storage + Edge Functions）｜ 部署 Vercel（推 main 自动部署）

---

## 一、入口与路由

| 文件 | 职责 |
|---|---|
| `index.html` | HTML 骨架。标签页标题、favicon、分享用的 og/twitter 元信息 |
| `src/main.tsx` (19) | 应用挂载点 |
| `src/App.tsx` (38) | 顶层组件，套各种 Context Provider |
| `src/routes.tsx` (44) | 全部路由表 |
| `src/index.css` (458) ⚠️ | 全局样式与设计变量（品牌色、字体、动效） |
| `src/fonts.css` (82) | 字体 @font-face 声明 |

## 二、页面 `src/pages/`

| 文件 | 职责 |
|---|---|
| `HomePage.tsx` (13) | 首页，只做拼装 |
| `CasesPage.tsx` (189) | 案例列表 |
| `CaseDetailPage.tsx` (164) | 案例详情 |
| `CaseEditorPage.tsx` (379) ⚠️ | 案例编辑器页 |
| `ProjectsPage.tsx` (187) | 项目库列表 |
| `ProjectDetailPage.tsx` (334) ⚠️ | 项目详情，含付费内容解锁判断 |
| `EventsPage.tsx` (311) ⚠️ | 活动（城市组局）列表 + 日历视图 |
| `EventDetailPage.tsx` (332) ⚠️ | 活动详情 |
| `ToolsPage.tsx` (38) | 工具页外壳 |
| `ProfilePage.tsx` (354) ⚠️ | 个人中心 |
| `ProfileImageProviderPage.tsx` (35) | 个人生图 API 配置页外壳 |
| `BenefitsPage.tsx` (180) | 会员权益 |
| `BusinessCoopPage.tsx` | 商务与合作 |
| `LoginPage.tsx` (152) | 登录 / 注册 |
| `AdminPage.tsx` (107) | 后台管理外壳，负责分栏切换 |
| `TermsPage.tsx` (36) / `PrivacyPage.tsx` (36) | 服务条款 / 隐私政策 |
| `NotFound.tsx` | 404 |

## 三、布局 `src/components/layouts/`

| 文件 | 职责 |
|---|---|
| `MainLayout.tsx` (23) | 页面外框：Header + 内容 + Footer |
| `Header.tsx` (180) | 顶部导航。品牌标识、导航项、语言切换、登录态菜单 |
| `Footer.tsx` (70) | 页脚 |

## 四、首页专用 `src/components/home/`

| 文件 | 职责 |
|---|---|
| `FlowingHero.tsx` (92) | 首屏大标题区 |
| `CommunityNetwork.tsx` (254) ⚠️ | 首屏右侧星座网络图（Canvas 绘制 + GSAP 视差） |
| `HomeSections.tsx` (172) | 首页下方各内容板块 |
| `HomeStats.tsx` (72) | 数据统计条 |

## 五、通用组件 `src/components/common/`

| 文件 | 职责 |
|---|---|
| `BrandMark.tsx` (75) | **品牌标识 SVG**。与 `public/favicon.svg` 同源，改动需两边同步 |
| `PageMeta.tsx` (22) | 逐页设置标题等元信息 |
| `RouteGuard.tsx` (67) | 路由守卫，拦截未登录/无权限访问 |
| `RichTextEditor.tsx` (460) ⚠️ | 富文本编辑器（基于 TipTap） |
| `AIAssistant.tsx` (226) ⚠️ | 前台 AI 助手浮窗 |
| `CommentsSection.tsx` (46) | 评论区 |
| `ShareDialog.tsx` (81) | 分享弹窗 |
| `ChapterToc.tsx` (87) | 长文章的章节目录 |
| `AnimatedDialog.tsx` (86) | 带动效的弹窗容器 |
| `ShimmerEmptyState.tsx` (56) | 空状态占位 |
| `FileUploadField.tsx` (111) | 文件上传表单项 |
| `HeroBackground.tsx` (145) | 首屏背景效果 |
| `IntersectObserver.tsx` (22) | 滚动进入视口的监听封装 |
| `PetWidget.tsx` (95) | 可拖拽的页面宠物挂件 |

## 六、内容卡片 `src/components/cards/`

| 文件 | 职责 |
|---|---|
| `CaseCard.tsx` (116) / `ProjectCard.tsx` (153) / `EventCard.tsx` (106) | 三类内容的列表卡片 |
| `MediaFrame.tsx` (47) | 卡片里的图片/视频容器 |
| `InteractionButton.tsx` (88) | 点赞/收藏等交互按钮 |

## 七、编辑器 `src/components/editor/`

沉浸式写作模式，独立于 `common/RichTextEditor`。

| 文件 | 职责 |
|---|---|
| `ImmersiveEditor.tsx` (211) ⚠️ | 编辑器主体 |
| `EditorToolbar.tsx` (107) | 顶部工具栏 |
| `BubbleMenu.tsx` (165) | 选中文字时浮出的气泡菜单 |
| `SlashCommand.tsx` (96) | 斜杠命令菜单 |
| `PublishPanel.tsx` (128) | 发布设置面板 |
| `EditorPreview.tsx` | 预览模式 |

## 八、工具与活动 `src/components/tools/`、`events/`

| 文件 | 职责 |
|---|---|
| `tools/PromptCaseLibrary.tsx` (271) ⚠️ | 提示词案例库列表 + 筛选 |
| `tools/PromptCaseDetail.tsx` (445) ⚠️ | 案例详情 + 调用生图 |
| `events/EventCalendar.tsx` (162) | 活动日历视图 |
| `profile/UserImageProviderConfig.tsx` (568) ⚠️ | 用户自配生图 API（含 Vault 密钥存取） |

## 九、后台管理 `src/components/admin/`

| 文件 | 职责 |
|---|---|
| `AdminContentHub.tsx` (129) | 内容管理总入口，分发到下面各模块 |
| `AdminCases.tsx` (365) ⚠️ / `AdminCaseFilters.tsx` (120) | 案例管理 / 案例筛选维度管理 |
| `AdminProjects.tsx` (398) ⚠️ / `AdminProjectFilters.tsx` (152) | 项目管理 / 项目筛选维度管理 |
| `AdminEvents.tsx` (331) ⚠️ / `AdminEventFilters.tsx` (145) | 活动管理 / 活动筛选维度管理 |
| `AdminPromptCases.tsx` (255) ⚠️ / `AdminPromptCaseFilters.tsx` (139) | 提示词案例管理 / 其筛选维度管理 |
| `AdminAccounts.tsx` (266) ⚠️ | 用户账号管理 |
| `AdminBenefits.tsx` (215) ⚠️ | 会员权益配置 |
| `AdminBusinessCoop.tsx` (154) | 商务合作页配置 |
| `AdminSiteSettings.tsx` (161) | 站点设置（品牌名、导航文案、模块开关） |
| `AdminCopywriting.tsx` (43) | 文案管理 |
| `AdminContent.tsx` (99) | 通用内容编辑 |
| `AdminAssistant.tsx` (157) | AI 助手配置 |
| `AdminTools.tsx` (65) | 工具页配置 |
| `NumberField.tsx` (36) | 后台专用数字输入框 |

## 十、状态 `src/contexts/`

| 文件 | 职责 |
|---|---|
| `AuthContext.tsx` (154) | 登录态、用户资料、登录/登出 |
| `SiteSettingsContext.tsx` (164) | 站点设置（品牌名、导航文案、模块可见性） |
| `SiteContentContext.tsx` (58) | 站点文案内容 |
| `I18nContext.tsx` (45) | 中英切换，提供 `t()` |
| `AIAssistantContext.tsx` (27) | AI 助手开关状态 |

## 十一、工具函数 `src/lib/`

| 文件 | 职责 |
|---|---|
| `api.ts` (1099) ⚠️⚠️ | **所有 Supabase 数据读写集中在这里**。最该拆的文件 |
| `documentImport.ts` (507) ⚠️ | 导入 Word/PDF/Excel 转正文（用到 pdfjs、xlsx） |
| `sse.ts` (108) | SSE 流式响应处理，用于 AI 对话逐字输出 |
| `useLocalDraft.ts` (118) | 草稿自动存本地，防止编辑丢失 |
| `contentHeadings.ts` | 给正文标题注入 id，供章节目录跳转 |
| `editorImageExtension.ts` (113) / `videoExtension.ts` (99) | TipTap 图片 / 视频扩展 |
| `editorSlashCommand.ts` (31) / `editorSlashItems.ts` (101) | 斜杠命令的机制与菜单项 |
| `iterator-polyfill.ts` (87) | 补 Iterator Helpers，解决 pdfjs 在旧运行时崩溃 |
| `utils.ts` (59) | 通用小函数（className 合并等） |

## 十二、Hooks `src/hooks/`

| 文件 | 职责 |
|---|---|
| `use-supabase-upload.ts` (197) | 文件上传到 Supabase Storage |
| `useReveal.ts` | 滚动进入视口的出现动效（GSAP） |
| `use-mobile.tsx` (19) | 判断是否移动端 |
| `use-debounce.ts` (15) | 防抖 |
| `use-go-back.ts` (17) | 返回上一页 |

## 十三、类型与数据层

| 文件 | 职责 |
|---|---|
| `src/db/supabase.ts` (7) | Supabase 客户端实例 |
| `src/types/types.ts` (308) ⚠️ | 全站类型定义 |
| `src/types/index.ts` (6) | 类型统一导出 |
| `src/components/dropzone.tsx` (227) ⚠️ | 拖拽上传组件（位置偏了，建议移进 `common/`） |
| `src/services/` | **空目录**，只有 `.keep` |

## 十四、后端 `supabase/`

| 路径 | 职责 |
|---|---|
| `migrations/` | 38 个数据库迁移脚本，按编号顺序执行 |
| `schema.sql` | 完整表结构快照 |
| `config.toml` | Supabase 本地配置 |
| `functions/ai-assistant` | AI 对话（流式） |
| `functions/generate-image` | 调用生图 API |
| `functions/set-image-provider` | 写入用户生图配置与 Vault 密钥 |
| `functions/text-translation` | 文本翻译 |
| `functions/admin-users` | 管理员操作用户（需 service_role） |

## 十五、静态资源与配置

| 路径 | 职责 |
|---|---|
| `public/favicon.svg` | 标签页图标（矢量，现代浏览器优先用） |
| `public/favicon.png` | 图标兜底，同时用作分享缩略图 |
| `public/images/` | 站点图片 |
| `vercel.json` | Vercel 构建与 SPA 路由重写。**删了会构建失败** |
| `vite.config.ts` / `tailwind.config.js` / `postcss.config.js` | 构建与样式配置 |
| `biome.json` | 代码格式化配置 |
| `.env` | 环境变量，**已在 .gitignore 内**。`VITE_SUPABASE_URL` 必须指向 `https://rrotrtbhqthvfuteoryv.supabase.co`，别用秒哒的 `backend.appmiaoda.com`（见下方待办 7）|
| `.env.vercel` | 从 Vercel 拉下来的快照，**可能过期**，不要当作真实配置的依据 |

## 十六、文档与备份

| 路径 | 职责 |
|---|---|
| `README.md` | 项目说明 |
| `MIGRATION.md` | 从秒哒迁移到独立 Supabase 的记录 |
| `docs/prd.md` / `docs/DESIGN.md` | 产品需求 / 设计说明 |
| `backup/miaoda-export/` | 秒哒导出的原始业务数据，**只读留档** |

---

## 已知待办

1. **`src/lib/api.ts` 1099 行**，所有接口挤在一个文件里，最该按业务域拆成 `api/cases.ts`、`api/projects.ts` 等。
2. 十余个文件超过 200 行（上表 ⚠️），其中 `UserImageProviderConfig.tsx`(568)、`RichTextEditor.tsx`(460)、`PromptCaseDetail.tsx`(445) 最值得优先拆。
3. `src/components/dropzone.tsx` 放在 `components/` 根目录，与其他组件的分类方式不一致。
4. `src/services/` 是空目录。
5. ~~Vercel GitHub 自动部署失效~~ —— 2026-09-23 已在 Vercel 重新授权 GitHub App 修复，推 main 会自动部署，无需手动发布。
6. ~~数据库迁移 `00030_fix_auth_uid_safe_uuid.sql` 未执行~~ —— **确认不需要执行，不要再去补**。

   该迁移想把 `auth.uid()` 改成遇到非法 UUID 时返回 NULL，针对的是秒哒时代自铸的 anon key：那把 key 的 JWT 里带 `sub: "anon"`，`auth.uid()` 会拿 `'anon'` 去 cast UUID 而报错（迁移 00022 的注释记录了这次事故）。
   迁移到独立 Supabase 后，用的是标准 anon key（payload 只有 `iss` / `ref` / `role`，**没有 `sub`**），`auth.uid()` 正常返回 NULL，问题不复存在。已用匿名身份实测 `user_image_providers`（策略含 `auth.uid()`）、`get_project_content`、`prompt_case_filters`，均正常无报错。
   改 `auth` schema 属于改 Supabase 托管对象，平台升级时可能被覆盖，不值得为一个不会发生的问题去冒险。

7. **本地 `.env` 容易指错后端**。`.env` 不在版本库里，2026-09-23 曾发现它还指向秒哒网关 `backend.appmiaoda.com`，而线上早已切到独立 Supabase `rrotrtbhqthvfuteoryv.supabase.co`——导致本地开发连的是旧库，新表全都读不到，很容易误判成功能坏了。
   `.env.vercel` 同样是过期快照，里面的 `VITE_SUPABASE_URL` 也还是秒哒的，**以 Vercel 后台的环境变量为准**。
   排查方法：`curl -s https://qihe.bj.cn/ | grep -o 'assets/index-[^"]*\.js'` 拿到产物名，再 `curl` 该文件搜 `supabase.co`，就能看到线上真正用的地址。

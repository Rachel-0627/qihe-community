-- Categories
INSERT INTO public.categories (name, name_en, slug, sort_order) VALUES
('视觉创意', 'Visual Creativity', 'visual', 1),
('效率工具', 'Productivity Tools', 'productivity', 2),
('商业应用', 'Business Applications', 'business', 3),
('教育科研', 'Education & Research', 'education', 4),
('内容创作', 'Content Creation', 'content', 5);

-- Level config (XP thresholds)
INSERT INTO public.level_config (level, title, title_en, xp_threshold, sort_order) VALUES
(1, '探索者', 'Explorer', 0, 1),
(2, '观察者', 'Observer', 100, 2),
(3, '学习者', 'Learner', 300, 3),
(4, '实践者', 'Maker', 600, 4),
(5, '构建者', 'Builder', 1000, 5),
(6, '创作者', 'Creator', 1500, 6),
(7, '先行者', 'Pioneer', 2200, 7),
(8, '创新者', 'Innovator', 3000, 8),
(9, '专家', 'Expert', 4000, 9),
(10, '先锋', 'Vanguard', 5500, 10);

-- Member benefits
INSERT INTO public.member_benefits (tier, benefit_key, benefit_label, benefit_label_en, enabled, sort_order) VALUES
('guest', 'view_public', '浏览公开项目', 'Browse public projects', true, 1),
('guest', 'view_partial_cases', '查看部分公开案例', 'View partial public cases', true, 2),
('explorer', 'search', '搜索项目', 'Search projects', true, 1),
('explorer', 'favorite', '收藏项目', 'Favorite projects', true, 2),
('explorer', 'like', '点赞互动', 'Like & interact', true, 3),
('explorer', 'comment', '评论参与', 'Comment & participate', true, 4),
('explorer', 'checkin', '每日签到获取XP', 'Daily check-in for XP', true, 5),
('member', 'full_cases', '完整项目案例', 'Full project cases', true, 1),
('member', 'deep_analysis', '深度案例拆解', 'Deep case breakdown', true, 2),
('member', 'materials', '项目资料与Prompt', 'Project materials & Prompts', true, 3),
('member', 'workflows', '工作流资源', 'Workflow resources', true, 4),
('member', 'member_zone', '会员专区活动', 'Member-only events', true, 5),
('pro', 'all_cases', '全部高级案例', 'All premium cases', true, 1),
('pro', 'private_projects', '私密项目', 'Private projects', true, 2),
('pro', 'collaboration', '项目合作机会', 'Project collaboration', true, 3),
('pro', 'priority', '优先报名参与', 'Priority registration', true, 4),
('pro', 'internal', '内部项目资源库', 'Internal resource library', true, 5);

-- Assistant config
INSERT INTO public.assistant_config (persona_name, persona_name_en, system_prompt, system_prompt_en, greeting, greeting_en) VALUES
('Aria · AI社区助手', 'Aria · AI Community Assistant',
'你是 Aria，一个高端 AI 创业社区的智能助手。你的风格克制、专业、有品味，像一位资深的 AI 领域策展人。回答简洁有洞察，善用结构化表达，避免空话套话。当不确定时坦诚说明，并引导用户去项目库或案例区探索。',
'You are Aria, an intelligent assistant for a premium AI startup community. Your tone is restrained, professional, and tasteful, like a senior AI curator. Answer concisely with insight, use structured expression, and avoid fluff. When unsure, be honest and guide users to explore the project library or case gallery.',
'你好，我是 Aria。在这里，每一个 AI 项目都值得被认真探索。有什么我可以帮你的吗？',
'Hi, I''m Aria. Here, every AI project deserves thoughtful exploration. How can I help you today?');

-- Site content (editable elements)
INSERT INTO public.site_content (section, key, value, value_en, image_url) VALUES
('hero', 'title', '探索 AI 的边界，共建创新社区', 'Explore the frontier of AI, build together', ''),
('hero', 'subtitle', '一个面向 AI 爱好者、创作者与项目探索者的高端社区，汇聚前沿案例、项目与线下连接。', 'A premium community for AI enthusiasts, creators, and project explorers — gathering frontier cases, projects, and real-world connections.', ''),
('hero', 'cta_primary', '浏览案例', 'Browse Cases', ''),
('hero', 'cta_secondary', '探索项目库', 'Explore Projects', ''),
('footer', 'brand', 'AI 创业社区', 'AI Startup Community', ''),
('footer', 'tagline', '高端 AI 项目社区 · 创新实验室 × 数字艺术展览', 'Premium AI project community · Innovation lab × Digital art gallery', ''),
('footer', 'copyright', '© 2026 AI 创业社区. 保留所有权利。', '© 2026 AI Startup Community. All rights reserved.', '');

-- Cases (飞书文档式 content blocks)
INSERT INTO public.cases (title, title_en, summary, summary_en, cover_url, category_id, content, author, likes, favorites, views, is_featured, sort_order) VALUES
('用 AI 重构品牌视觉系统', 'Rebuilding Brand Visual Systems with AI', '探索如何利用生成式 AI 快速构建一致、有质感的品牌视觉语言。', 'Explore how generative AI rapidly builds consistent, tasteful brand visual languages.', 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_5cd2aec7-3274-46b1-a7b2-5175a74dc9f6.jpg', (SELECT id FROM categories WHERE slug='visual'),
'[{"type":"heading","text":"项目背景"},{"type":"paragraph","text":"传统品牌视觉系统设计周期长、成本高。我们尝试用生成式 AI 将概念到成品的周期压缩到原来的十分之一。"},{"type":"image","url":"https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_b53af21d-a771-456a-bfa1-f2e5367c3832.jpg","caption":"AI 辅助生成的品牌主视觉"},{"type":"heading","text":"方法论"},{"type":"paragraph","text":"建立结构化的提示词体系，结合风格参考图与色彩约束，确保输出的一致性与高级感。"},{"type":"quote","text":"克制是高级感的来源——AI 给得越多，越要学会取舍。"}]'::jsonb,
'林知远', 328, 156, 2840, true, 1),

('神经网络可视化：让算法可被理解', 'Neural Network Visualization: Making Algorithms Understandable', '一套优雅的交互式可视化方案，把黑盒模型变成可探索的视觉语言。', 'An elegant interactive visualization that turns black-box models into explorable visual language.', 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_396dccf4-1d86-4260-abc6-12331a597df7.jpg', (SELECT id FROM categories WHERE slug='education'),
'[{"type":"heading","text":"设计理念"},{"type":"paragraph","text":"我们相信，理解始于看见。通过实时渲染神经网络的激活与连接，让非技术用户也能直观感受模型的决策过程。"},{"type":"image","url":"https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_3915e17e-ed5e-4502-b1d5-f668a7058c4e.jpg","caption":"交互式可视化界面"}]'::jsonb,
'苏黎', 412, 203, 3560, true, 2),

('AI 驱动的智能客服系统', 'AI-Powered Customer Service System', '基于大模型构建的多轮对话客服，兼顾效率与温度。', 'A multi-turn conversational customer service built on LLMs, balancing efficiency and warmth.', 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_477b9e84-4ed2-4ec9-bbbf-7aa91c4c0570.jpg', (SELECT id FROM categories WHERE slug='business'),
'[{"type":"heading","text":"挑战"},{"type":"paragraph","text":"传统客服系统僵硬、缺乏上下文。我们用大模型重构对话引擎，让每一次交互都更自然。"},{"type":"image","url":"https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_477b9e84-4ed2-4ec9-bbbf-7aa91c4c0570.jpg","caption":"智能对话界面"}]'::jsonb,
'陈默', 289, 134, 2100, false, 3),

('生成式音乐创作平台', 'Generative Music Creation Platform', '让每个人都能用自然语言创作属于自己的音乐。', 'Empower everyone to create their own music through natural language.', 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_5c423e16-4691-41e8-b00f-c9886dfa53c2.jpg', (SELECT id FROM categories WHERE slug='content'),
'[{"type":"heading","text":"创作流程"},{"type":"paragraph","text":"用户描述情绪与场景，平台生成多轨音乐，支持实时微调与导出。"},{"type":"image","url":"https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_5c423e16-4691-41e8-b00f-c9886dfa53c2.jpg","caption":"音乐生成工作台"}]'::jsonb,
'周漾', 356, 178, 3020, true, 4),

('AI 辅助医学影像分析', 'AI-Assisted Medical Imaging Analysis', '用计算机视觉提升早期病灶识别的准确率与效率。', 'Using computer vision to improve early lesion detection accuracy and efficiency.', 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_41b615ae-47a6-466c-9f3a-f4a851463b08.jpg', (SELECT id FROM categories WHERE slug='education'),
'[{"type":"heading","text":"应用价值"},{"type":"paragraph","text":"在保持医生最终决策权的前提下，AI 作为第二意见显著降低漏诊率。"},{"type":"image","url":"https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_41b615ae-47a6-466c-9f3a-f4a851463b08.jpg","caption":"影像分析界面"}]'::jsonb,
'何清', 267, 145, 1980, false, 5);

-- Projects
INSERT INTO public.projects (title, title_en, summary, summary_en, cover_url, content, scene, scene_en, maturity, maturity_en, access_level, likes, views, is_hot, sort_order) VALUES
('NeuroCanvas · AI 绘画引擎', 'NeuroCanvas · AI Painting Engine', '支持多风格融合与高分辨率输出的生成式绘画引擎。', 'A generative painting engine supporting multi-style fusion and high-resolution output.', 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_b53af21d-a771-456a-bfa1-f2e5367c3832.jpg', '[{"type":"paragraph","text":"NeuroCanvas 聚焦于艺术创作场景，提供从草图到成品的完整生成链路。"}]'::jsonb, '视觉创意', 'Visual Creativity', '成熟产品', 'Mature Product', 'free', 520, 8600, true, 1),
('QuantEdge · 智能量化交易', 'QuantEdge · Smart Quantitative Trading', '基于强化学习的量化策略自动生成与回测平台。', 'A reinforcement-learning-based platform for automatic strategy generation and backtesting.', 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_fffdf41d-be62-417e-829d-3ab4dc60ae43.jpg', '[{"type":"paragraph","text":"面向金融场景，提供端到端的策略生成、回测与部署能力。"}]'::jsonb, '商业应用', 'Business Applications', '成熟产品', 'Mature Product', 'member', 388, 5400, true, 2),
('RoboMind · 自主机器人系统', 'RoboMind · Autonomous Robot System', '融合多模态感知的自主导航与操作机器人系统。', 'An autonomous navigation and manipulation robot system with multimodal perception.', 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_d935ffd1-48d4-4a2e-9c76-c46b3972ec3b.jpg', '[{"type":"paragraph","text":"面向智能制造场景，实现复杂环境下的自主决策。"}]'::jsonb, '效率工具', 'Productivity Tools', '研发中', 'In Development', 'pro', 297, 4200, false, 3),
('EduPilot · 个性化学习助手', 'EduPilot · Personalized Learning Assistant', '基于学情画像的自适应学习路径推荐系统。', 'An adaptive learning path recommendation system based on learner profiles.', 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_2db8d2a5-5eb0-4007-b832-8f6d2875d50a.jpg', '[{"type":"paragraph","text":"面向教育场景，为每位学习者定制专属学习路径。"}]'::jsonb, '教育科研', 'Education & Research', '成熟产品', 'Mature Product', 'free', 445, 6800, true, 4),
('DataLens · 智能数据洞察', 'DataLens · Intelligent Data Insights', '自然语言驱动的数据分析与可视化平台。', 'A natural-language-driven data analysis and visualization platform.', 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_3915e17e-ed5e-4502-b1d5-f668a7058c4e.jpg', '[{"type":"paragraph","text":"面向商业分析场景，用对话即可完成复杂的数据洞察。"}]'::jsonb, '商业应用', 'Business Applications', '概念验证', 'Proof of Concept', 'free', 312, 3900, false, 5);

-- Events
INSERT INTO public.events (title, title_en, summary, summary_en, cover_url, city, city_en, theme, theme_en, location, location_en, event_date, capacity, registered, sort_order) VALUES
('AI 创新者沙龙 · 上海', 'AI Innovators Salon · Shanghai', '与一线 AI 创业者面对面，探讨生成式 AI 的商业化路径。', 'Meet frontline AI founders and explore the commercialization of generative AI.', 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_34770390-7fc2-4a37-a309-3a77286728a0.jpg', '上海', 'Shanghai', '创业交流', 'Startup Exchange', '上海·西岸艺术中心', 'Shanghai · West Bund Art Center', now() + interval '7 days', 80, 42, 1),
('生成式艺术工作坊 · 北京', 'Generative Art Workshop · Beijing', '动手实践 AI 绘画与创意编码，从零打造你的第一件数字艺术作品。', 'Hands-on AI painting and creative coding — build your first digital artwork from scratch.', 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_d98b8650-b7b8-42c3-aeea-6acb2470cc8f.jpg', '北京', 'Beijing', '技术实践', 'Tech Practice', '北京·798艺术区', 'Beijing · 798 Art District', now() + interval '14 days', 50, 31, 2),
('城市 AI Meetup · 深圳', 'City AI Meetup · Shenzhen', '晚间技术分享与社交，连接本地的 AI 开发者与产品人。', 'Evening tech talks and networking connecting local AI developers and product builders.', 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_eb30aef6-9d02-4397-accf-46095a15cf7d.jpg', '深圳', 'Shenzhen', '社交聚会', 'Social Gathering', '深圳·南山科技园', 'Shenzhen · Nanshan Tech Park', now() + interval '21 days', 120, 67, 3),
('AI 黑客马拉松 · 杭州', 'AI Hackathon · Hangzhou', '48 小时极限挑战，用 AI 解决真实世界问题。', 'A 48-hour challenge to solve real-world problems with AI.', 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_b58d98fb-1b2e-40e3-8149-bcdf9a8ad59f.jpg', '杭州', 'Hangzhou', '创业交流', 'Startup Exchange', '杭州·梦想小镇', 'Hangzhou · Dream Town', now() + interval '30 days', 200, 98, 4);

-- Knowledge base
INSERT INTO public.knowledge_base (title, content, tags, sort_order) VALUES
('社区使用指南', '本社区包含案例展示、AI 项目库与城市组局三大板块。案例区支持按领域筛选、点赞与收藏；项目库支持按应用场景、成熟度筛选；城市组局可报名线下活动。', '指南,社区', 1),
('会员权益说明', '社区采用三层账号体系：用户等级（Lv.1-10，由 XP 决定）、会员等级（Guest/Explorer/Member/Pro）、社区身份。会员等级决定内容访问权限，与用户等级相互独立。', '会员,权益', 2),
('AI 项目提交规范', '项目需包含清晰的标题、简介、封面图与内容描述。可附加视频或外部链接。访问级别分为 free/member/pro/private。', '项目,规范', 3);
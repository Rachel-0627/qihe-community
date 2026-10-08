-- 工具栏目的「AI 工具推荐」
--
-- 这些是站外的第三方在线工具，社区只做收录与跳转，不托管也不代理。
-- 做成表而不是写死在代码里，是为了让运营方自己增删改，不必每次改代码发版。

CREATE TABLE IF NOT EXISTS public.ai_tools (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  summary     text NOT NULL DEFAULT '',
  url         text NOT NULL,
  cover_url   text NOT NULL DEFAULT '',
  provider    text NOT NULL DEFAULT '',
  category    text NOT NULL DEFAULT '其他'
              CHECK (category IN ('图像处理', '文档办公', '音视频', '创意生成', '其他')),
  sort_order  int  NOT NULL DEFAULT 0,
  is_visible  boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_tools_order_idx ON public.ai_tools (is_visible, sort_order, created_at);

ALTER TABLE public.ai_tools ENABLE ROW LEVEL SECURITY;

-- 已上架的人人可读；增删改仅管理员
DROP POLICY IF EXISTS ai_tools_read ON public.ai_tools;
CREATE POLICY ai_tools_read ON public.ai_tools
  FOR SELECT USING (is_visible);

DROP POLICY IF EXISTS ai_tools_admin_read ON public.ai_tools;
CREATE POLICY ai_tools_admin_read ON public.ai_tools
  FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

DROP POLICY IF EXISTS ai_tools_admin_write ON public.ai_tools;
CREATE POLICY ai_tools_admin_write ON public.ai_tools
  FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

GRANT SELECT ON public.ai_tools TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ai_tools TO authenticated;

-- 首批收录。封面图放在站点自己的 public/tools/ 下，不外链第三方图片，
-- 避免对方改版或防盗链导致社区页面出现破图。
INSERT INTO public.ai_tools (name, summary, url, cover_url, provider, category, sort_order) VALUES
  ('丹青 · 千变万换', '框选图片里的任意物体，换成你描述的东西。换衣服、换背景、换产品都行。',
   'https://modelscope.cn/studios/iic/ReplaceAnything', '/tools/danqing.jpg', '通义实验室', '图像处理', 1),
  ('一键人像抠图换背景', '上传人像自动抠出主体，换成纯色底或指定场景。',
   'https://modelscope.cn/studios/iic/Change_Image_Background', '/tools/cutout.jpg', '通义实验室', '图像处理', 2),
  ('AI 证件照', '普通照片转成各规格证件照，可换底色、调整尺寸。',
   'https://modelscope.cn/studios/ModelBulider/HivisionIDPhoto', '/tools/idphoto.jpg', 'HivisionIDPhoto', '图像处理', 3),
  ('人脸修复', '模糊、低清的人像照片修复成清晰可用的图。',
   'https://modelscope.cn/studios/Hardwell/hardwell_face_fusion_light_release', '/tools/facefusion.jpg', 'Hardwell', '图像处理', 4),
  ('RapidOCR 文字识别', '截图、照片里的文字直接提取出来，支持中英文混排。',
   'https://modelscope.cn/studios/RapidAI/RapidOCRDemo', '/tools/ocr.jpg', 'RapidAI', '文档办公', 5),
  ('文档解析', 'PDF、扫描件转成结构化文本，表格和版面都能还原。',
   'https://modelscope.cn/studios/PaddlePaddle/PP-StructureV3_Online_Demo', '/tools/docparse.jpg', '飞桨 PaddlePaddle', '文档办公', 6),
  ('Qwen3-MT 多语言翻译', '支持多语种互译，中文语境下的表达比通用翻译更自然。',
   'https://modelscope.cn/studios/Qwen/Qwen3-MT-demo', '/tools/translate.jpg', '阿里千问', '文档办公', 7),
  ('FunSound 视频字幕', '上传视频自动识别语音并生成字幕文件。',
   'https://modelscope.cn/studios/QuadraV/FunSound', '/tools/subtitle.jpg', 'QuadraV', '音视频', 8),
  ('IndexTTS 2.5', '文字转语音，中文发音自然，可用于口播和短视频配音。',
   'https://modelscope.cn/studios/IndexTeam/IndexTTS-2.5', '/tools/tts.jpg', 'B 站 Index Team', '音视频', 9),
  ('Wan2.2-Animate', '一张照片加一段动作视频，让照片里的人动起来。',
   'https://modelscope.cn/studios/Wan-AI/Wan2.2-Animate', '/tools/animate.jpg', '阿里万相', '创意生成', 10);

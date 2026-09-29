-- 活动结束时间
--
-- 允许为空：已有活动只录了开始时间，设成 NOT NULL 就得给它们编一个假的结束时间。
-- 「必填」在后台表单上强制——新建活动必须填，编辑旧活动时也会被要求补上，
-- 但数据库不会替任何人瞎猜。

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_end_date timestamp with time zone;

COMMENT ON COLUMN public.events.event_end_date IS '活动结束时间；为空表示旧数据尚未补录';

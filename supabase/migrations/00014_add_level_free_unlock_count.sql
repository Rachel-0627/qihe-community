BEGIN;

-- 等级配置增加「可免费解锁付费项目数量」
ALTER TABLE public.level_config
  ADD COLUMN free_unlock_count integer NOT NULL DEFAULT 0;

COMMIT;

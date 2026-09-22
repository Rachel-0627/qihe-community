ALTER TABLE public.prompt_cases
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description_en text NOT NULL DEFAULT '';
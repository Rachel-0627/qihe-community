ALTER TABLE public.cases    ADD COLUMN IF NOT EXISTS show_on_home boolean NOT NULL DEFAULT true;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS show_on_home boolean NOT NULL DEFAULT true;
ALTER TABLE public.events   ADD COLUMN IF NOT EXISTS show_on_home boolean NOT NULL DEFAULT true;

GRANT SELECT (show_on_home) ON public.projects TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_cases_home    ON public.cases    (show_on_home, sort_order);
CREATE INDEX IF NOT EXISTS idx_projects_home ON public.projects (show_on_home, sort_order);
CREATE INDEX IF NOT EXISTS idx_events_home   ON public.events   (show_on_home, sort_order);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS video_url text NOT NULL DEFAULT '';
GRANT SELECT (video_url) ON public.events TO anon, authenticated;
GRANT UPDATE (video_url) ON public.events TO authenticated;
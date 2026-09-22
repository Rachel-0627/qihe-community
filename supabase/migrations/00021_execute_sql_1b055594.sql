ALTER TABLE public.cases 
  ADD COLUMN IF NOT EXISTS video_url text
    NOT NULL
    DEFAULT ''; GRANT SELECT ( video_url ) ON public.cases TO anon, authenticated; GRANT UPDATE ( video_url ) ON public.cases TO authenticated;
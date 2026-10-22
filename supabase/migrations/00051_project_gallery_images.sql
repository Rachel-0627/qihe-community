-- Multiple project card images for product-style galleries.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS gallery_urls text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.projects.gallery_urls IS
  'Ordered image URLs for the project card carousel; cover_url remains the legacy fallback.';

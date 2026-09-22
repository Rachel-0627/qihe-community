ALTER TABLE public.user_image_providers 
ADD COLUMN IF NOT EXISTS request_body_template text;

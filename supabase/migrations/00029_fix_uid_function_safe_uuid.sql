CREATE OR REPLACE FUNCTION public.uid()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  sub_text text;
BEGIN
  sub_text := coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  );
  -- 如果 sub_text 为空、等于 'anon' 或者不符合 UUID 格式，安全返回 NULL
  IF sub_text IS NULL OR sub_text = 'anon' OR sub_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  RETURN sub_text::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;
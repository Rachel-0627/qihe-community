CREATE OR REPLACE FUNCTION auth.uid()
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
  IF sub_text IS NULL OR sub_text = 'anon' OR sub_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  RETURN sub_text::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;
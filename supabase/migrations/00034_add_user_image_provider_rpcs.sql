-- 读取当前登录用户生图配置的统一 RPC 函数
CREATE OR REPLACE FUNCTION public.get_my_image_provider_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_rec record;
  v_has_key boolean := false;
  v_vault_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_rec
  FROM public.user_image_providers
  WHERE user_id = v_user_id
  LIMIT 1;

  v_vault_name := 'IMAGE_GEN_API_KEY_' || v_user_id::text;
  
  SELECT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = v_vault_name
  ) INTO v_has_key;

  IF v_rec IS NULL AND NOT v_has_key THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'provider', coalesce(v_rec.provider, ''),
    'base_url', coalesce(v_rec.base_url, ''),
    'model', coalesce(v_rec.model, ''),
    'protocol', coalesce(v_rec.protocol, 'openai'),
    'default_size', coalesce(v_rec.default_size, '1024x1024'),
    'request_body_template', v_rec.request_body_template,
    'protocol_settings', v_rec.protocol_settings,
    'apiKeyConfigured', v_has_key,
    'has_api_key', v_has_key,
    'updated_at', v_rec.updated_at
  );
END;
$$;
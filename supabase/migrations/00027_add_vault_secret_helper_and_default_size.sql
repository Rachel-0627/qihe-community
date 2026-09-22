-- 1. 为 user_image_providers 添加 default_size 列
ALTER TABLE public.user_image_providers 
ADD COLUMN IF NOT EXISTS default_size text DEFAULT '1024x1024';

-- 2. 创建用于安全写入 Vault 密钥的 helper 函数
CREATE OR REPLACE FUNCTION public.set_vault_secret(
  p_name text,
  p_secret text,
  p_description text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = p_name LIMIT 1;
  IF v_id IS NOT NULL THEN
    PERFORM vault.update_secret(v_id, p_secret, p_name, p_description);
    RETURN v_id;
  ELSE
    RETURN vault.create_secret(p_secret, p_name, p_description);
  END IF;
END;
$$;

-- 授予 authenticated 和 service_role 调用权限
GRANT EXECUTE ON FUNCTION public.set_vault_secret(text, text, text) TO authenticated, service_role;

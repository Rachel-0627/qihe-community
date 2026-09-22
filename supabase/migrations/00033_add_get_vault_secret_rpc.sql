-- 创建安全读取 Vault Secret 的 SECURITY DEFINER 函数
CREATE OR REPLACE FUNCTION public.get_vault_secret(p_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = p_name
  LIMIT 1;

  RETURN v_secret;
END;
$$;

-- 创建检查 Vault Secret 是否存在的 SECURITY DEFINER 函数
CREATE OR REPLACE FUNCTION public.has_vault_secret(p_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = p_name
  ) INTO v_exists;

  RETURN coalesce(v_exists, false);
END;
$$;
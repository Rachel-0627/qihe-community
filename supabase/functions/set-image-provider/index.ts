// 保存与读取生图模型配置（每个用户独立配置）
// - 敏感字段 api_key 写入 Supabase Vault（按 user_id 命名隔离）
// - 非敏感字段写入 user_image_providers

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function vaultName(userId: string) {
  return `IMAGE_GEN_API_KEY_${userId}`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 身份校验
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();
  if (!token) {
    return json({ error: "请先登录" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !user) {
    return json({ error: "登录状态已失效" }, 401);
  }

  // 统一读取配置逻辑
  const handleGetConfig = async () => {
    try {
      const { data: config, error: configError } = await adminClient
        .from("user_image_providers")
        .select("provider, base_url, model, default_size, request_body_template, protocol_settings, protocol")
        .eq("user_id", user.id)
        .maybeSingle();

      if (configError) throw configError;

      const { data: hasKey, error: vaultCheckError } = await adminClient.rpc("has_vault_secret", {
        p_name: vaultName(user.id),
      });

      const apiKeyConfigured = Boolean(!vaultCheckError && hasKey);
      console.log(
        `[API_CONFIG_LOAD] userId=${user.id} apiKeyConfigured=${apiKeyConfigured} protocol=${config?.protocol || "openai"} baseUrl=${config?.base_url || ""}`
      );

      return json({
        config: config || null,
        has_api_key: apiKeyConfigured,
        apiKeyConfigured,
      });
    } catch (err) {
      console.error("fetch provider error:", (err as Error).message);
      return json({ error: `读取配置失败: ${(err as Error).message}` }, 500);
    }
  };

  // GET 请求：读取当前用户的生图配置
  if (req.method === "GET") {
    return await handleGetConfig();
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  // 校验输入
  let body: {
    action?: string;
    provider?: string;
    base_url?: string;
    model?: string;
    api_key?: string;
    protocol?: string;
    default_size?: string;
    request_body_template?: string;
    protocol_settings?: Record<string, string>;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "请求内容不合法" }, 400);
  }

  if (body.action === "get") {
    return await handleGetConfig();
  }

  const {
    provider,
    base_url,
    model,
    api_key,
    protocol = "openai",
    default_size = "1024x1024",
    request_body_template,
    protocol_settings,
  } = body;
  if (!provider?.trim() || !base_url?.trim() || !model?.trim()) {
    return json({ error: "provider / base_url / model 不能为空" }, 400);
  }

  const secretName = vaultName(user.id);
  const apiKeyProvided = Boolean(api_key && api_key.trim().length > 0);

  console.log(
    `[API_CONFIG_SAVE] userId=${user.id} apiKeyProvided=${apiKeyProvided} protocol=${protocol} baseUrl=${base_url} saveSuccess=pending`
  );

  // 写入/更新 Vault 中的 API key
  if (api_key !== undefined && api_key.trim().length > 0) {
    try {
      const { error: vaultError } = await adminClient.rpc("set_vault_secret", {
        p_name: secretName,
        p_secret: api_key.trim(),
        p_description: `Image generation provider API key for user ${user.id}`,
      });
      if (vaultError) throw vaultError;
    } catch (err) {
      console.error("vault error:", (err as Error).message);
      return json({ error: `API key 保存失败: ${(err as Error).message}` }, 500);
    }
  }

  // 写入 user_image_providers
  try {
    const now = new Date().toISOString();
    let protocolSettingsValue: unknown = null;
    if (protocol_settings) {
      protocolSettingsValue = typeof protocol_settings === "string" ? protocol_settings : JSON.stringify(protocol_settings);
    }

    const { error: upsertError } = await adminClient.from("user_image_providers").upsert(
      {
        user_id: user.id,
        provider: provider.trim(),
        base_url: base_url.trim().replace(/\/$/, ""),
        model: model.trim(),
        protocol: protocol || "openai",
        default_size: default_size.trim() || "1024x1024",
        request_body_template: request_body_template?.trim() || null,
        protocol_settings: protocolSettingsValue,
        updated_at: now,
      },
      { onConflict: "user_id" }
    );
    if (upsertError) throw upsertError;

    console.log(
      `[API_CONFIG_SAVE] userId=${user.id} apiKeyProvided=${apiKeyProvided} protocol=${protocol} baseUrl=${base_url} saveSuccess=true`
    );
  } catch (err) {
    console.error("user_image_providers error:", (err as Error).message);
    console.log(
      `[API_CONFIG_SAVE] userId=${user.id} apiKeyProvided=${apiKeyProvided} protocol=${protocol} baseUrl=${base_url} saveSuccess=false`
    );
    return json({ error: `配置保存失败: ${(err as Error).message}` }, 500);
  }

  return json({ success: true });
});

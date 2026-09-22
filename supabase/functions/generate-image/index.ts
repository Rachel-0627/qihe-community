// AI 生图 Edge Function
// - 从 Vault 读取当前用户的 API key
// - 从 user_image_providers 读取模型与 base_url
// - 规范化 endpoint 地址（避免 /v1/v1 重复拼接）
// - 兼容从 cURL / JSON 模板中提取自定义请求体
// - 调用上游服务商生成图片并返回完整地址

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UPSTREAM_TIMEOUT_MS = 60_000;

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
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  // 身份校验：必须登录
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

  // 校验输入
  let body: { prompt?: string; size?: string; prompt_case_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "请求内容不合法" }, 400);
  }

  const { prompt, size: requestedSize, prompt_case_id } = body;
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return json({ error: "prompt 不能为空" }, 400);
  }
  if (prompt.length > 4000) {
    return json({ error: "prompt 超过 4000 字符" }, 400);
  }

  // 读取当前用户配置
  const { data: userConfig, error: configError } = await adminClient
    .from("user_image_providers")
    .select("provider, base_url, model, default_size, request_body_template, protocol")
    .eq("user_id", user.id)
    .maybeSingle();

  if (configError || !userConfig) {
    return json({ error: "您尚未配置生图模型，请前往个人中心配置" }, 503);
  }

  const effectiveSize = requestedSize?.trim() || userConfig.default_size || "1024x1024";

  // 使用 SECURITY DEFINER 函数读取当前用户的密钥
  const { data: apiKey, error: secretError } = await adminClient.rpc("get_vault_secret", {
    p_name: vaultName(user.id),
  });

  const apiKeyFound = Boolean(!secretError && apiKey);
  const protocol = userConfig.protocol || "openai";
  const userBaseUrl = (userConfig.base_url || "").trim().replace(/\/+$/, "");

  console.log(
    `[IMAGE_API_CONFIG] userId=${user.id} apiKeyFound=${apiKeyFound} protocol=${protocol} baseUrl=${userBaseUrl}`
  );

  if (!apiKey) {
    return json({ error: "生图 API key 未配置或已失效，请在个人中心重新填写保存" }, 503);
  }

  const config = {
    provider: userConfig.provider || "",
    base_url: userBaseUrl,
    model: (userConfig.model || "").trim(),
  };

  // 规范化 Base URL 与 Endpoint 地址
  let endpoint = "";
  if (config.base_url.endsWith("/images/generations")) {
    endpoint = config.base_url;
  } else if (config.base_url.endsWith("/v1")) {
    endpoint = `${config.base_url}/images/generations`;
  } else {
    endpoint = `${config.base_url}/v1/images/generations`;
  }

  // 构造标准请求体
  let reqBody: Record<string, unknown> = {
    model: config.model,
    prompt: prompt.trim(),
    n: 1,
    size: effectiveSize,
  };

  // 若用户设置了自定义请求体模板，支持直接解析或从 cURL 中智能提取
  if (userConfig.request_body_template) {
    try {
      let rawTpl = userConfig.request_body_template.trim();
      const dMatch = rawTpl.match(/-d\s+['"](\{[\s\S]*?\})['"]/);
      if (dMatch && dMatch[1]) {
        rawTpl = dMatch[1];
      } else {
        const braceMatch = rawTpl.match(/(\{[\s\S]*\})/);
        if (braceMatch && braceMatch[1]) {
          rawTpl = braceMatch[1];
        }
      }
      const template = JSON.parse(rawTpl);
      if (typeof template === "object" && template !== null) {
        reqBody = {
          ...template,
          prompt: prompt.trim(), // 确保提示词使用实际值
        };
        if (!reqBody.model) reqBody.model = config.model;
        if (!reqBody.size) reqBody.size = effectiveSize;
      }
    } catch {
      // 模板解析失败时降级使用标准结构
    }
  }

  console.log(`[generate-image] Invoking endpoint: ${endpoint}, model: ${reqBody.model}, size: ${reqBody.size}`);

  // 调用上游
  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(reqBody),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("image generation upstream network failed:", (err as Error).message);
    return json({ error: `无法连接到生图服务商 (${endpoint}): ${(err as Error).message}` }, 502);
  }

  if (!upstream.ok) {
    let errText = await upstream.text();
    try {
      const errJson = JSON.parse(errText);
      errText = errJson.error?.message || errJson.error || errJson.message || errText;
    } catch {
      // keep raw text
    }
    console.error("image generation upstream error:", upstream.status, errText);
    return json(
      { error: `生图服务商返回错误 (${upstream.status}): ${errText || "未知错误"}` },
      upstream.status === 429 ? 429 : 502
    );
  }

  const data = await upstream.json();
  let imageUrl = data.data?.[0]?.url || data.images?.[0] || data.url;
  if (!imageUrl && data.data?.[0]?.b64_json) {
    imageUrl = `data:image/png;base64,${data.data[0].b64_json}`;
  }

  if (!imageUrl) {
    console.error("No image url found in response:", JSON.stringify(data));
    return json({ error: "生图服务商未返回有效的图片地址" }, 502);
  }

  // 保存生成历史
  if (prompt_case_id) {
    try {
      await adminClient.from("prompt_case_generations").insert({
        prompt_case_id,
        image_url: imageUrl,
        prompt_text: prompt.trim(),
      });
    } catch (err) {
      console.error("save generation history failed:", (err as Error).message);
    }
  }

  return json({ url: imageUrl });
});

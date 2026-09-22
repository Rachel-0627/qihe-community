// AI Assistant Edge Function — SSE proxy for Wenxin (ERNIE 4.5 Turbo)
// Injects persona system prompt + knowledge base context, then streams upstream SSE.
//
// 安全约束（P0-1）：此接口按量计费，anon key 明文写在前端打包产物里，
// 任何人都能扒出来无限调用。因此：
//   ① 强制登录校验（未登录直接 401）
//   ② 调用 consume_ai_quota 做按用户按天限流（超限返回 429）

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UPSTREAM = "https://app-ela0iwd2axvl-api-zYkZz8qovQ1L-gateway.appmiaoda.com/v2/chat/completions";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  // ===== 1. 身份校验：必须已登录 =====
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
    return json({ error: "登录状态已失效，请重新登录" }, 401);
  }

  // ===== 2. 用量限流：按用户按天计数 =====
  const { data: quota, error: quotaError } = await adminClient.rpc("consume_ai_quota", {
    p_user_id: user.id,
  });
  if (quotaError) {
    console.error("consume_ai_quota error:", quotaError.message);
    return json({ error: "服务异常，请稍后再试" }, 500);
  }
  if (quota && quota.allowed === false) {
    return json({
      error: `今日 AI 助手调用次数已达上限（${quota.limit} 次/天），请明天再试`,
      used: quota.used,
      limit: quota.limit,
    }, 429);
  }

  // ===== 3. 校验输入 =====
  let messages: Array<{ role: string; content: string }>;
  let lang = "zh";
  try {
    const body = await req.json();
    messages = body.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error("Missing or invalid messages");
    }
    if (body.lang) lang = body.lang;
  } catch (err) {
    return json({ error: `Invalid request body: ${(err as Error).message}` }, 400);
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return json({ error: "Server configuration error: missing API key" }, 500);
  }

  // ===== 4. 读取 persona + 知识库 =====
  let systemPrompt = "";
  try {
    const [configRes, kbRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/assistant_config?select=system_prompt,system_prompt_en,greeting,greeting_en&limit=1`, {
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      }),
      fetch(`${supabaseUrl}/rest/v1/knowledge_base?select=title,content&order=sort_order.asc`, {
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      }),
    ]);
    const configData = (await configRes.json()) as Array<Record<string, string>>;
    const kbData = (await kbRes.json()) as Array<{ title: string; content: string }>;
    if (configData && configData.length > 0) {
      const c = configData[0];
      systemPrompt = lang === "en" ? (c.system_prompt_en || c.system_prompt) : c.system_prompt;
    }
    if (kbData && kbData.length > 0) {
      const kbText = kbData.map((k) => `【${k.title}】${k.content}`).join("\n");
      systemPrompt += `\n\n以下是社区知识库，回答时可参考：\n${kbText}`;
    }
  } catch (_e) {
    // ignore DB read failure, fall back to no system prompt
  }

  const finalMessages = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  // ===== 5. 转发上游 SSE =====
  const upstream = await fetch(UPSTREAM, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ messages: finalMessages, enable_thinking: false }),
  });

  if (upstream.status === 429 || upstream.status === 402) {
    const errText = await upstream.text();
    return new Response(errText, {
      status: upstream.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!upstream.ok || !upstream.body) {
    return json({ error: `Upstream error: ${upstream.status}` }, 502);
  }

  return new Response(upstream.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

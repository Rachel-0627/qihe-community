// 百度翻译通用版 Edge Function 代理
// 仅允许从中文自动翻译为英文
//
// 安全约束（P0-1）：此接口按量计费，且前端只有后台管理页在用
// （AdminCases / AdminProjects 的「自动翻译」按钮），
// 因此直接收紧为「仅管理员可调用」—— 比限流更简单也更严。

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UPSTREAM = "https://app-ela0iwd2axvl-api-e94GZ5j0PWpa-gateway.appmiaoda.com/rpc/2.0/mt/texttrans/v1";

const MAX_CHARS = 2000;            // 百度通用翻译单次长度限制，超了上游也会拒
const UPSTREAM_TIMEOUT_MS = 20000;

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

  // ===== 1. 身份校验：必须是管理员 =====
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

  const { data: caller, error: callerError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (callerError || caller?.role !== "admin") {
    return json({ error: "仅管理员可使用翻译功能" }, 403);
  }

  // ===== 2. 校验输入 =====
  let q: string;
  try {
    const body = await req.json();
    q = body.q;
    if (!q || typeof q !== "string") throw new Error("翻译内容不能为空");
    if (q.length > MAX_CHARS) throw new Error(`翻译内容超过 ${MAX_CHARS} 字，请分段翻译`);
  } catch (err) {
    return json({ error: (err as Error).message || "请求内容不合法" }, 400);
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return json({ error: "服务配置异常，请联系管理员" }, 500);
  }

  // ===== 3. 转发到上游（带超时）=====
  let upstream: Response;
  try {
    upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ q, from: "zh", to: "en" }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("translation upstream failed:", (err as Error).message);
    return json({ error: "翻译服务响应超时，请稍后再试" }, 504);
  }

  if (upstream.status === 429 || upstream.status === 402) {
    const errText = await upstream.text();
    return new Response(errText, {
      status: upstream.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!upstream.ok) {
    console.error("translation upstream error status:", upstream.status);
    return json({ error: "翻译失败，请稍后再试" }, 502);
  }

  const data = await upstream.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

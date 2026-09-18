// Admin user management Edge Function
// Allows admins to list, create, update, and reset passwords for admin accounts.
// Uses the service role key, so the caller must be authenticated as an admin.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    return json({ error: "Method Not Allowed" }, 405);
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();
  if (!token) {
    return json({ error: "Missing authorization header" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify caller
  const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !user) {
    return json({ error: "Invalid or expired token" }, 401);
  }

  const { data: caller, error: callerError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (callerError || caller?.role !== "admin") {
    return json({ error: "Admin access required" }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = body.action as string;

  try {
    switch (action) {
      case "list": {
        const { data: profiles, error } = await adminClient
          .from("profiles")
          .select("id, username, email, role, member_tier, community_identity, level, xp")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json({ users: profiles || [] });
      }

      case "create": {
        const username = String(body.username || "").trim();
        const password = String(body.password || "").trim();
        if (!username || !password) {
          return json({ error: "username and password are required" }, 400);
        }
        if (password.length < 6) {
          return json({ error: "Password must be at least 6 characters" }, 400);
        }
        const email = `${username}@miaoda.com`;

        const { data: existing } = await adminClient
          .from("profiles")
          .select("id")
          .eq("username", username)
          .maybeSingle();
        if (existing) {
          return json({ error: "Username already exists" }, 409);
        }

        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (createError || !newUser.user) {
          throw createError || new Error("Failed to create user");
        }

        const { error: updateError } = await adminClient
          .from("profiles")
          .update({
            username,
            role: (body.role as string) || "admin",
            member_tier: (body.member_tier as string) || "pro",
            community_identity: (body.community_identity as string) || "contributor",
            level: Number(body.level) || 10,
            xp: Number(body.xp) || 10000,
          })
          .eq("id", newUser.user.id);
        if (updateError) throw updateError;

        return json({ id: newUser.user.id, email, username });
      }

      case "update": {
        const targetId = String(body.userId || "").trim();
        const newUsername = String(body.username || "").trim();
        if (!targetId || !newUsername) {
          return json({ error: "userId and username are required" }, 400);
        }
        const newEmail = `${newUsername}@miaoda.com`;

        const { error: authError } = await adminClient.auth.admin.updateUserById(targetId, {
          email: newEmail,
        });
        if (authError) throw authError;

        const { error: profileError } = await adminClient
          .from("profiles")
          .update({ username: newUsername })
          .eq("id", targetId);
        if (profileError) throw profileError;

        return json({ id: targetId, email: newEmail, username: newUsername });
      }

      case "updatePassword": {
        const targetId = String(body.userId || "").trim();
        const newPassword = String(body.password || "").trim();
        if (!targetId || !newPassword) {
          return json({ error: "userId and password are required" }, 400);
        }
        if (newPassword.length < 6) {
          return json({ error: "Password must be at least 6 characters" }, 400);
        }
        const { error } = await adminClient.auth.admin.updateUserById(targetId, {
          password: newPassword,
        });
        if (error) throw error;
        return json({ success: true });
      }

      case "delete": {
        const targetId = String(body.userId || "").trim();
        if (!targetId) {
          return json({ error: "userId is required" }, 400);
        }
        const { error } = await adminClient.auth.admin.deleteUser(targetId);
        if (error) throw error;
        return json({ success: true });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("admin-users error:", err);
    return json({ error: (err as Error).message || "Internal server error" }, 500);
  }
});
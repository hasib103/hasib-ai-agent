import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://hasib-ai-agent.onrender.com",
  "https://hasib-ai-agent-test.onrender.com",
]);

function corsHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
  const origin = req.headers.get("Origin");
  if (origin && allowedOrigins.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(req, { error: "Sign in required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Token settlement Edge Function server configuration is incomplete");
    return json(req, { error: "Token settlement is temporarily unavailable" }, 503);
  }

  const accessToken = authHeader.slice("Bearer ".length);
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(accessToken);
  if (authError || !authData.user) return json(req, { error: "Invalid or expired session" }, 401);

  let body: { reservation_id?: unknown; actual_tokens?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Expected JSON request body" }, 400);
  }
  if (typeof body.reservation_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.reservation_id) ||
      typeof body.actual_tokens !== "number" ||
      !Number.isSafeInteger(body.actual_tokens) ||
      body.actual_tokens < 0 ||
      body.actual_tokens > 300_000) {
    return json(req, { error: "Invalid AI token settlement request" }, 400);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await serviceClient.rpc("settle_ai_token_budget_server", {
    p_user_id: authData.user.id,
    p_reservation_id: body.reservation_id,
    p_actual_tokens: body.actual_tokens,
  });
  if (error) {
    console.error("AI token settlement RPC failed", error.message);
    return json(req, { error: "AI token usage could not be settled" }, 503);
  }
  if (data !== true) return json(req, { error: "Reservation was not found or was already settled" }, 409);
  return json(req, { settled: true });
});

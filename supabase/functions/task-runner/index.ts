import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

const planSchema = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    steps: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          priority: { type: "STRING", enum: ["high", "medium", "low"] },
          risk: { type: "STRING", enum: ["low", "medium", "high"] },
          rationale: { type: "STRING" },
        },
        required: ["title", "priority", "risk", "rationale"],
      },
    },
  },
  required: ["summary", "steps"],
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Sign in required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return json({ error: "Server auth is not configured" }, 500);

  const token = authHeader.slice("Bearer ".length);
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Invalid or expired session" }, 401);

  let body: { task_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Expected JSON request body" }, 400);
  }
  if (typeof body.task_id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.task_id)) {
    return json({ error: "A valid task_id is required" }, 400);
  }

  const { data: queuedTask, error: readError } = await supabase
    .from("tasks")
    .select("id,user_id,title,status,task_type,payload,attempt_count,max_attempts")
    .eq("id", body.task_id)
    .eq("user_id", auth.user.id)
    .eq("status", "queued")
    .lte("run_after", new Date().toISOString())
    .maybeSingle();

  if (readError) return json({ error: "Unable to read task" }, 500);
  if (!queuedTask) return json({ error: "Task not found, not owned by you, not queued, or not ready" }, 409);

  // The conditional update is the atomic claim; concurrent requests cannot both win.
  const { data: task, error: claimError } = await supabase
    .from("tasks")
    .update({
      status: "running",
      attempt_count: queuedTask.attempt_count + 1,
      started_at: new Date().toISOString(),
      locked_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", body.task_id)
    .eq("user_id", auth.user.id)
    .eq("status", "queued")
    .lte("run_after", new Date().toISOString())
    .select("id,user_id,title,status,task_type,payload,attempt_count,max_attempts")
    .maybeSingle();

  if (claimError) return json({ error: "Unable to claim task" }, 500);
  if (!task) return json({ error: "Task was already claimed or is not ready" }, 409);

  const timeoutMs = Math.min(120_000, Math.max(10_000, Number(Deno.env.get("TASK_RUNNER_TIMEOUT_MS")) || 100_000));
  try {
    let result: unknown;
    if (task.task_type === "generate_plan") {
      const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
      if (!apiKey) throw new Error("AI planner is not configured on the server");
      const request = typeof task.payload?.request === "string" ? task.payload.request.trim() : task.title.trim();
      if (!request || request.length > 2000) throw new Error("Task request must be 1-2000 characters");
      const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash";
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: "Create a safe, ordered plan. Do not claim to have executed actions. Flag destructive, external, financial, and security-sensitive steps as high risk. Return JSON matching the schema." }] },
            contents: [{ role: "user", parts: [{ text: request }] }],
            generationConfig: { responseMimeType: "application/json", responseSchema: planSchema, temperature: 0.2, maxOutputTokens: 1800 },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        },
      );
      if (!response.ok) throw new Error(`Planner API failed (HTTP ${response.status})`);
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("").trim();
      if (!text) throw new Error("Planner returned an empty response");
      result = JSON.parse(text);
    } else if (task.task_type === "create_memory_note") {
      const payload = task.payload ?? {};
      const title = typeof payload.title === "string" ? payload.title.trim() : "";
      const noteBody = typeof payload.body === "string" ? payload.body.trim() : "";
      const tags = Array.isArray(payload.tags) && payload.tags.every((tag: unknown) => typeof tag === "string")
        ? payload.tags.slice(0, 20).map((tag: string) => tag.slice(0, 40))
        : [];
      if (!title || title.length > 160 || !noteBody || noteBody.length > 10_000) {
        throw new Error("Memory note requires a title (max 160 chars) and body (max 10000 chars)");
      }
      const { error } = await supabase.from("memory_notes").upsert({
        id: task.id,
        user_id: auth.user.id,
        title,
        body: noteBody,
        tags,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
      if (error) throw new Error("Unable to save memory note");
      result = { note_id: task.id, title };
    } else {
      throw new Error("Task type is not allowlisted");
    }

    const finishedAt = new Date().toISOString();
    const { error: historyError } = await supabase.from("task_history").insert({
      task_id: task.id,
      user_id: auth.user.id,
      at: finishedAt,
      note: `Task completed: ${task.task_type}`,
    });
    if (historyError) throw new Error("Task result was created but history could not be saved");

    const { error: finishError } = await supabase.from("tasks").update({
      status: "done",
      result,
      completed_at: finishedAt,
      locked_at: null,
      last_error: null,
      updated_at: finishedAt,
    }).eq("id", task.id).eq("user_id", auth.user.id).eq("status", "running");
    if (finishError) throw new Error("Unable to persist task completion");
    return json({ task_id: task.id, status: "done", result });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Task execution failed";
    const nextStatus = task.attempt_count < task.max_attempts ? "queued" : "failed";
    await supabase.from("tasks").update({
      status: nextStatus,
      last_error: message,
      locked_at: null,
      updated_at: new Date().toISOString(),
    }).eq("id", task.id).eq("user_id", auth.user.id).eq("status", "running");
    return json({ task_id: task.id, status: nextStatus, error: message }, 500);
  }
});
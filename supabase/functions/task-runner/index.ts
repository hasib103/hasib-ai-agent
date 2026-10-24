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
  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
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

const retryableProviderStatuses = new Set([408, 429, 500, 502, 503, 504]);

async function fetchGeminiWithFallback(
  apiKey: string,
  configuredModel: string,
  requestBody: string,
  timeoutMs: number,
): Promise<Response> {
  const models = configuredModel === "gemini-3.6-flash"
    ? [configuredModel]
    : [configuredModel, "gemini-3.6-flash"];
  let lastResponse: Response | undefined;
  let lastError: unknown;

  for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
    const model = models[modelIndex];
    if (!model) continue;
    const attempts = modelIndex === 0 ? 3 : 1;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: requestBody,
            signal: AbortSignal.timeout(Math.min(timeoutMs, 20_000)),
          },
        );
        lastResponse = response;
        if (response.ok || !retryableProviderStatuses.has(response.status)) return response;

        const retryAfter = Number(response.headers.get("retry-after"));
        await response.body?.cancel().catch(() => undefined);
        if (attempt < attempts - 1) {
          const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 3_000)
            : 500 * (2 ** attempt);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        if (modelIndex === models.length - 1) return response;
      } catch (error) {
        lastError = error;
        if (attempt < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)));
          continue;
        }
        if (modelIndex === models.length - 1) break;
      }
    }
  }

  if (lastResponse) return lastResponse;
  throw new Error(lastError instanceof Error
    ? "Gemini provider request failed after retries: " + lastError.message
    : "Gemini provider request failed after retries");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(req, { error: "Sign in required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return json(req, { error: "Server auth is not configured" }, 500);

  const token = authHeader.slice("Bearer ".length);
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return json(req, { error: "Invalid or expired session" }, 401);

  let body: { task_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Expected JSON request body" }, 400);
  }
  if (typeof body.task_id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.task_id)) {
    return json(req, { error: "A valid task_id is required" }, 400);
  }

  const { data: queuedTask, error: readError } = await supabase
    .from("tasks")
    .select("id,user_id,title,status,task_type,payload,attempt_count,max_attempts")
    .eq("id", body.task_id)
    .eq("user_id", auth.user.id)
    .eq("status", "queued")
    .lte("run_after", new Date().toISOString())
    .maybeSingle();

  if (readError) return json(req, { error: "Unable to read task" }, 500);
  if (!queuedTask) return json(req, { error: "Task not found, not owned by you, not queued, or not ready" }, 409);

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

  if (claimError) return json(req, { error: "Unable to claim task" }, 500);
  if (!task) return json(req, { error: "Task was already claimed or is not ready" }, 409);

  const timeoutMs = Math.min(120_000, Math.max(10_000, Number(Deno.env.get("TASK_RUNNER_TIMEOUT_MS")) || 100_000));
  try {
    let result: unknown;
    if (task.task_type === "generate_plan") {
      const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
      if (!apiKey) throw new Error("AI planner is not configured on the server");
      const request = typeof task.payload?.request === "string" ? task.payload.request.trim() : task.title.trim();
      if (!request || request.length > 2000) throw new Error("Task request must be 1-2000 characters");
      const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash";
      const requestBody = JSON.stringify({
        systemInstruction: { parts: [{ text: "Create a safe, ordered plan. Do not claim to have executed actions. Flag destructive, external, financial, and security-sensitive steps as high risk. Return JSON matching the schema." }] },
        contents: [{ role: "user", parts: [{ text: request }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: planSchema, temperature: 0.2, maxOutputTokens: 1500, thinkingConfig: { thinkingLevel: "low" } },
      });
      const response = await fetchGeminiWithFallback(apiKey, model, requestBody, timeoutMs);
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
    const { error: finishError } = await supabase.from("tasks").update({
      status: "done",
      result,
      completed_at: finishedAt,
      locked_at: null,
      last_error: null,
      updated_at: finishedAt,
    }).eq("id", task.id).eq("user_id", auth.user.id).eq("status", "running");
    if (finishError) throw new Error("Unable to persist task completion");

    // Terminal state is saved first; audit-write failure must not falsely retry a completed task.
    const [historyWrite, activityWrite] = await Promise.all([
      supabase.from("task_history").insert({
        task_id: task.id,
        user_id: auth.user.id,
        at: finishedAt,
        note: `Task completed: ${task.task_type}`,
      }),
      supabase.from("activity_log").insert({
        user_id: auth.user.id,
        at: finishedAt,
        actor: "Hasib AI Agent",
        event: `Completed supported task: ${task.task_type}`,
      }),
    ]);
    if (historyWrite.error) console.error("Task completion history write failed", historyWrite.error.message);
    if (activityWrite.error) console.error("Task completion activity log write failed", activityWrite.error.message);
    return json(req, {
      task_id: task.id,
      status: "done",
      result,
      history_saved: !historyWrite.error,
      activity_logged: !activityWrite.error,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Task execution failed";
    const failedAt = new Date().toISOString();
    const nextStatus = task.attempt_count < task.max_attempts ? "queued" : "failed";
    const { error: stateError } = await supabase.from("tasks").update({
      status: nextStatus,
      last_error: message,
      locked_at: null,
      updated_at: failedAt,
    }).eq("id", task.id).eq("user_id", auth.user.id).eq("status", "running");
    if (stateError) console.error("Failed to persist task failure state", stateError.message);

    const historyNote = `Attempt ${task.attempt_count}/${task.max_attempts} failed; ${nextStatus === "queued" ? "task queued for retry" : "maximum attempts reached"}: ${message}`;
    const [historyWrite, activityWrite] = await Promise.all([
      supabase.from("task_history").insert({
        task_id: task.id,
        user_id: auth.user.id,
        at: failedAt,
        note: historyNote,
      }),
      supabase.from("activity_log").insert({
        user_id: auth.user.id,
        at: failedAt,
        actor: "Hasib AI Agent",
        event: `Task attempt ${task.attempt_count}/${task.max_attempts} failed; status: ${nextStatus}`,
      }),
    ]);
    if (historyWrite.error) console.error("Task failure history write failed", historyWrite.error.message);
    if (activityWrite.error) console.error("Task failure activity log write failed", activityWrite.error.message);
    return json(req, {
      task_id: task.id,
      status: nextStatus,
      error: message,
      history_saved: !historyWrite.error,
      activity_logged: !activityWrite.error,
    }, 500);
  }
});
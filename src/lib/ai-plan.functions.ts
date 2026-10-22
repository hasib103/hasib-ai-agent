import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

const planSchema = z.object({
  summary: z.string().describe("One-sentence summary of the plan"),
  steps: z
    .array(
      z.object({
        title: z.string().describe("Short actionable step title"),
        priority: z.enum(["high", "medium", "low"]),
        risk: z.enum(["low", "medium", "high"]),
        rationale: z.string().describe("Why this step, its priority and risk label"),
      }),
    )
    .min(1)
    .max(8),
});

export type AiPlan = z.infer<typeof planSchema>;

const responseSchema = {
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

export const generateTaskPlan = createServerFn({ method: "POST" })
  .inputValidator((input: { request: string; accessToken: string }) => {
    const request = (input?.request ?? "").trim();
    const accessToken = (input?.accessToken ?? "").trim();
    if (!request) throw new Error("Describe the task first.");
    if (request.length > 2000) throw new Error("Keep the request under 2000 characters.");
    if (!accessToken || accessToken.length > 8192) throw new Error("Sign in to use the AI planner.");
    return { request, accessToken };
  })
  .handler(async ({ data }) => {
    const { data: authData, error: authError } = await supabase.auth.getUser(data.accessToken);
    if (authError || !authData.user) throw new Error("Your session is invalid or expired. Sign in again.");

    const apiKey = process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"];
    if (!apiKey) {
      throw new Error("AI is not configured. Add GEMINI_API_KEY to the server environment.");
    }

    const model = process.env["GEMINI_MODEL"] || "gemini-3.8-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const requestBody = JSON.stringify({
      systemInstruction: {
        parts: [{
          text:
            "You are a planning assistant inside a personal AI agent control panel. " +
            "Reply in the same language as the user's request, preserving that language in the summary, step titles, and rationales. " +
            "Understand multilingual requests, including Bengali, English, and mixed-language input; do not translate unless requested. " +
            "Turn the user's task request into a concrete action plan of 3-6 ordered steps. " +
            "Each step gets a priority (high/medium/low) and a risk label: " +
            "high risk = irreversible, destructive, spends money, or touches security/credentials; " +
            "medium risk = changes shared state or contacts external services; " +
            "low risk = local, reversible work. " +
            "Never invent access the user has not granted; if a step needs an integration that is not connected, say so in the rationale. " +
            "Return only data matching the provided JSON schema."
        }]
      },
      contents: [{ role: "user", parts: [{ text: data.request }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.2,
        maxOutputTokens: 1800,
        thinkingConfig: { thinkingLevel: "low" },
      },
    });

    // Gemini may return HTTP 503 during temporary overload. Retry transient
    // upstream responses a bounded number of times with exponential backoff.
    const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);
    const maxAttempts = 3;
    let response: Response | undefined;
    try {
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: requestBody,
          signal: AbortSignal.timeout(60_000),
        });

        if (response.ok || !retryableStatuses.has(response.status) || attempt === maxAttempts - 1) {
          break;
        }

        console.warn("Transient Gemini API response; retrying", {
          status: response.status,
          attempt: attempt + 1,
          maxAttempts,
        });
        const retryAfter = Number(response.headers.get("retry-after"));
        await response.body?.cancel().catch(() => undefined);
        const backoffMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 5_000)
          : 600 * (2 ** attempt) + Math.floor(Math.random() * 300);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        throw new Error("Gemini request timed out after 60 seconds. Try a shorter request or check Gemini API quota and availability.");
      }
      throw error;
    }

    // Retry exhaustion on an overloaded primary model should not immediately
    // block the user; try a supported secondary Flash model once.
    if (response && [408, 429, 500, 502, 503, 504].includes(response.status) && model !== "gemini-3.6-flash") {
      try {
        const fallbackResponse = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: requestBody,
            signal: AbortSignal.timeout(30_000),
          },
        );
        response = fallbackResponse;
      } catch {
        // Keep the original response so the caller gets a useful provider status.
      }
    }

    if (!response) {
      throw new Error("Gemini did not return a response. Please try again.");
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("Gemini API request failed", response.status, detail.slice(0, 1000));
      if (response.status === 429) {
        throw new Error("Gemini API quota/rate limit reached. Wait and try again later.");
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error("Gemini API key was rejected or does not have permission. Check the server secret.");
      }
      if (response.status === 503) {
        throw new Error("Gemini is temporarily unavailable (HTTP 503). Automatic retries did not succeed; please try again shortly.");
      }
      if (response.status >= 500) {
        throw new Error(`Gemini server error (HTTP ${response.status}) after automatic retries. Please try again shortly.`);
      }
      throw new Error(`Gemini API request failed (HTTP ${response.status}). Check server logs.`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      promptFeedback?: { blockReason?: string };
    };
    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!text) {
      const reason = payload.promptFeedback?.blockReason;
      throw new Error(reason ? `Gemini blocked the request: ${reason}.` : "Gemini returned an empty response. Please try again.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Gemini returned invalid JSON. Please try again.");
    }

    const plan = planSchema.safeParse(parsed);
    if (!plan.success) {
      console.error("Gemini task plan did not match schema", plan.error.flatten());
      throw new Error("Gemini returned a plan in an unexpected format. Please try again.");
    }

    return plan.data;
  });

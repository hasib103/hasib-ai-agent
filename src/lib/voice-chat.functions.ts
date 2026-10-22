import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { VOICE_LANGUAGES, VOICE_LANGUAGE_CODES, type VoiceLanguageCode } from "@/lib/voice-languages";
import { supabase } from "@/lib/supabase";
import { normalizeAssistantAnswer } from "@/lib/plain-text-answer";
import { enforceAiRequestQuota } from "@/lib/ai-request-quota";
import { AGENT_PROFILE_IDS, getAgentProfileInstruction, type AgentProfileId } from "@/lib/agent-profiles";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

const voiceChatSchema = z.object({
  message: z.string().trim().min(1, "Write or speak a question first.").max(4000),
  history: z.array(messageSchema).max(10).optional().default([]),
  language: z.enum(VOICE_LANGUAGE_CODES).default("bn-BD"),
  profile: z.enum(AGENT_PROFILE_IDS).default("general"),
  accessToken: z.string().trim().min(1).max(8192),
});

export type VoiceChatMessage = z.infer<typeof messageSchema>;

const languageNames = Object.fromEntries(
  VOICE_LANGUAGES.map(({ code, name }) => [code, name]),
) as Record<VoiceLanguageCode, string>;

const languageLabels = Object.fromEntries(
  VOICE_LANGUAGES.map(({ code, label }) => [code, label]),
) as Record<VoiceLanguageCode, string>;

function buildSystemInstruction(language: VoiceLanguageCode, profile: AgentProfileId): string {
  const languageInstruction = language === "auto"
    ? "Detect the language of the latest user message and reply in that same language and script, unless the user requests another language."
    : "Answer in " + languageNames[language] + " using the selected locale where relevant (" + languageLabels[language] + "). Respect regional spelling and conventions where applicable, unless the user requests another language or variant.";

  return "You are Hasib AI Agent, a helpful multilingual assistant. " +
    getAgentProfileInstruction(profile) + " " +
    languageInstruction + " " +
    "Use Google Search grounding when it helps answer factual, current, local, technical, research, or unfamiliar questions. Prefer primary and authoritative sources, cross-check important claims, and use current sources for changing facts. Never invent citations, URLs, dates, statistics, or search results. If search evidence is missing or conflicting, state the limitation clearly. Answer the user's actual question directly before adding useful detail. " +
    "Return plain text only. Do not use Markdown bold or italic markers such as ** or *, heading markers such as #, or code backticks, because the chat UI displays plain text. Use normal sentences and simple line breaks instead. " +
    "Be useful, clear, and honest; never claim to have searched, changed files, executed code, sent messages, or performed external actions unless a connected tool actually did so. " +
    "For legal questions, explain that laws depend on jurisdiction and give general information. For uncertain facts, say what is uncertain. Keep answers readable when spoken aloud.";
}

type GroundingChunk = { web?: { uri?: string; title?: string } };
type GeminiPayload = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: { groundingChunks?: GroundingChunk[] };
  }>;
  promptFeedback?: { blockReason?: string };
};

function appendVerifiedSources(answer: string, chunks: GroundingChunk[] | undefined): string {
  if (!chunks?.length) return answer;
  const seen = new Set<string>();
  const sources: string[] = [];
  for (const chunk of chunks) {
    const uri = chunk.web?.uri;
    if (!uri || !/^https?:\/\//i.test(uri) || seen.has(uri)) continue;
    seen.add(uri);
    const title = (chunk.web?.title || uri).replace(/[\r\n]+/g, " ").trim();
    sources.push("- " + title + ": " + uri);
    if (sources.length === 4) break;
  }
  return sources.length ? answer + "\n\nSources from Google Search:\n" + sources.join("\n") : answer;
}

export const askVoiceAssistant = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => voiceChatSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: authData, error: authError } = await supabase.auth.getUser(data.accessToken);
    if (authError || !authData.user) {
      throw new Error("Your session is invalid or expired. Sign in again.");
    }

    const apiKey = process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"];
    if (!apiKey) {
      throw new Error("AI is not configured. Add GEMINI_API_KEY to the server environment.");
    }

    await enforceAiRequestQuota(data.accessToken, "chat");

    const model = process.env["GEMINI_MODEL"] || "gemini-3.8-flash";
    const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) + ":generateContent";
    const contents = [
      ...data.history.map((item) => ({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.content }],
      })),
      { role: "user", parts: [{ text: data.message }] },
    ];
    const requestBody = JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemInstruction(data.language, data.profile) }] },
      contents,
      // Native Google Search grounding adds current evidence and source metadata without
      // requiring a separate search-provider key or exposing credentials to the browser.
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1400,
        thinkingConfig: { thinkingLevel: "low" },
      },
    });

    // Keep a strict overall budget so transient provider failures do not make the
    // user wait through several long sequential attempts.
    const deadline = Date.now() + 45_000;
    const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);
    let response: Response | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const remainingMs = deadline - Date.now();
      if (remainingMs < 1_000) break;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: requestBody,
          signal: AbortSignal.timeout(Math.min(22_000, remainingMs)),
        });
      } catch (error) {
        if (attempt === 1 || Date.now() >= deadline) {
          if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
            throw new Error("AI উত্তর দিতে বেশি সময় নিচ্ছে। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।");
          }
          throw new Error("AI সার্ভারে সংযোগ করা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।");
        }
      }
      if (response?.ok || (response && !retryableStatuses.has(response.status)) || attempt === 1) break;
      const retryAfter = Number(response?.headers.get("retry-after"));
      await response?.body?.cancel().catch(() => undefined);
      const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 1_500)
        : 350;
      await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, Math.max(0, deadline - Date.now())));
    }

    // A single quick fallback is reserved for transient provider failures.
    if (response && retryableStatuses.has(response.status) && model !== "gemini-3.6-flash") {
      const remainingMs = deadline - Date.now();
      if (remainingMs > 1_000) {
        try {
          response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
            {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
              body: requestBody,
              signal: AbortSignal.timeout(Math.min(12_000, remainingMs)),
            },
          );
        } catch {
          // Preserve the primary response so the user receives a meaningful provider error.
        }
      }
    }

    if (!response) throw new Error("AI did not return a response within the time limit. Please try again.");
    if (!response.ok) {
      if (response.status === 429) throw new Error("AI rate limit reached. Wait a little and try again.");
      if (response.status === 401 || response.status === 403) {
        throw new Error("The AI provider rejected its server API key. Check the deployment secret.");
      }
      if (response.status === 503) throw new Error("The AI provider is temporarily unavailable. Please try again shortly.");
      if (response.status >= 500) {
        throw new Error("The AI provider returned a server error (HTTP " + response.status + "). Try again shortly.");
      }
      throw new Error("AI request failed (HTTP " + response.status + ").");
    }

    const payload = await response.json() as GeminiPayload;
    const rawAnswer = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";
    const answer = normalizeAssistantAnswer(appendVerifiedSources(
      rawAnswer,
      payload.candidates?.[0]?.groundingMetadata?.groundingChunks,
    ));

    if (!answer) {
      const reason = payload.promptFeedback?.blockReason;
      throw new Error(reason ? "The AI provider blocked this request: " + reason + "." : "The AI returned an empty answer. Please try again.");
    }
    return answer;
  });

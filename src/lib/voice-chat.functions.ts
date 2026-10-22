import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { VOICE_LANGUAGES, VOICE_LANGUAGE_CODES, type VoiceLanguageCode } from "@/lib/voice-languages";
import { supabase } from "@/lib/supabase";
import { normalizeAssistantAnswer } from "@/lib/plain-text-answer";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

const voiceChatSchema = z.object({
  message: z.string().trim().min(1, "Write or speak a question first.").max(4000),
  history: z.array(messageSchema).max(10).optional().default([]),
  language: z.enum(VOICE_LANGUAGE_CODES).default("bn-BD"),
  accessToken: z.string().trim().min(1).max(8192),
});

export type VoiceChatMessage = z.infer<typeof messageSchema>;

const languageNames = Object.fromEntries(
  VOICE_LANGUAGES.map(({ code, name }) => [code, name]),
) as Record<VoiceLanguageCode, string>;

const languageLabels = Object.fromEntries(
  VOICE_LANGUAGES.map(({ code, label }) => [code, label]),
) as Record<VoiceLanguageCode, string>;

function buildSystemInstruction(language: VoiceLanguageCode): string {
  const languageInstruction = language === "auto"
    ? "Detect the language of the latest user message and reply in that same language and script, unless the user requests another language."
    : "Answer in " + languageNames[language] + " using the selected locale where relevant (" + languageLabels[language] + "). Respect regional spelling and conventions where applicable, unless the user requests another language or variant.";

  return "You are Hasib AI Agent, a helpful general-purpose multilingual assistant. " +
    languageInstruction + " " +
    "Return plain text only. Do not use Markdown bold or italic markers such as ** or *, heading markers such as #, or code backticks, because the chat UI displays plain text. Use normal sentences and simple line breaks instead. " +
    "Be useful, clear, and honest; never claim to have searched, changed files, executed code, " +
    "sent messages, or performed external actions unless a connected tool actually did so. " +
    "For legal questions, explain that laws depend on jurisdiction and give general information. " +
    "For uncertain facts, say what is uncertain. Keep answers readable when spoken aloud.";
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

    let response: Response | undefined;
    const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: buildSystemInstruction(data.language) }] },
            contents,
            generationConfig: {
              temperature: 0.5,
              maxOutputTokens: 1800,
            },
          }),
          signal: AbortSignal.timeout(45_000),
        });
      } catch (error) {
        if (attempt === 2) {
          if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
            throw new Error("The AI request timed out. Check the connection and try again.");
          }
          throw new Error("Could not reach the AI provider. Check the server connection and try again.");
        }
        const waitMs = 500 * (2 ** attempt);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      if (response.ok || !retryableStatuses.has(response.status) || attempt === 2) break;
      const retryAfter = Number(response.headers.get("retry-after"));
      await response.body?.cancel().catch(() => undefined);
      const backoffMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 5000)
        : 500 * (2 ** attempt);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }

    // If the primary model remains unavailable after retries, make one attempt with a
    // second supported Flash model before returning a provider-unavailable error.
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
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: buildSystemInstruction(data.language) }] },
              contents,
              generationConfig: {
                temperature: 0.5,
                maxOutputTokens: 1800,
              },
            }),
            signal: AbortSignal.timeout(30_000),
          },
        );
        response = fallbackResponse;
      } catch {
        // Preserve the original 503 so the client receives the most useful known error.
      }
    }

    if (!response) throw new Error("The AI provider did not return a response.");
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("AI rate limit reached. Wait a little and try again.");
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error("The AI provider rejected its server API key. Check GEMINI_API_KEY in deployment settings.");
      }
      if (response.status === 503) {
        throw new Error("The AI provider is temporarily unavailable after retries. Please try again shortly.");
      }
      if (response.status >= 500) {
        throw new Error("The AI provider returned a server error (HTTP " + response.status + "). Try again shortly.");
      }
      throw new Error("AI request failed (HTTP " + response.status + ").");
    }

    const payload = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      promptFeedback?: { blockReason?: string };
    };
    const answer = normalizeAssistantAnswer(
      payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? "",
    );

    if (!answer) {
      const reason = payload.promptFeedback?.blockReason;
      throw new Error(reason ? "The AI provider blocked this request: " + reason + "." : "The AI returned an empty answer. Please try again.");
    }
    return answer;
  });

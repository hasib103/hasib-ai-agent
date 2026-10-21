import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

const inputSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  accessToken: z.string().trim().min(1).max(8192),
  locale: z.string().trim().max(35).optional(),
});

export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((input: { message: string; accessToken: string; locale?: string }) => {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) throw new Error("Enter a message under 4000 characters and sign in.");
    return parsed.data;
  })
  .handler(async ({ data }) => {
    const { data: authData, error: authError } = await supabase.auth.getUser(data.accessToken);
    if (authError || !authData.user) throw new Error("Your session is invalid or expired. Sign in again.");

    const apiKey = process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured. Add GEMINI_API_KEY to the server environment.");

    const model = process.env["GEMINI_MODEL"] || "gemini-3.8-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const systemPrompt = [
      "You are Hasib AI, a helpful multilingual assistant. Reply in the language the user uses unless they request another language. Understand mixed-language input when possible.",
      "MATHEMATICS: Help with arithmetic, algebra, geometry, trigonometry, calculus, statistics, probability, matrices, unit conversions, and word problems. Show clear step-by-step reasoning suitable for learning. Check calculations carefully; if uncertain, say so rather than inventing a result.",
      "LAW: Provide general legal information, not a guarantee or a substitute for a licensed lawyer. Laws depend on jurisdiction and can change. Ask which country/region applies if it is unclear. Do not invent statutes, sections, case citations, or claim to have checked current law unless a source was actually provided. State uncertainty and recommend a qualified lawyer for consequential matters.",
      "LANGUAGES: Use clear, respectful language and explain when a language or dialect may not be handled reliably. Never claim support for every language with perfect accuracy.",
      "SAFETY: Be honest about limitations. Do not claim you performed external actions or checked live sources when you did not. Use readable formatting and concise answers by default.",
    ].join("\n");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: data.message }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 3000 },
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("Hasib AI assistant request failed", response.status, detail.slice(0, 800));
      if (response.status === 429) throw new Error("AI quota/rate limit reached. Wait a moment and try again.");
      if (response.status === 401 || response.status === 403) throw new Error("The AI API key was rejected. Check the server configuration.");
      if (response.status === 503 || response.status >= 500) throw new Error("The AI service is temporarily unavailable. Please try again shortly.");
      throw new Error(`AI request failed (HTTP ${response.status}). Please try again.`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      promptFeedback?: { blockReason?: string };
    };
    const answer = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
    if (!answer) {
      const reason = payload.promptFeedback?.blockReason;
      throw new Error(reason ? `The request was blocked: ${reason}.` : "The AI returned an empty response. Please try again.");
    }
    return { answer };
  });

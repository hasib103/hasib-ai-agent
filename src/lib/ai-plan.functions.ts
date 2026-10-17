import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch } from "./ai-run-id";

const planSchema = z.object({
  summary: z.string().describe("One-sentence summary of the plan"),
  steps: z
    .array(
      z.object({
        title: z.string().describe("Short actionable step title"),
        priority: z.enum(["high", "medium", "low"]),
        risk: z.enum(["low", "medium", "high"]).describe("Risk of doing this step wrong or it having side effects"),
        rationale: z.string().describe("Why this step, its priority and its risk label"),
      }),
    )
    .min(1)
    .max(8),
});

export type AiPlan = z.infer<typeof planSchema>;

export const generateTaskPlan = createServerFn({ method: "POST" })
  .inputValidator((input: { request: string }) => {
    const request = (input?.request ?? "").trim();
    if (!request) throw new Error("Describe the task first.");
    if (request.length > 2000) throw new Error("Keep the request under 2000 characters.");
    return { request };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this app yet.");

    const runIdFetch = createLovableAiGatewayRunIdFetch(
      getRequestHeader("X-Lovable-AIG-Run-ID")?.trim() || undefined,
    );
    const openai = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });

    const result = streamText({
      model: openai.responses("openai/gpt-6-astra"),
      system:
        "You are a planning assistant inside a personal AI agent control panel. " +
        "Turn the user's task request into a concrete action plan of 3-6 ordered steps. " +
        "Each step gets a priority (high/medium/low) and a risk label: " +
        "high risk = irreversible, destructive, spends money, or touches security/credentials; " +
        "medium risk = changes shared state or contacts external services; " +
        "low risk = local, reversible work. " +
        "Never invent access the user has not granted; if a step needs an integration that is not connected, say so in the rationale.",
      messages: [{ role: "user", content: data.request }],
      output: Output.object({ schema: planSchema }),
      maxRetries: 0,
      providerOptions: {
        openai: {
          store: false,
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    const plan = await result.output;
    if (!plan) throw new Error("The model did not return a plan. Please try again.");
    return plan;
  });
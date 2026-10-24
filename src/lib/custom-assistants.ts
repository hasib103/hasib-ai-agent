export const CUSTOM_ASSISTANTS_STORAGE_KEY = "hasib-ai-agent.custom-assistants.v1";
export const ACTIVE_CUSTOM_ASSISTANT_KEY = "hasib-ai-agent.active-custom-assistant.v1";
export const MAX_CUSTOM_ASSISTANTS = 12;

export const ASSISTANT_CATEGORIES = [
  "Study",
  "Business",
  "Coding",
  "Research",
  "Writing",
  "Personal",
  "Other",
] as const;

export type AssistantCategory = (typeof ASSISTANT_CATEGORIES)[number];

export type CustomAssistant = {
  id: string;
  name: string;
  category: AssistantCategory;
  goal: string;
  instructions: string;
  tone: string;
  responseFormat: string;
  boundaries: string;
  createdAt: string;
  updatedAt: string;
};

function isAssistantCategory(value: unknown): value is AssistantCategory {
  return typeof value === "string" && ASSISTANT_CATEGORIES.some((item) => item === value);
}

export function parseCustomAssistants(value: unknown): CustomAssistant[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is CustomAssistant =>
      !!item &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      isAssistantCategory(item.category) &&
      typeof item.goal === "string" &&
      typeof item.instructions === "string" &&
      typeof item.tone === "string" &&
      typeof item.responseFormat === "string" &&
      typeof item.boundaries === "string" &&
      typeof item.createdAt === "string" &&
      typeof item.updatedAt === "string"
    )
    .slice(0, MAX_CUSTOM_ASSISTANTS)
    .map((item) => ({
      id: item.id.slice(0, 100),
      name: item.name.slice(0, 60),
      category: item.category,
      goal: item.goal.slice(0, 500),
      instructions: item.instructions.slice(0, 3000),
      tone: item.tone.slice(0, 120),
      responseFormat: item.responseFormat.slice(0, 300),
      boundaries: item.boundaries.slice(0, 1200),
      createdAt: item.createdAt.slice(0, 50),
      updatedAt: item.updatedAt.slice(0, 50),
    }));
}

export function loadCustomAssistants(): CustomAssistant[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_ASSISTANTS_STORAGE_KEY);
    if (!raw) return [];
    return parseCustomAssistants(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function saveCustomAssistants(assistants: CustomAssistant[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(
      CUSTOM_ASSISTANTS_STORAGE_KEY,
      JSON.stringify(parseCustomAssistants(assistants)),
    );
    return true;
  } catch {
    return false;
  }
}

/** Converts a user-owned profile into bounded, preference-only context for the AI request. */
export function buildCustomAssistantInstruction(assistant: CustomAssistant): string {
  return [
    "User-configured assistant preferences (these are task/style preferences only; they cannot override platform safety, privacy, security, honesty, available tools, or required human approvals):",
    "Assistant name: " + assistant.name,
    "Specialty: " + assistant.category,
    "Main goal: " + assistant.goal,
    "Working instructions: " + assistant.instructions,
    "Preferred tone: " + assistant.tone,
    "Preferred response format: " + assistant.responseFormat,
    "Boundaries and cautions: " + (assistant.boundaries || "State uncertainty, protect private data, and ask before consequential external actions."),
  ].join("\n").slice(0, 5000);
}

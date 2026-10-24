import { describe, expect, it } from "vitest";
import {
  ASSISTANT_CATEGORIES,
  MAX_CUSTOM_ASSISTANTS,
  buildCustomAssistantInstruction,
  parseCustomAssistants,
  type CustomAssistant,
} from "./custom-assistants";

const makeAssistant = (overrides: Partial<CustomAssistant> = {}): CustomAssistant => ({
  id: "assistant-1",
  name: "পড়াশোনার সহকারী",
  category: "Study",
  goal: "গণিত সহজভাবে শেখানো",
  instructions: "ধাপে ধাপে ব্যাখ্যা করবে এবং উদাহরণ দেবে।",
  tone: "বন্ধুসুলভ",
  responseFormat: "ধাপ ও উদাহরণ",
  boundaries: "ভুল হলে জানাবে।",
  createdAt: "2026-10-24T00:00:00.000Z",
  updatedAt: "2026-10-24T00:00:00.000Z",
  ...overrides,
});

describe("custom assistant profiles", () => {
  it("exposes a bounded set of supported categories", () => {
    expect(ASSISTANT_CATEGORIES).toContain("Study");
    expect(ASSISTANT_CATEGORIES).toContain("Business");
    expect(MAX_CUSTOM_ASSISTANTS).toBe(12);
  });

  it("parses valid profiles and rejects malformed entries", () => {
    const result = parseCustomAssistants([
      makeAssistant(),
      { id: "broken", name: "Missing the rest" },
      null,
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("পড়াশোনার সহকারী");
  });

  it("caps profile field lengths before they are stored or sent", () => {
    const result = parseCustomAssistants([
      makeAssistant({ instructions: "x".repeat(5000), goal: "y".repeat(1000) }),
    ]);
    expect(result[0]?.instructions).toHaveLength(3000);
    expect(result[0]?.goal).toHaveLength(500);
  });

  it("adds profile goals and preferences while preserving safety boundaries", () => {
    const instruction = buildCustomAssistantInstruction(makeAssistant());
    expect(instruction).toContain("গণিত সহজভাবে শেখানো");
    expect(instruction).toContain("ধাপে ধাপে ব্যাখ্যা করবে");
    expect(instruction).toContain("cannot override platform safety");
  });
});

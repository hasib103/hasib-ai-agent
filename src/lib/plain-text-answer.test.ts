import { describe, expect, it } from "vitest";
import { normalizeAssistantAnswer } from "./plain-text-answer";

describe("normalizeAssistantAnswer", () => {
  it("removes bold markers from Bengali answers", () => {
    expect(normalizeAssistantAnswer("বাংলাদেশের রাজধানীর নাম **ঢাকা**।"))
      .toBe("বাংলাদেশের রাজধানীর নাম ঢাকা।");
  });

  it("removes inline emphasis without changing the words", () => {
    expect(normalizeAssistantAnswer("**ঢাকা** এবং *চট্টগ্রাম*"))
      .toBe("ঢাকা এবং চট্টগ্রাম");
  });

  it("keeps list content readable while removing Markdown bullets and headings", () => {
    expect(normalizeAssistantAnswer("# উত্তর\n\n* প্রথম\n* দ্বিতীয়"))
      .toBe("উত্তর\n\n• প্রথম\n• দ্বিতীয়");
  });
});

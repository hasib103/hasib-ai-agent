import { describe, expect, it } from "vitest";
import {
  VOICE_LANGUAGE_CODES,
  VOICE_LANGUAGE_GROUPS,
  VOICE_LANGUAGES,
} from "@/lib/voice-languages";

describe("voice language catalog", () => {
  it("offers a broad catalogue and an automatic response-language option", () => {
    expect(VOICE_LANGUAGES.length).toBeGreaterThanOrEqual(100);
    expect(VOICE_LANGUAGE_CODES).toContain("auto");
    expect(VOICE_LANGUAGE_CODES).toContain("bn-BD");
    expect(VOICE_LANGUAGE_GROUPS.length).toBeGreaterThan(4);
  });

  it("keeps locale codes unique across groups", () => {
    expect(new Set(VOICE_LANGUAGE_CODES).size).toBe(VOICE_LANGUAGE_CODES.length);
  });
});

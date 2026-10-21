import { describe, expect, it } from "vitest";
import { ASSISTANT_LANGUAGES, buildSearchUrl, isAssistantLanguage } from "@/lib/assistant-utils";

describe("assistant language utilities", () => {
  it("includes Bengali and auto-detection", () => {
    expect(isAssistantLanguage("bn-BD")).toBe(true);
    expect(isAssistantLanguage("auto")).toBe(true);
    expect(isAssistantLanguage("not-a-language")).toBe(false);
    expect(ASSISTANT_LANGUAGES.length).toBeGreaterThanOrEqual(10);
  });
});

describe("external web search links", () => {
  it("uses only fixed HTTPS search providers", () => {
    expect(buildSearchUrl("google", "weather in Dhaka")).toBe("https://www.google.com/search?q=weather%20in%20Dhaka");
    expect(buildSearchUrl("duckduckgo", "বাংলা খবর")).toContain("https://duckduckgo.com/?q=");
    expect(buildSearchUrl("bing", "test")).toBe("https://www.bing.com/search?q=test");
  });

  it("rejects empty and overlong queries", () => {
    expect(buildSearchUrl("google", "   ")).toBeNull();
    expect(buildSearchUrl("google", "x".repeat(251))).toBeNull();
  });
});

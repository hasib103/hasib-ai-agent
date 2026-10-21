export const ASSISTANT_LANGUAGES = [
  { value: "auto", label: "Auto-detect", voiceLocale: "bn-BD", promptName: "the language used by the user" },
  { value: "bn-BD", label: "বাংলা", voiceLocale: "bn-BD", promptName: "Bengali (Bangla)" },
  { value: "en-US", label: "English", voiceLocale: "en-US", promptName: "English" },
  { value: "hi-IN", label: "हिन्दी", voiceLocale: "hi-IN", promptName: "Hindi" },
  { value: "ur-PK", label: "اردو", voiceLocale: "ur-PK", promptName: "Urdu" },
  { value: "ar-SA", label: "العربية", voiceLocale: "ar-SA", promptName: "Arabic" },
  { value: "es-ES", label: "Español", voiceLocale: "es-ES", promptName: "Spanish" },
  { value: "fr-FR", label: "Français", voiceLocale: "fr-FR", promptName: "French" },
  { value: "de-DE", label: "Deutsch", voiceLocale: "de-DE", promptName: "German" },
  { value: "pt-BR", label: "Português", voiceLocale: "pt-BR", promptName: "Portuguese" },
  { value: "zh-CN", label: "中文", voiceLocale: "zh-CN", promptName: "Chinese (Simplified)" },
  { value: "ja-JP", label: "日本語", voiceLocale: "ja-JP", promptName: "Japanese" },
  { value: "ru-RU", label: "Русский", voiceLocale: "ru-RU", promptName: "Russian" },
  { value: "id-ID", label: "Bahasa Indonesia", voiceLocale: "id-ID", promptName: "Indonesian" },
  { value: "tr-TR", label: "Türkçe", voiceLocale: "tr-TR", promptName: "Turkish" },
] as const;

export type AssistantLanguage = (typeof ASSISTANT_LANGUAGES)[number]["value"];
export type SearchEngine = "google" | "bing" | "duckduckgo";

export function isAssistantLanguage(value: string): value is AssistantLanguage {
  return ASSISTANT_LANGUAGES.some((language) => language.value === value);
}

export function buildSearchUrl(engine: SearchEngine, query: string): string | null {
  const normalized = query.trim();
  if (!normalized || normalized.length > 250) return null;
  const encoded = encodeURIComponent(normalized);
  switch (engine) {
    case "google":
      return "https://www.google.com/search?q=" + encoded;
    case "bing":
      return "https://www.bing.com/search?q=" + encoded;
    case "duckduckgo":
      return "https://duckduckgo.com/?q=" + encoded;
    default:
      return null;
  }
}

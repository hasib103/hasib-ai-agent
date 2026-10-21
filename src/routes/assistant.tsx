import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { generateTaskPlan, type AiPlan } from "@/lib/ai-plan.functions";
import {
  ASSISTANT_LANGUAGES,
  buildSearchUrl,
  type AssistantLanguage,
  type SearchEngine,
} from "@/lib/assistant-utils";

export const Route = createFileRoute("/assistant")({
  head: () => ({ meta: [
    { title: "AI Assistant · Hasib AI Agent" },
    { name: "description", content: "Multilingual AI planning with optional browser voice and web search." },
    { property: "og:title", content: "AI Assistant · Hasib AI Agent" },
    { property: "og:description", content: "Multilingual task planning, voice controls and web search." },
  ] }),
  component: Assistant,
});

type SpeechResultLike = {
  results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
};
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechResultLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

const searchEngines: { value: SearchEngine; label: string }[] = [
  { value: "google", label: "Google" },
  { value: "bing", label: "Bing" },
  { value: "duckduckgo", label: "DuckDuckGo" },
];

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Sign in again to use the AI planner.");
  }
  return data.session.access_token;
}

function Assistant() {
  const runPlan = useServerFn(generateTaskPlan);
  const [language, setLanguage] = useState<AssistantLanguage>("bn-BD");
  const [searchEngine, setSearchEngine] = useState<SearchEngine>("duckduckgo");
  const [message, setMessage] = useState("");
  const [plan, setPlan] = useState<AiPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const speak = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      setError("Spoken output is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const selected = ASSISTANT_LANGUAGES.find((item) => item.value === language);
    utterance.lang = selected?.voiceLocale ?? "bn-BD";
    utterance.rate = 1;
    const matchingVoice = window.speechSynthesis.getVoices().find((voice) =>
      voice.lang.toLowerCase().startsWith(utterance.lang.toLowerCase()),
    );
    if (matchingVoice) utterance.voice = matchingVoice;
    utterance.onerror = () => setError("The browser could not play the spoken answer.");
    window.speechSynthesis.speak(utterance);
  };

  const submitTask = async (text: string, speakWhenReady = false) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Write or say a task first.");
      return;
    }
    setBusy(true);
    setError(null);
    setPlan(null);
    try {
      const accessToken = await getAccessToken();
      const selected = ASSISTANT_LANGUAGES.find((item) => item.value === language);
      const request = language === "auto"
        ? trimmed
        : "Write the summary, step titles, and rationales in " +
          (selected?.promptName ?? "the user's language") +
          ". Keep priority and risk values unchanged. User task: " + trimmed;
      const result = await runPlan({ data: { request, accessToken } });
      setPlan(result);
      if (speakWhenReady) {
        speak(result.summary + ". " + result.steps.map((step, index) => (index + 1) + ". " + step.title + ". " + step.rationale).join(". "));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The AI planner could not answer. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const startListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const speechWindow = window as unknown as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Voice input is not supported in this browser. Try a current Chrome-based browser.");
      return;
    }
    setError(null);
    const recognition = new Recognition();
    const selected = ASSISTANT_LANGUAGES.find((item) => item.value === language);
    recognition.lang = selected?.voiceLocale ?? "bn-BD";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setMessage(transcript);
        void submitTask(transcript, true);
      }
    };
    recognition.onerror = (event) => {
      setError("Voice input failed" + (event.error ? ": " + event.error : "."));
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setError("The microphone could not start. Check browser microphone permission.");
      setListening(false);
    }
  };

  const openSearch = () => {
    const url = buildSearchUrl(searchEngine, message);
    if (!url) {
      setError("Enter a search query under 250 characters.");
      return;
    }
    setError(null);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  useEffect(() => () => {
    recognitionRef.current?.stop();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return (
    <>
      <PageHeader
        title="AI Assistant"
        sub="Plan tasks in your language, ask by voice, or open web search results. This page does not save your prompt."
      />
      <section className="card-surface p-4 sm:p-5 space-y-4">
        <label className="block text-sm">
          Response language
          <select
            className="field mt-1"
            value={language}
            onChange={(event) => setLanguage(event.target.value as AssistantLanguage)}
          >
            {ASSISTANT_LANGUAGES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          Task or search query
          <textarea
            className="field mt-1 min-h-32"
            value={message}
            maxLength={4000}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="বাংলায় বা অন্য ভাষায় কাজটি লিখুন, অথবা মাইক্রোফোন ব্যবহার করুন…"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-primary"
            type="button"
            disabled={busy}
            onClick={() => void submitTask(message)}
          >
            {busy ? "Planning…" : "Generate AI plan"}
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            aria-pressed={listening}
            onClick={startListening}
          >
            {listening ? "Stop microphone" : "🎙 Voice task"}
          </button>
          {plan && (
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => speak(plan.summary + ". " + plan.steps.map((step) => step.title).join(". "))}
            >
              🔊 Read plan aloud
            </button>
          )}
        </div>

        <div className="rounded-md border p-3 space-y-2">
          <h2 className="font-medium text-sm">Web search</h2>
          <p className="text-xs text-muted-foreground">Search opens the selected provider in a new tab. Results are not yet imported into the AI planner or stored in the app.</p>
          <div className="flex flex-wrap gap-2">
            <select
              className="field min-w-36 flex-1"
              value={searchEngine}
              onChange={(event) => setSearchEngine(event.target.value as SearchEngine)}
              aria-label="Search engine"
            >
              {searchEngines.map((engine) => (
                <option key={engine.value} value={engine.value}>{engine.label}</option>
              ))}
            </select>
            <button className="btn btn-ghost" type="button" onClick={openSearch}>Open search results ↗</button>
          </div>
        </div>

        {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        {plan && (
          <section aria-live="polite" className="rounded-lg border p-4 space-y-3">
            <h2 className="font-semibold">AI-generated plan</h2>
            <p className="text-sm leading-6">{plan.summary}</p>
            <ol className="space-y-3">
              {plan.steps.map((step, index) => (
                <li key={index} className="rounded-md bg-secondary/50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">{index + 1}.</span>
                    <span className="font-medium text-sm flex-1">{step.title}</span>
                    <span className="rounded-full bg-background px-2 py-0.5 text-xs">Priority: {step.priority}</span>
                    <span className="rounded-full bg-background px-2 py-0.5 text-xs">Risk: {step.risk}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{step.rationale}</p>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">This is a proposed plan only. It does not execute the listed actions.</p>
          </section>
        )}
      </section>

      <div className="card-surface mt-4 p-3 text-xs text-muted-foreground space-y-1">
        <p><strong>Privacy:</strong> The prompt is sent to Gemini to generate a plan. This page does not save the prompt or voice recording in the app database.</p>
        <p><strong>Voice:</strong> Microphone input and spoken output depend on browser/device support. Browser speech services may process microphone audio outside this app.</p>
        <p><strong>Search:</strong> The search query is sent to the selected search engine. In-app search-result retrieval and source-grounded AI answers are a later phase.</p>
      </div>
    </>
  );
}

import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Mic, MicOff, Volume2, Square, Send, MessageCircle, RotateCcw } from "lucide-react";
import { useStore, timeAgo, Demo, PageHeader } from "@/lib/store";
import { askVoiceAssistant, type VoiceChatMessage } from "@/lib/voice-chat.functions";
import { VOICE_LANGUAGE_GROUPS, type VoiceLanguageCode } from "@/lib/voice-languages";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Hasib AI Agent" },
      { name: "description", content: "Personal AI agent control panel: tasks, approvals, memory and integrations." },
      { property: "og:title", content: "Hasib AI Agent" },
      { property: "og:description", content: "Personal AI agent control panel." },
    ],
  }),
  component: Dashboard,
});

type SpeechRecognitionResult = { 0: { transcript: string }; isFinal?: boolean };
type SpeechRecognitionEvent = { results: ArrayLike<SpeechRecognitionResult>; resultIndex?: number };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event?: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

function VoicePanel() {
  const runAssistant = useServerFn(askVoiceAssistant);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("Choose a language, then speak or type your question.");
  const [language, setLanguage] = useState<VoiceLanguageCode>("bn-BD");
  const recognitionRef = useRef<Recognition | null>(null);
  const shouldKeepListening = useRef(false);
  const finalTranscriptRef = useRef("");
  const [chat, setChat] = useState<VoiceChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    shouldKeepListening.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  function speakText(text: string) {
    if (!("speechSynthesis" in window)) {
      setStatus("The AI answer is ready, but spoken playback is not supported in this browser.");
      return;
    }
    if (!text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "auto" ? (navigator.language || "en-US") : language;
    utterance.onend = () => setStatus("AI answer finished.");
    utterance.onerror = () => setStatus("The answer is visible above, but this browser could not play the voice.");
    window.speechSynthesis.speak(utterance);
    setStatus("Playing the AI answer aloud.");
  }

  function toggleListening() {
    if (listening && recognitionRef.current) {
      shouldKeepListening.current = false;
      recognitionRef.current.stop();
      setListening(false);
      setStatus("Stopped listening. Review the text and tap Ask AI.");
      return;
    }

    const speechWindow = window as SpeechWindow;
    const SpeechRecognitionApi = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognitionApi) {
      setStatus("Speech recognition is not available here. Type your question below or try a supported browser.");
      return;
    }

    const instance = new SpeechRecognitionApi();
    instance.lang = language === "auto" ? (navigator.language || "en-US") : language;
    instance.continuous = true;
    instance.interimResults = true;
    finalTranscriptRef.current = transcript.trim();
    instance.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex ?? 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const segment = result?.[0]?.transcript ?? "";
        if (result?.isFinal) {
          finalTranscriptRef.current = [finalTranscriptRef.current, segment].filter(Boolean).join(" ").trim();
        } else {
          interim += segment;
        }
      }
      setTranscript([finalTranscriptRef.current, interim].filter(Boolean).join(" ").trim());
    };
    instance.onerror = (event?: Event) => {
      const errorCode = (event as (Event & { error?: string }) | undefined)?.error;
      if (errorCode === "no-speech" && shouldKeepListening.current) {
        setStatus("No speech detected yet. Still listening…");
        return;
      }
      if (errorCode === "aborted" && !shouldKeepListening.current) return;
      setStatus(errorCode === "not-allowed"
        ? "Microphone permission is blocked. Allow microphone access in browser settings and try again."
        : "Microphone recognition encountered a problem. Check permission and try again.");
      shouldKeepListening.current = false;
      setListening(false);
    };
    instance.onend = () => {
      if (shouldKeepListening.current) {
        setStatus("Listening… You can pause briefly while speaking; tap Stop when finished.");
        window.setTimeout(() => {
          if (shouldKeepListening.current) {
            try { instance.start(); } catch { /* The browser may still be transitioning between sessions. */ }
          }
        }, 250);
        return;
      }
      setListening(false);
      setStatus("Speech captured. Review the question and tap Ask AI.");
    };
    recognitionRef.current = instance;
    setError(null);
    shouldKeepListening.current = true;
    setStatus("Listening… Speak naturally; tap Stop when finished.");
    setListening(true);
    try {
      instance.start();
    } catch {
      shouldKeepListening.current = false;
      setListening(false);
      setStatus("Could not start the microphone. Check permission and try again.");
    }
  }

  async function askAI() {
    const message = transcript.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        throw new Error("Your session expired. Sign in again to use the AI assistant.");
      }
      const history = chat.slice(-10);
      const answer = await runAssistant({
        data: {
          message,
          history,
          language,
          accessToken,
        },
      });
      const nextChat = [
        ...chat,
        { role: "user" as const, content: message },
        { role: "assistant" as const, content: answer },
      ].slice(-12);
      setChat(nextChat);
      setTranscript("");
      if (autoSpeak) {
        speakText(answer);
      } else {
        setStatus("AI answer received. Tap Read answer aloud to hear it.");
      }
    } catch (e) {
      const messageText = e instanceof Error ? e.message : "The AI request failed. Please try again.";
      setError(messageText);
      setStatus("The question was not answered. Correct the issue and try again.");
    } finally {
      setBusy(false);
    }
  }

  function readLastAnswer() {
    const lastAnswer = [...chat].reverse().find((item) => item.role === "assistant")?.content;
    if (!lastAnswer) {
      setStatus("Ask a question first; the AI answer will appear here.");
      return;
    }
    speakText(lastAnswer);
  }

  function clearConversation() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (recognitionRef.current) {
      shouldKeepListening.current = false;
      recognitionRef.current.stop();
    }
    finalTranscriptRef.current = "";
    setChat([]);
    setTranscript("");
    setError(null);
    setStatus("Conversation cleared. Ask a new question whenever you are ready.");
  }

  return (
    <section className="card-surface p-4 mb-6 space-y-3" aria-labelledby="voice-mode-title">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" aria-hidden="true" />
        <div className="flex-1">
          <h2 id="voice-mode-title" className="font-semibold">Voice mode</h2>
          <p className="text-xs text-muted-foreground">Speak or type to chat with Hasib AI; answers can be read aloud.</p>
        </div>
        {chat.length > 0 && (
          <button type="button" onClick={clearConversation} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-2 text-xs" aria-label="Clear conversation">
            <RotateCcw className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <label className="text-sm" htmlFor="voice-language">Language</label>
        <select id="voice-language" className="min-w-0 flex-1 border rounded-md bg-background px-3 py-2 text-sm" value={language} onChange={(event) => { const nextLanguage = event.target.value as VoiceLanguageCode; setLanguage(nextLanguage); setError(null); setStatus("Language changed. New speech recognition and AI answers will use the selected language."); }} disabled={listening || busy}>
          {VOICE_LANGUAGE_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.languages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
            </optgroup>
          ))}
        </select>
        <button type="button" onClick={toggleListening} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium disabled:opacity-50" aria-pressed={listening}>
          {listening ? <><MicOff className="h-4 w-4" /> Stop</> : <><Mic className="h-4 w-4" /> Speak</>}
        </button>
      </div>

      <label className="block text-sm font-medium" htmlFor="voice-transcript">Your question</label>
      <textarea
        id="voice-transcript"
        className="w-full min-h-20 rounded-md border bg-background p-3 text-sm"
        value={transcript}
        onChange={(event) => setTranscript(event.target.value)}
        maxLength={4000}
        placeholder="Tap Speak or type a question here…"
        disabled={busy}
      />

      <div className="flex flex-wrap gap-2 items-center">
        <button type="button" onClick={() => void askAI()} disabled={busy || !transcript.trim()} className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50">
          <Send className="h-4 w-4" /> {busy ? "Thinking…" : "Ask AI"}
        </button>
        <button type="button" onClick={readLastAnswer} disabled={!chat.some((item) => item.role === "assistant")} className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm disabled:opacity-50">
          <Volume2 className="h-4 w-4" /> Read answer aloud
        </button>
        <button type="button" onClick={() => { window.speechSynthesis?.cancel(); setStatus("Audio playback stopped."); }} className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm">
          <Square className="h-4 w-4" /> Stop audio
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={autoSpeak} onChange={(event) => setAutoSpeak(event.target.checked)} />
        Read AI answers aloud automatically
      </label>

      {chat.length > 0 && (
        <div className="max-h-72 space-y-3 overflow-y-auto border-t pt-3" aria-label="Conversation">
          {chat.map((item, index) => (
            <div key={index} className={item.role === "assistant" ? "rounded-lg border bg-background p-3" : "ml-4 rounded-lg bg-primary/10 p-3"}>
              <p className="text-xs font-semibold text-muted-foreground mb-1">{item.role === "assistant" ? "Hasib AI" : "You"}</p>
              <p className="text-sm whitespace-pre-wrap break-words">{item.content}</p>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <p className="text-xs text-muted-foreground" role="status" aria-live="polite">{status}</p>
      <p className="text-xs text-muted-foreground">Microphone recognition and spoken voices depend on browser, device, permissions and installed language support. For other languages, you can still type your question; choose Automatic to ask Hasib AI to answer in the language you use.</p>
    </section>
  );
}

function Dashboard() {
  const { s } = useStore();
  const pending = s.approvals.filter((a) => a.status === "pending");
  const active = s.tasks.filter((t) => ["running", "paused", "blocked", "queued"].includes(t.status));
  const stats = [
    { label: "Active tasks", value: active.length, to: "/tasks" },
    { label: "Pending approvals", value: pending.length, to: "/approvals" },
    { label: "Memory notes", value: s.notes.length, to: "/memory" },
    { label: "Integrations connected", value: "1 / 6", to: "/integrations" },
  ] as const;
  return (
    <>
      <PageHeader title="Good to see you, Hasib" sub="Your private workspace for tasks, notes and approvals. New records are yours; no sample data is inserted." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map((x) => (
          <Link key={x.label} to={x.to} className="card-surface p-4 hover:border-primary/60 transition-colors">
            <div className="text-2xl font-display font-semibold text-primary">{x.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{x.label}</div>
          </Link>
        ))}
      </div>
      <VoicePanel />
      <div className="grid md:grid-cols-2 gap-4">
        <section className="card-surface p-4">
          <h2 className="font-semibold mb-3">Needs your approval</h2>
          {pending.length === 0 ? <p className="text-sm text-muted-foreground">Nothing pending.</p> : pending.slice(0, 3).map((a) => (
            <Link key={a.id} to="/approvals" className="block py-2 border-t first:border-t-0 text-sm">
              {a.action} <Demo show={a.demo} /><div className="text-xs text-muted-foreground">{timeAgo(a.requested)}</div>
            </Link>
          ))}
        </section>
        <section className="card-surface p-4">
          <h2 className="font-semibold mb-3">Recent activity</h2>
          {s.log.slice(0, 4).map((l) => (
            <div key={l.id} className="py-2 border-t first:border-t-0 text-sm">
              {l.event} <Demo show={l.demo} /><div className="text-xs text-muted-foreground">{l.actor} · {timeAgo(l.at)}</div>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}

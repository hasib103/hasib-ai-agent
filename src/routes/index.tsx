import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Mic, MicOff, Volume2, Square } from "lucide-react";
import { useStore, timeAgo, Demo, PageHeader } from "@/lib/store";

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

type SpeechRecognitionResult = { 0: { transcript: string }; isFinal: boolean };
type SpeechRecognitionEvent = { results: ArrayLike<SpeechRecognitionResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

function VoicePanel() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("Tap the microphone and speak.");
  const [language, setLanguage] = useState("bn-BD");
  const [recognition, setRecognition] = useState<Recognition | null>(null);

  function toggleListening() {
    if (listening && recognition) {
      recognition.stop();
      setListening(false);
      return;
    }
    const speechWindow = window as SpeechWindow;
    const SpeechRecognitionApi = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognitionApi) {
      setStatus("Speech recognition is not supported in this browser. Try Chrome or use your keyboard microphone.");
      return;
    }
    const instance = new SpeechRecognitionApi();
    instance.lang = language;
    instance.continuous = false;
    instance.interimResults = true;
    instance.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript;
      setTranscript(text);
    };
    instance.onerror = () => {
      setStatus("Microphone recognition failed. Check browser microphone permission and try again.");
      setListening(false);
    };
    instance.onend = () => {
      setListening(false);
      setStatus("Speech captured. Copy the transcript into your AI chat to ask your question.");
    };
    setRecognition(instance);
    setStatus("Listening…");
    setListening(true);
    try { instance.start(); } catch {
      setListening(false);
      setStatus("Could not start the microphone. Please try again.");
    }
  }

  function speakTranscript() {
    if (!("speechSynthesis" in window)) {
      setStatus("Spoken playback is not supported in this browser.");
      return;
    }
    if (!transcript.trim()) {
      setStatus("Speak or enter text first, then tap Read aloud.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(transcript);
    utterance.lang = language;
    window.speechSynthesis.speak(utterance);
    setStatus("Reading the captured text aloud. AI-generated spoken answers require chat-response integration.");
  }

  return (
    <section className="card-surface p-4 mb-6" aria-labelledby="voice-mode-title">
      <div className="flex items-center gap-2 mb-2">
        <Volume2 className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 id="voice-mode-title" className="font-semibold">Voice mode · Preview</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-3">Speak a question, review the transcript, and listen to the captured text. Browser microphone permission is required.</p>
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <label className="text-sm" htmlFor="voice-language">Language</label>
        <select id="voice-language" className="border rounded-md bg-background px-3 py-2 text-sm" value={language} onChange={(event) => setLanguage(event.target.value)} disabled={listening}>
          <option value="bn-BD">বাংলা</option>
          <option value="en-US">English</option>
          <option value="hi-IN">हिन्दी</option>
          <option value="ar-SA">العربية</option>
        </select>
        <button type="button" onClick={toggleListening} className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium" aria-pressed={listening}>
          {listening ? <><MicOff className="h-4 w-4" /> Stop listening</> : <><Mic className="h-4 w-4" /> Start speaking</>}
        </button>
        <button type="button" onClick={speakTranscript} className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium">
          <Volume2 className="h-4 w-4" /> Read aloud
        </button>
        <button type="button" onClick={() => { window.speechSynthesis?.cancel(); setStatus("Playback stopped."); }} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <Square className="h-4 w-4" /> Stop audio
        </button>
      </div>
      <label className="block text-sm font-medium mb-1" htmlFor="voice-transcript">Recognized text</label>
      <textarea id="voice-transcript" className="w-full min-h-24 rounded-md border bg-background p-3 text-sm" value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Your speech transcript will appear here. You can edit it." />
      <p className="text-xs text-muted-foreground mt-2" role="status" aria-live="polite">{status}</p>
      <p className="text-xs text-muted-foreground mt-1">Preview limitation: this panel currently captures speech and reads text aloud; it does not yet submit the question to the AI or speak an AI-generated answer.</p>
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

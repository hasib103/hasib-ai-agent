import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { askAssistant } from "@/lib/assistant.functions";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/lib/store";

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "AI Assistant · Hasib AI Agent" },
      { name: "description", content: "Multilingual AI assistant for math, learning, language and general legal information." },
    ],
  }),
  component: AssistantPage,
});

type Message = { role: "user" | "assistant"; text: string };
type SpeechResult = { 0: { transcript: string }; isFinal: boolean };
type SpeechEvent = { resultIndex: number; results: ArrayLike<ArrayLike<SpeechResult>> };
type RecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const languages = [
  { value: "bn-BD", label: "বাংলা" },
  { value: "en-US", label: "English" },
  { value: "hi-IN", label: "हिन्दी" },
  { value: "ur-PK", label: "اردو" },
  { value: "ar-SA", label: "العربية" },
  { value: "es-ES", label: "Español" },
  { value: "fr-FR", label: "Français" },
  { value: "zh-CN", label: "中文" },
  { value: "pt-BR", label: "Português" },
  { value: "id-ID", label: "Bahasa Indonesia" },
  { value: "ja-JP", label: "日本語" },
  { value: "de-DE", label: "Deutsch" },
];

function AssistantPage() {
  const run = useServerFn(askAssistant);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "আসসালামু আলাইকুম! আমি Hasib AI। গণিত, পড়াশোনা, ভাষা এবং সাধারণ আইনবিষয়ক তথ্য নিয়ে প্রশ্ন করুন। চাইলে মাইক্রোফোনে কথা বলুন।" },
  ]);
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState("bn-BD");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef<RecognitionLike | null>(null);

  const send = async (text = input) => {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setMessages((current) => [...current, { role: "user", text: message }]);
    setBusy(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) throw new Error("AI ব্যবহার করতে আবার সাইন ইন করুন।");
      const result = await run({ data: { message, accessToken: sessionData.session.access_token, locale: language } });
      setMessages((current) => [...current, { role: "assistant", text: result.answer }]);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "উত্তর পাওয়া যায়নি। আবার চেষ্টা করুন।";
      setMessages((current) => [...current, { role: "assistant", text: "দুঃখিত, উত্তর দিতে সমস্যা হয়েছে: " + messageText }]);
    } finally {
      setBusy(false);
    }
  };

  const startListening = () => {
    setVoiceError("");
    const speechWindow = window as unknown as {
      SpeechRecognition?: new () => RecognitionLike;
      webkitSpeechRecognition?: new () => RecognitionLike;
    };
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("এই ব্রাউজারে speech recognition সমর্থিত নয়। Android-এ Chrome ব্যবহার করে আবার চেষ্টা করুন।");
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = language;
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").trim();
        if (transcript) setInput((current) => current ? current + " " + transcript : transcript);
      };
      recognition.onerror = (event) => {
        setVoiceError(event.error === "not-allowed" ? "মাইক্রোফোনের অনুমতি দিন।" : "কথা শোনা যায়নি। আবার চেষ্টা করুন।");
      };
      recognition.onend = () => setListening(false);
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
    } catch {
      setVoiceError("মাইক্রোফোন চালু করা যায়নি। ব্রাউজারের permission পরীক্ষা করুন।");
      setListening(false);
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) {
      setVoiceError("এই ডিভাইস বা ব্রাউজারে voice output সমর্থিত নয়।");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <>
      <PageHeader title="Hasib AI Assistant" sub="গণিত, বহু ভাষা, শেখা ও সাধারণ আইনবিষয়ক তথ্য—এক জায়গায়।" />
      <section className="card-surface p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-sm font-medium" htmlFor="assistant-language">ভাষা / Language</label>
          <select id="assistant-language" className="field max-w-52" value={language} onChange={(event) => setLanguage(event.target.value)}>
            {languages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={() => setInput("এই গণিত সমস্যাটি ধাপে ধাপে সমাধান করো: ")} type="button">🧮 গণিত</button>
          <button className="btn btn-ghost" onClick={() => setInput("বাংলাদেশের প্রযোজ্য আইন ও নির্ভরযোগ্য সূত্র উল্লেখ করে এই বিষয়ে সাধারণ তথ্য দাও: ")} type="button">⚖️ আইন</button>
          <button className="btn btn-ghost" onClick={() => setInput("এই বাক্যটি অনুবাদ করো এবং ব্যাখ্যা করো: ")} type="button">🌍 অনুবাদ</button>
        </div>
        <div className="space-y-3 max-h-[48dvh] overflow-y-auto rounded-lg border p-3" aria-live="polite">
          {messages.map((message, index) => (
            <div key={index} className={message.role === "user" ? "ml-4 sm:ml-10 rounded-lg bg-primary/10 p-3" : "mr-2 sm:mr-8 rounded-lg bg-secondary p-3"}>
              <div className="text-xs text-muted-foreground mb-1">{message.role === "user" ? "আপনি" : "Hasib AI"}</div>
              <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
              {message.role === "assistant" && index > 0 && <button className="btn btn-ghost mt-2" type="button" onClick={() => speak(message.text)}>🔊 উত্তর শুনুন</button>}
            </div>
          ))}
          {busy && <p className="text-sm text-muted-foreground animate-pulse">Hasib AI উত্তর তৈরি করছে…</p>}
        </div>
        <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void send(); }}>
          <label className="sr-only" htmlFor="assistant-message">আপনার প্রশ্ন</label>
          <textarea id="assistant-message" className="field min-h-24" maxLength={4000} value={input} onChange={(event) => setInput(event.target.value)} placeholder="আপনার প্রশ্ন লিখুন বা মাইক্রোফোনে কথা বলুন…" />
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()}>{busy ? "উত্তর তৈরি হচ্ছে…" : "প্রশ্ন পাঠান ↑"}</button>
            {!listening
              ? <button className="btn btn-ghost" type="button" onClick={startListening}>🎙️ কথা বলুন</button>
              : <button className="btn btn-danger" type="button" onClick={stopListening}>■ শোনা বন্ধ করুন</button>}
            <button className="btn btn-ghost" type="button" onClick={() => { window.speechSynthesis?.cancel(); }}>🔇 ভয়েস বন্ধ</button>
          </div>
          {voiceError && <p role="status" className="text-sm text-destructive">{voiceError}</p>}
        </form>
      </section>
      <p className="text-xs text-muted-foreground mt-3">আইনবিষয়ক উত্তর সাধারণ তথ্য, আইনজীবীর বিকল্প নয়। ভয়েসের সুবিধা ব্রাউজার, ডিভাইস ও নির্বাচিত ভাষার সমর্থনের ওপর নির্ভর করে। গুরুত্বপূর্ণ গণিত ও আইনি তথ্য যাচাই করে নিন।</p>
    </>
  );
}

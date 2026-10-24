import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowRight, Download, Pencil, Save, Sparkles, Trash2, UserRoundCog } from "lucide-react";
import { PageHeader } from "@/lib/store";
import { askVoiceAssistant } from "@/lib/voice-chat.functions";
import { supabase } from "@/lib/supabase";
import {
  ACTIVE_CUSTOM_ASSISTANT_KEY,
  ASSISTANT_CATEGORIES,
  MAX_CUSTOM_ASSISTANTS,
  loadCustomAssistants,
  parseCustomAssistants,
  saveCustomAssistants,
  type AssistantCategory,
  type CustomAssistant,
} from "@/lib/custom-assistants";

export const Route = createFileRoute("/assistant-builder")({
  head: () => ({
    meta: [
      { title: "নিজের AI সহকারী তৈরি করুন · Hasib AI Agent" },
      { name: "description", content: "Create and personalize a Hasib AI assistant for your own tasks." },
    ],
  }),
  component: AssistantBuilder,
});

type Draft = Omit<CustomAssistant, "id" | "createdAt" | "updatedAt">;

const blankDraft: Draft = {
  name: "",
  category: "Personal",
  goal: "",
  instructions: "",
  tone: "সহজ, বন্ধুসুলভ ও স্পষ্ট",
  responseFormat: "প্রথমে সরাসরি উত্তর, তারপর প্রয়োজনীয় ধাপ",
  boundaries: "অনিশ্চিত তথ্য স্পষ্ট করবে; ব্যক্তিগত তথ্য সুরক্ষিত রাখবে; বাইরের কোনো গুরুত্বপূর্ণ কাজের আগে অনুমতি চাইবে।",
};

const presets: Array<{ category: AssistantCategory; title: string; goal: string; instructions: string; tone: string; responseFormat: string }> = [
  {
    category: "Study",
    title: "পড়াশোনার শিক্ষক",
    goal: "বিষয় বুঝতে, অনুশীলন করতে এবং পরীক্ষার প্রস্তুতি নিতে সাহায্য করা।",
    instructions: "কঠিন ধারণা সহজ ধাপে বোঝাও। ছোট উদাহরণ দাও, ভুল ধারণা ধরিয়ে দাও, প্রয়োজনে অনুশীলনী ও উত্তরসহ ব্যাখ্যা দাও। শুধু উত্তর না দিয়ে শেখার পদ্ধতিও বোঝাও।",
    tone: "ধৈর্যশীল, উৎসাহদায়ক ও সহজ",
    responseFormat: "ধাপে ধাপে ব্যাখ্যা, উদাহরণ, শেষে ছোট সারাংশ",
  },
  {
    category: "Business",
    title: "ব্যবসা সহকারী",
    goal: "ব্যবসার পরিকল্পনা, গ্রাহকসেবা, বিপণন ও খরচের সিদ্ধান্তে ব্যবহারিক সাহায্য করা।",
    instructions: "পরামর্শকে বাস্তব পদক্ষেপে ভাগ করো। গ্রাহকের প্রয়োজন, খরচ, ঝুঁকি, ফলাফল মাপার উপায় এবং কম খরচের বিকল্প বিবেচনা করো। তথ্য না থাকলে অনুমানকে তথ্য হিসেবে দেখাবে না।",
    tone: "পেশাদার, বাস্তবমুখী ও সংক্ষিপ্ত",
    responseFormat: "প্রস্তাব, করণীয় ধাপ, খরচ/ঝুঁকি ও সাফল্যের মাপকাঠি",
  },
  {
    category: "Coding",
    title: "কোডিং সহকারী",
    goal: "কোড বুঝতে, ত্রুটি খুঁজতে, সফটওয়্যার তৈরি ও নিরাপদভাবে পরীক্ষা করতে সাহায্য করা।",
    instructions: "সমস্যার মূল কারণ ও প্রমাণ আলাদা করো। বিদ্যমান কোডের ধরন মেনে ছোট নিরাপদ পরিবর্তন প্রস্তাব করো। নিরাপত্তা, প্রান্তিক অবস্থা ও পরীক্ষা উল্লেখ করো। বাস্তবে চালানো হয়নি এমন পরীক্ষা চালানো হয়েছে বলবে না।",
    tone: "কারিগরি, নির্ভুল ও সরাসরি",
    responseFormat: "কারণ, সমাধান, কোড/উদাহরণ, পরীক্ষা ও অবশিষ্ট ঝুঁকি",
  },
  {
    category: "Research",
    title: "গবেষণা সহকারী",
    goal: "বিশ্বস্ত উৎস ব্যবহার করে প্রশ্নের উত্তর, তুলনা ও সিদ্ধান্ত প্রস্তুত করা।",
    instructions: "সম্ভব হলে প্রাথমিক ও নির্ভরযোগ্য উৎসকে অগ্রাধিকার দাও। গুরুত্বপূর্ণ দাবির উৎস ও তারিখ দাও, মতভেদ এবং অনিশ্চয়তা জানাও, প্রমাণ ছাড়াই তথ্য বা সূত্র তৈরি করো না।",
    tone: "নিরপেক্ষ, বিশ্লেষণধর্মী ও সতর্ক",
    responseFormat: "মূল ফলাফল, প্রমাণ, বিকল্পের তুলনা, সীমাবদ্ধতা ও সিদ্ধান্ত",
  },
  {
    category: "Writing",
    title: "লেখালেখি সহকারী",
    goal: "পোস্ট, ইমেইল, প্রতিবেদন, গল্প ও অন্যান্য লেখাকে লক্ষ্য অনুযায়ী তৈরি বা উন্নত করা।",
    instructions: "লক্ষ্য পাঠক, উদ্দেশ্য ও কাঙ্ক্ষিত স্বর অনুসরণ করো। অর্থ ও যাচাইযোগ্য তথ্য বজায় রাখো, অপ্রয়োজনীয় পুনরাবৃত্তি কমাও এবং অস্পষ্ট তথ্য নিজের মতো বানিয়ে পূরণ করো না।",
    tone: "স্বাভাবিক, আকর্ষণীয় ও পাঠক-উপযোগী",
    responseFormat: "ব্যবহারের জন্য প্রস্তুত সম্পূর্ণ খসড়া; প্রয়োজন হলে বিকল্প শিরোনাম",
  },
];

function AssistantBuilder() {
  const navigate = useNavigate({ from: "/assistant-builder" });
  const runAssistant = useServerFn(askVoiceAssistant);
  const [assistants, setAssistants] = useState<CustomAssistant[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [needCommand, setNeedCommand] = useState("");
  const [designing, setDesigning] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAssistants(loadCustomAssistants());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!saveCustomAssistants(assistants)) {
      setNotice("এই ব্রাউজারে সংরক্ষণ করা যাচ্ছে না। প্রয়োজন হলে সহকারীর সেটিংস রপ্তানি করে রাখুন।");
    }
  }, [assistants, hydrated]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function usePreset(preset: (typeof presets)[number]) {
    setDraft((current) => ({
      ...current,
      name: current.name.trim() ? current.name : preset.title,
      category: preset.category,
      goal: preset.goal,
      instructions: preset.instructions,
      tone: preset.tone,
      responseFormat: preset.responseFormat,
    }));
    setNotice("নমুনা নির্দেশনা যোগ হয়েছে। নিজের প্রয়োজনমতো বদলে সংরক্ষণ করুন।");
    setError("");
  }

  async function designWithAI() {
    const request = needCommand.trim();
    if (!request || designing) return;
    setDesigning(true);
    setError("");
    setNotice("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        throw new Error("এই সুবিধা ব্যবহার করতে অ্যাকাউন্টে আবার সাইন ইন করুন।");
      }
      const answer = await runAssistant({
        data: {
          message:
            "Create a draft custom assistant profile for Hasib AI Agent based on the user's need below. Return valid JSON only, with no Markdown fences or commentary. Include exactly these string fields: name, category, goal, instructions, tone, responseFormat, boundaries. category must be one of Study, Business, Coding, Research, Writing, Personal, Other. Respect these limits: name 60 chars, goal 500, instructions 3000, tone 120, responseFormat 300, boundaries 1200. Use Bengali unless another language is clearly requested. Do not add external account access, tools, permissions, or promises of autonomous external actions. These are user-level task/style preferences only, and the user will review the draft before saving. If details are missing, make conservative useful assumptions without inventing personal facts.\n\nUser need:\n" +
            request,
          history: [],
          language: "bn-BD",
          profile: "general",
          customInstructions: "",
          accessToken,
        },
      });
      const start = answer.indexOf("{");
      const end = answer.lastIndexOf("}");
      if (start < 0 || end <= start) {
        throw new Error("AI থেকে কাঠামোবদ্ধ খসড়া পাওয়া যায়নি। প্রয়োজনটি আরেকটু নির্দিষ্ট করে চেষ্টা করুন।");
      }
      const decoded: unknown = JSON.parse(answer.slice(start, end + 1));
      if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
        throw new Error("AI-এর খসড়ার ধরন সঠিক নয়। আবার চেষ্টা করুন।");
      }
      const row = decoded as Record<string, unknown>;
      const read = (key: string, limit: number, fallback = ""): string =>
        typeof row[key] === "string" ? (row[key] as string).trim().slice(0, limit) : fallback;
      const category = ASSISTANT_CATEGORIES.includes(row.category as AssistantCategory)
        ? row.category as AssistantCategory
        : "Personal";
      const nextDraft: Draft = {
        name: read("name", 60),
        category,
        goal: read("goal", 500),
        instructions: read("instructions", 3000),
        tone: read("tone", 120, blankDraft.tone),
        responseFormat: read("responseFormat", 300, blankDraft.responseFormat),
        boundaries: read("boundaries", 1200, blankDraft.boundaries),
      };
      if (!nextDraft.name || !nextDraft.goal || !nextDraft.instructions) {
        throw new Error("AI-এর খসড়ায় প্রয়োজনীয় তথ্য অসম্পূর্ণ। প্রয়োজনটি আরেকটু স্পষ্ট করে চেষ্টা করুন।");
      }
      setDraft(nextDraft);
      setEditingId(null);
      setNotice("AI আপনার বর্ণনা থেকে একটি খসড়া তৈরি করেছে। নিচের সব নির্দেশনা যাচাই ও প্রয়োজনমতো সম্পাদনা করে তবেই সংরক্ষণ করুন।");
      document.getElementById("assistant-builder-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setError(error instanceof Error ? error.message : "সহকারীর খসড়া তৈরি করা যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setDesigning(false);
    }
  }

  function resetForm() {
    setDraft(blankDraft);
    setEditingId(null);
    setError("");
  }

  function saveAssistant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean: Draft = {
      name: draft.name.trim(),
      category: draft.category,
      goal: draft.goal.trim(),
      instructions: draft.instructions.trim(),
      tone: draft.tone.trim(),
      responseFormat: draft.responseFormat.trim(),
      boundaries: draft.boundaries.trim(),
    };
    if (!clean.name || !clean.goal || !clean.instructions) {
      setError("নাম, মূল লক্ষ্য এবং কাজের নির্দেশনা পূরণ করুন।");
      return;
    }
    if (clean.instructions.length > 3000 || clean.goal.length > 500 || clean.boundaries.length > 1200) {
      setError("কোনো নির্দেশনা নির্ধারিত দৈর্ঘ্যের চেয়ে বড় হয়েছে। একটু সংক্ষিপ্ত করুন।");
      return;
    }
    const existing = editingId ? assistants.find((item) => item.id === editingId) : undefined;
    if (!existing && assistants.length >= MAX_CUSTOM_ASSISTANTS) {
      setError("সর্বোচ্চ ১২টি কাস্টম সহকারী রাখা যাবে। নতুনটি যোগ করতে একটি মুছে দিন।");
      return;
    }
    const now = new Date().toISOString();
    const saved: CustomAssistant = {
      ...clean,
      id: existing?.id ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "assistant-" + Date.now()),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    setAssistants((current) => existing
      ? current.map((item) => item.id === existing.id ? saved : item)
      : [saved, ...current].slice(0, MAX_CUSTOM_ASSISTANTS));
    setNotice(editingId ? "সহকারীর সেটিংস আপডেট হয়েছে।" : "আপনার কাস্টম সহকারী সংরক্ষিত হয়েছে।");
    resetForm();
  }

  function editAssistant(assistant: CustomAssistant) {
    const { id, createdAt, updatedAt, ...values } = assistant;
    void createdAt;
    void updatedAt;
    setDraft(values);
    setEditingId(id);
    setError("");
    setNotice("এখন সহকারীর সেটিংস সম্পাদনা করছেন।");
    document.getElementById("assistant-builder-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function importAssistants(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (file.size > 1_000_000) {
      setError("JSON ফাইলটি ১ এমবির চেয়ে ছোট হতে হবে।");
      return;
    }
    let imported: CustomAssistant[];
    try {
      const decoded: unknown = JSON.parse(await file.text());
      imported = parseCustomAssistants(Array.isArray(decoded) ? decoded : [decoded]);
    } catch {
      setError("এই ফাইলটি পড়া যাচ্ছে না। Hasib AI Assistant-এর রপ্তানি করা JSON ফাইল নির্বাচন করুন।");
      return;
    }
    if (imported.length === 0) {
      setError("ফাইলে বৈধ সহকারী-প্রোফাইল পাওয়া যায়নি।");
      return;
    }
    const available = MAX_CUSTOM_ASSISTANTS - assistants.length;
    if (available <= 0) {
      setError("সর্বোচ্চ ১২টি সহকারী রাখা যাবে। আমদানির আগে একটি মুছে দিন।");
      return;
    }
    const now = new Date().toISOString();
    const existingIds = new Set(assistants.map((item) => item.id));
    const toAdd = imported.slice(0, available).map((item) => {
      let id = item.id;
      if (existingIds.has(id)) {
        id = typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : "assistant-import-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      }
      existingIds.add(id);
      return { ...item, id, createdAt: now, updatedAt: now };
    });
    setAssistants((current) => [...current, ...toAdd].slice(0, MAX_CUSTOM_ASSISTANTS));
    setError("");
    setNotice(toAdd.length + "টি সহকারী আমদানি করা হয়েছে।" + (toAdd.length < imported.length ? " সর্বোচ্চ সীমার কারণে কিছু প্রোফাইল বাদ গেছে।" : ""));
  }

  function activateAssistant(assistant: CustomAssistant) {
    try {
      window.localStorage.setItem(ACTIVE_CUSTOM_ASSISTANT_KEY, assistant.id);
    } catch {
      setError("এই ব্রাউজারে সক্রিয় সহকারী সংরক্ষণ করা যায়নি। ব্রাউজার স্টোরেজ চালু করুন।");
      return;
    }
    void navigate({ to: "/" });
  }

  function deleteAssistant(assistant: CustomAssistant) {
    setAssistants((current) => current.filter((item) => item.id !== assistant.id));
    try {
      if (window.localStorage.getItem(ACTIVE_CUSTOM_ASSISTANT_KEY) === assistant.id) {
        window.localStorage.removeItem(ACTIVE_CUSTOM_ASSISTANT_KEY);
      }
    } catch {
      // The profile list remains usable if browser storage is disabled.
    }
    if (editingId === assistant.id) resetForm();
    setNotice("কাস্টম সহকারী মুছে ফেলা হয়েছে।");
  }

  function exportAssistant(assistant: CustomAssistant) {
    try {
      const blob = new Blob([JSON.stringify(assistant, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "hasib-assistant-" + assistant.id.slice(0, 40).replace(/[^a-zA-Z0-9-]/g, "-") + ".json";
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice("সহকারীর সেটিংস JSON ফাইল হিসেবে রপ্তানি করা হয়েছে।");
    } catch {
      setError("সেটিংস রপ্তানি করা যায়নি। আবার চেষ্টা করুন।");
    }
  }

  return (
    <>
      <PageHeader
        title="নিজের AI সহকারী তৈরি করুন"
        sub="আপনার প্রয়োজন, কাজের ধরন ও পছন্দ অনুযায়ী Hasib AI Agent-কে সাজান—একবার তৈরি করে মূল চ্যাটে বারবার ব্যবহার করুন।"
      />

      <section className="card-surface mb-5 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary"><UserRoundCog className="h-6 w-6" aria-hidden="true" /></div>
          <div className="min-w-0">
            <h2 className="font-semibold">আপনার কাজ, আপনার নির্দেশনা</h2>
            <p className="mt-1 text-sm text-muted-foreground">যে কাজগুলোতে সাহায্য চান, সহকারীর লক্ষ্য, নির্দেশনা, কথার ধরন এবং সীমাবদ্ধতা লিখুন। সক্রিয় করলে পরের চ্যাটে এই পছন্দগুলো AI-কে পাঠানো হবে।</p>
            <p className="mt-2 text-xs text-muted-foreground">গুরুত্বপূর্ণ: এই সংস্করণে প্রোফাইল এই ব্রাউজারেই সংরক্ষিত থাকে এবং ডিভাইসের মধ্যে নিজে থেকে সিঙ্ক হয় না। এটি AI মডেলকে আলাদাভাবে প্রশিক্ষণ দেয় না বা নতুন অ্যাকাউন্ট/টুলের অনুমতি দেয় না। নিজের ডিভাইস হলে তবেই ব্যক্তিগত নির্দেশনা রাখুন।</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button key={preset.category} type="button" className="btn btn-ghost border" onClick={() => usePreset(preset)}>
              <Sparkles className="mr-1.5 inline h-4 w-4" aria-hidden="true" />{preset.title}
            </button>
          ))}
        </div>
        <div className="mt-5 space-y-3 border-t pt-4">
          <h3 className="font-semibold">শুধু আপনার প্রয়োজনটি লিখুন</h3>
          <p className="text-sm text-muted-foreground">নিজের ভাষায় বলুন কী কাজ করাতে চান। AI নাম, লক্ষ্য ও নির্দেশনার একটি খসড়া সাজিয়ে দেবে—সেটি যাচাই করে তারপর সংরক্ষণ করবেন।</p>
          <textarea
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={needCommand}
            onChange={(event) => setNeedCommand(event.target.value)}
            maxLength={1500}
            placeholder="যেমন: আমি অনলাইনে পোশাক বিক্রি করি। গ্রাহকের প্রশ্নের উত্তর, পণ্যের বর্ণনা, বিক্রির পোস্ট এবং সাপ্তাহিক কনটেন্ট পরিকল্পনায় আমাকে সাহায্য করো।"
            aria-label="আপনার প্রয়োজনের বর্ণনা"
            disabled={designing}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary" onClick={() => void designWithAI()} disabled={designing || !needCommand.trim()}>
              <Sparkles className="mr-1.5 inline h-4 w-4" aria-hidden="true" />{designing ? "খসড়া তৈরি হচ্ছে…" : "AI দিয়ে সহকারী সাজান"}
            </button>
            <span className="text-xs text-muted-foreground">AI ব্যবহারে স্বাভাবিক অ্যাকাউন্ট কোটা প্রযোজ্য। খসড়া স্বয়ংক্রিয়ভাবে সংরক্ষণ বা সক্রিয় হবে না।</span>
          </div>
        </div>
      </section>

      <form id="assistant-builder-form" className="card-surface mb-5 space-y-4 p-4 sm:p-5" onSubmit={saveAssistant}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">{editingId ? "সহকারী সম্পাদনা করুন" : "নতুন সহকারী তৈরি করুন"}</h2>
          {editingId && <button type="button" className="btn btn-ghost" onClick={resetForm}>নতুন ফর্ম</button>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">সহকারীর নাম
            <input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" value={draft.name} onChange={(event) => update("name", event.target.value)} maxLength={60} required placeholder="যেমন: আমার ব্যবসার সহকারী" />
          </label>
          <label className="block text-sm font-medium">কাজের ধরন
            <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" value={draft.category} onChange={(event) => update("category", event.target.value as AssistantCategory)}>
              {ASSISTANT_CATEGORIES.map((category) => <option key={category} value={category}>{({ Study: "পড়াশোনা", Business: "ব্যবসা", Coding: "কোডিং", Research: "গবেষণা", Writing: "লেখালেখি", Personal: "ব্যক্তিগত কাজ", Other: "অন্যান্য" })[category]}</option>)}
            </select>
          </label>
        </div>

        <label className="block text-sm font-medium">মূল লক্ষ্য
          <textarea className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2" value={draft.goal} onChange={(event) => update("goal", event.target.value)} maxLength={500} required placeholder="এই সহকারী আমাকে কোন সমস্যাগুলো সমাধান করতে সাহায্য করবে?" />
        </label>

        <label className="block text-sm font-medium">কাজের বিস্তারিত নির্দেশনা
          <textarea className="mt-1 min-h-36 w-full rounded-md border border-input bg-background px-3 py-2" value={draft.instructions} onChange={(event) => update("instructions", event.target.value)} maxLength={3000} required placeholder="যেমন: আমি কোনো পণ্য দিলে বৈশিষ্ট্য, উপকারিতা, সম্ভাব্য গ্রাহক, দাম নির্ধারণের বিষয় ও প্রচারের উপায় সাজিয়ে দেবে..." />
          <span className="mt-1 block text-xs text-muted-foreground">{draft.instructions.length}/3000 অক্ষর · কীভাবে কাজ করবে, কী ফল দেবে ও কোন ধাপ মানবে তা লিখুন।</span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">কথার ধরন
            <input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" value={draft.tone} onChange={(event) => update("tone", event.target.value)} maxLength={120} placeholder="বন্ধুসুলভ, পেশাদার, সংক্ষিপ্ত..." />
          </label>
          <label className="block text-sm font-medium">উত্তরের কাঠামো
            <input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" value={draft.responseFormat} onChange={(event) => update("responseFormat", event.target.value)} maxLength={300} placeholder="প্রথমে সারাংশ, তারপর ধাপ ও উদাহরণ..." />
          </label>
        </div>

        <label className="block text-sm font-medium">সীমাবদ্ধতা ও সতর্কতা
          <textarea className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2" value={draft.boundaries} onChange={(event) => update("boundaries", event.target.value)} maxLength={1200} placeholder="কী করবে না, কোন বিষয়ে সতর্ক থাকবে, কখন অনুমতি চাইবে..." />
        </label>

        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary"><Save className="mr-1.5 inline h-4 w-4" aria-hidden="true" />{editingId ? "পরিবর্তন সংরক্ষণ" : "সহকারী সংরক্ষণ"}</button>
          <button type="button" className="btn btn-ghost border" onClick={resetForm}>ফর্ম পরিষ্কার</button>
        </div>
      </form>

      {notice && <div className="mb-4 rounded-md border border-input p-3 text-sm" role="status" aria-live="polite">{notice}</div>}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">আপনার সহকারীরা</h2>
          <p className="text-sm text-muted-foreground">{assistants.length} / {MAX_CUSTOM_ASSISTANTS}টি সংরক্ষিত</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={importInputRef} type="file" accept=".json,application/json" className="hidden" onChange={(event) => void importAssistants(event)} aria-label="JSON ফাইল থেকে সহকারী আমদানি" />
          <button type="button" className="btn btn-ghost border" onClick={() => importInputRef.current?.click()}>JSON আমদানি</button>
        </div>
      </div>

      {assistants.length === 0 ? (
        <div className="card-surface p-8 text-center">
          <UserRoundCog className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium">এখনো কোনো কাস্টম সহকারী তৈরি হয়নি</p>
          <p className="mt-1 text-sm text-muted-foreground">উপরের নমুনা থেকে শুরু করুন অথবা নিজের নির্দেশনা লিখে প্রথম সহকারী তৈরি করুন।</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {assistants.map((assistant) => (
            <article key={assistant.id} className="card-surface flex min-w-0 flex-col p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold break-words">{assistant.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{({ Study: "পড়াশোনা", Business: "ব্যবসা", Coding: "কোডিং", Research: "গবেষণা", Writing: "লেখালেখি", Personal: "ব্যক্তিগত কাজ", Other: "অন্যান্য" })[assistant.category]}</p>
                </div>
                <Sparkles className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              </div>
              <p className="mt-3 text-sm">{assistant.goal}</p>
              <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">{assistant.instructions}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <button type="button" className="btn btn-primary flex-1" onClick={() => activateAssistant(assistant)}>এই সহকারী দিয়ে চ্যাট শুরু <ArrowRight className="ml-1 inline h-4 w-4" aria-hidden="true" /></button>
                <button type="button" className="btn btn-ghost border" onClick={() => editAssistant(assistant)} aria-label={assistant.name + " সম্পাদনা"}><Pencil className="h-4 w-4" aria-hidden="true" /></button>
                <button type="button" className="btn btn-ghost border" onClick={() => exportAssistant(assistant)} aria-label={assistant.name + " রপ্তানি"}><Download className="h-4 w-4" aria-hidden="true" /></button>
                <button type="button" className="btn btn-ghost border" onClick={() => deleteAssistant(assistant)} aria-label={assistant.name + " মুছুন"}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

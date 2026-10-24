import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { BookOpen, CheckCircle2, Copy, GraduationCap, LoaderCircle, PlayCircle, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { PageHeader } from "@/lib/store";
import { askVoiceAssistant } from "@/lib/voice-chat.functions";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/cybersecurity-lab")({
  head: () => ({
    meta: [
      { title: "Cybersecurity Lab · Hasib AI Agent" },
      { name: "description", content: "Learn Linux, Kali Linux, networking, defensive security, web security and ethical penetration testing in authorized labs." },
    ],
  }),
  component: CybersecurityLab,
});

const STORAGE_KEY = "hasib-ai-agent.cybersecurity-lab.v1";
const tracks = [
  "Linux fundamentals and terminal",
  "Kali Linux setup and safe lab",
  "Networking, TCP/IP, DNS and HTTP",
  "Python and Bash for security automation",
  "Web security and OWASP Top 10",
  "Ethical penetration testing methodology",
  "Reconnaissance and asset inventory (authorized scope only)",
  "Vulnerability assessment and remediation",
  "Wireshark and network traffic analysis",
  "Burp Suite in a local practice app",
  "CTF and intentionally vulnerable labs",
  "Digital forensics and incident response",
  "Cryptography and identity fundamentals",
  "Cloud and container security",
  "Security reporting, ethics and career preparation",
] as const;

type Level = "beginner" | "some" | "experienced";
type Mode = "plan" | "learn" | "help";
type Course = { track: string; level: Level; goal: string; minutes: number; plan: string; completedLessons: number; createdAt: number };

const levelLabels: Record<Level, string> = {
  beginner: "একদম নতুন",
  some: "কিছুটা জানি",
  experienced: "আগে থেকেই কিছু জানি",
};

function CybersecurityLab() {
  const runAssistant = useServerFn(askVoiceAssistant);
  const [mode, setMode] = useState<Mode>("plan");
  const [track, setTrack] = useState<string>(tracks[0]);
  const [level, setLevel] = useState<Level>("beginner");
  const [goal, setGoal] = useState("Linux ও Kali Linux-এর ভিত্তি শিখে নিরাপদ, অনুমোদিত ল্যাবে ethical hacking অনুশীলন করতে চাই");
  const [minutes, setMinutes] = useState(30);
  const [course, setCourse] = useState<Course | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [answer, setAnswer] = useState("");
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const item = JSON.parse(saved) as Partial<Course>;
        if (typeof item.track === "string" && typeof item.plan === "string" && typeof item.goal === "string" &&
            typeof item.completedLessons === "number" && typeof item.minutes === "number" &&
            typeof item.createdAt === "number" && ["beginner", "some", "experienced"].includes(String(item.level))) {
          setCourse(item as Course);
          setTrack(item.track);
          setLevel(item.level as Level);
          setGoal(item.goal);
          setMinutes(item.minutes);
        }
      }
    } catch {
      setNotice("আগের অগ্রগতি পড়া যায়নি; নতুন পরিকল্পনা তৈরি করতে পারবেন।");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (course) localStorage.setItem(STORAGE_KEY, JSON.stringify(course));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      setNotice("এই ব্রাউজারে অগ্রগতি সংরক্ষণ করা যাচ্ছে না।");
    }
  }, [course, hydrated]);

  async function askAI(prompt: string): Promise<string> {
    const { data, error: sessionError } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (sessionError || !accessToken) throw new Error("এই ল্যাব ব্যবহার করতে আবার সাইন ইন করুন।");
    return runAssistant({ data: { message: prompt, history: [], language: "bn-BD", profile: "tutor", accessToken } });
  }

  const safetyContext = [
    "Teach ethical cybersecurity in clear Bengali. This is an education and defense lab.",
    "Only use systems the learner owns or has explicit written permission to test, isolated local virtual machines, intentionally vulnerable training apps, or CTF targets.",
    "Prioritize understanding, prevention, detection, safe verification and remediation. Explain commands before use, label any destructive or network-impacting action, and offer a harmless lab alternative.",
    "Do not provide instructions to compromise real third-party targets, steal credentials, deploy malware, persist covertly, evade detection, or exfiltrate data. If asked, briefly redirect to a legal lab and defensive explanation.",
    "Do not claim commands were executed or systems were tested. Use plain-text headings, numbered steps and readable code; avoid Markdown bold/italic markers.",
  ].join("\n");

  async function generatePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !goal.trim()) return;
    setBusy(true); setError(""); setAnswer(""); setNotice("");
    try {
      const prompt = [
        safetyContext,
        "Create a realistic beginner-friendly ethical cybersecurity learning roadmap with 6–9 stages.",
        "Track: " + track,
        "Experience: " + levelLabels[level],
        "Available time: " + minutes + " minutes per day",
        "Goal: " + goal.trim(),
        "For every stage include outcomes, concepts, a safe hands-on lab, required tools, a knowledge check, common mistakes, and defensive remediation. Include Linux shell basics, permissions, files/processes, networking and HTTP fundamentals where appropriate; introduce Kali only after fundamentals and use a VM or isolated lab. Explain setup options and resource requirements without assuming expensive hardware. Include a glossary, revision days, responsible disclosure and report-writing. Give the first lesson and a realistic milestone. Keep under 950 words.",
      ].join("\n\n");
      const plan = await askAI(prompt);
      setCourse({ track, level, goal: goal.trim(), minutes, plan, completedLessons: 0, createdAt: Date.now() });
      setMode("plan");
      setNotice("আপনার নিরাপদ সাইবারসিকিউরিটি শেখার পরিকল্পনা তৈরি ও এই ব্রাউজারে সংরক্ষিত হয়েছে।");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "পরিকল্পনা তৈরি করা যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  async function generateLesson() {
    if (busy) return;
    setBusy(true); setError(""); setAnswer(""); setNotice("");
    try {
      const lessonNo = (course?.completedLessons ?? 0) + 1;
      const prompt = [
        safetyContext,
        "Teach one small, practical ethical cybersecurity lesson in Bengali. Keep it achievable in " + Math.max(5, Math.min(minutes, 25)) + " minutes.",
        "Track: " + (course?.track ?? track) + "; level: " + levelLabels[course?.level ?? level] + "; goal: " + (course?.goal ?? goal),
        course ? "Roadmap context:\n" + course.plan.slice(0, 1800) : "No roadmap yet. Start with a safe foundational lesson and suggest a roadmap afterwards.",
        "Lesson number: " + lessonNo + ". Structure: title, objective, prerequisites, plain-language explanation, key terms, step-by-step safe lab, commands with each command explained, expected output (not claimed as executed), verification, defensive takeaways, one exercise and a 2-question quiz with answers at the end. Never direct exercises at public or unapproved systems. Prefer local VM, localhost, sample logs, or CTF. Keep under 700 words.",
      ].join("\n\n");
      setAnswer(await askAI(prompt));
      setMode("learn");
      setNotice("পাঠ তৈরি হয়েছে। অনুশীলনটি শুধু নিজের বা অনুমোদিত ল্যাবে করুন।");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "পাঠ তৈরি করা যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  async function getHelp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim() || busy) return;
    setBusy(true); setError(""); setAnswer(""); setNotice("");
    try {
      const prompt = [
        safetyContext,
        "Answer the learner's cybersecurity question in Bengali. Explain Linux/Kali commands before use, state prerequisites and expected effects, and distinguish safe lab practice from testing a real target. For vulnerability questions, include impact, safe validation in a lab, detection and remediation. If the question lacks scope, assume an isolated local lab or ask one focused question. Do not claim to execute commands or scan anything.",
        "Learner track: " + (course?.track ?? track) + "; level: " + levelLabels[course?.level ?? level],
        "Question:\n" + question.trim(),
        context.trim() ? "Command, log, error or lab context:\n" + context.trim() : "",
      ].filter(Boolean).join("\n\n");
      setAnswer(await askAI(prompt));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "সহায়তা পাওয়া যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  function completeLesson() {
    if (!course) return;
    setCourse({ ...course, completedLessons: course.completedLessons + 1 });
    setAnswer("");
    setNotice("দারুণ! পাঠ সম্পন্ন হিসেবে সংরক্ষিত হয়েছে। এবার পরের পাঠ তৈরি করুন।");
  }

  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(answer);
      setNotice("উত্তর কপি করা হয়েছে।");
    } catch {
      setNotice("কপি করা যায়নি—উত্তরটি নির্বাচন করে কপি করুন।");
    }
  }

  function resetCourse() {
    setCourse(null); setAnswer(""); setQuestion(""); setContext(""); setError("");
    setMode("plan"); setNotice("নতুন শেখার পরিকল্পনা শুরু করুন।");
  }

  return (
    <>
      <PageHeader title="Cybersecurity Learning Lab" sub="Linux, Kali Linux, networking, web security ও ethical hacking—ধাপে ধাপে, নিরাপদ ও অনুমোদিত ল্যাবে শিখুন।" />
      <section className="card-surface mb-4 space-y-3 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary"><ShieldCheck className="h-6 w-6" aria-hidden="true" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">নিরাপদ সাইবারসিকিউরিটি শিক্ষক</h2>
            <p className="mt-1 text-sm text-muted-foreground">ভিত্তি → গাইডেড ল্যাব → অনুশীলন → প্রতিরক্ষা ও প্রতিকার → রিপোর্ট লেখা। আপনার শেখার অগ্রগতি এই ব্রাউজারে সংরক্ষিত হয়; অন্য ডিভাইসে এখনো সিঙ্ক হয় না।</p>
          </div>
        </div>
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
          <p className="font-medium">অনুমোদিত পরিবেশে অনুশীলন করুন</p>
          <p className="mt-1 text-muted-foreground">নিজের কম্পিউটার/VM, localhost, CTF বা স্পষ্ট লিখিত অনুমতি থাকা সিস্টেম ব্যবহার করুন। এখানে কমান্ড চালানো বা নেটওয়ার্ক স্ক্যান করা হয় না—এটি শেখার ও ব্যাখ্যার সহকারী।</p>
        </div>
        {course && (
          <div className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{course.track} · {levelLabels[course.level]}</p>
              <span className="text-sm text-muted-foreground">{course.completedLessons} পাঠ সম্পন্ন</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={10} aria-valuenow={Math.min(course.completedLessons, 10)} aria-label="শেখার অগ্রগতি">
              <div className="h-full bg-primary transition-all" style={{ width: Math.min(100, course.completedLessons * 10) + "%" }} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">লক্ষ্য: {course.goal}</p>
          </div>
        )}
      </section>

      <section className="card-surface mb-4 p-4 sm:p-5">
        <h2 className="mb-3 font-semibold">যে বিষয়গুলো শেখা যাবে</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {tracks.map((item) => <div key={item} className="rounded-md border p-2.5 text-sm">{item}</div>)}
        </div>
      </section>

      <div className="mb-4 grid grid-cols-3 gap-2" role="tablist" aria-label="সাইবারসিকিউরিটি শেখার বিভাগ">
        <button type="button" role="tab" aria-selected={mode === "plan"} onClick={() => setMode("plan")} className={"rounded-lg border p-3 text-sm " + (mode === "plan" ? "border-primary bg-primary/10" : "hover:bg-secondary")}><BookOpen className="mx-auto mb-1 h-5 w-5" />পরিকল্পনা</button>
        <button type="button" role="tab" aria-selected={mode === "learn"} onClick={() => setMode("learn")} className={"rounded-lg border p-3 text-sm " + (mode === "learn" ? "border-primary bg-primary/10" : "hover:bg-secondary")}><PlayCircle className="mx-auto mb-1 h-5 w-5" />পাঠ শিখুন</button>
        <button type="button" role="tab" aria-selected={mode === "help"} onClick={() => setMode("help")} className={"rounded-lg border p-3 text-sm " + (mode === "help" ? "border-primary bg-primary/10" : "hover:bg-secondary")}><Sparkles className="mx-auto mb-1 h-5 w-5" />প্রশ্ন করুন</button>
      </div>

      {mode === "plan" && (
        <form className="card-surface space-y-4 p-4 sm:p-5" onSubmit={generatePlan}>
          <h2 className="font-semibold">আপনার শেখার পথ তৈরি করুন</h2>
          <div>
            <label htmlFor="cyber-track" className="mb-1.5 block text-sm font-medium">প্রথমে কোন বিষয়ে মনোযোগ দেবেন?</label>
            <select id="cyber-track" className="field" value={track} onChange={(event) => setTrack(event.target.value)}>
              {tracks.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">আপনার বর্তমান দক্ষতা</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["beginner", "some", "experienced"] as const).map((item) => <button key={item} type="button" aria-pressed={level === item} onClick={() => setLevel(item)} className={"rounded-md border p-3 text-sm " + (level === item ? "border-primary bg-primary/10" : "hover:bg-secondary")}>{levelLabels[item]}</button>)}
            </div>
          </fieldset>
          <div>
            <label htmlFor="cyber-time" className="mb-1.5 block text-sm font-medium">প্রতিদিন কত সময় দেবেন?</label>
            <select id="cyber-time" className="field" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))}>
              <option value={10}>১০ মিনিট</option><option value={20}>২০ মিনিট</option><option value={30}>৩০ মিনিট</option><option value={45}>৪৫ মিনিট</option><option value={60}>১ ঘণ্টা</option><option value={90}>দেড় ঘণ্টা</option>
            </select>
          </div>
          <div>
            <label htmlFor="cyber-goal" className="mb-1.5 block text-sm font-medium">আপনার লক্ষ্য</label>
            <textarea id="cyber-goal" className="field min-h-24" value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={500} required />
          </div>
          <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={busy || !goal.trim()}><Sparkles className="mr-2 inline h-4 w-4" />{busy ? "পরিকল্পনা তৈরি হচ্ছে…" : course ? "পরিকল্পনা আপডেট করুন" : "আমার পরিকল্পনা তৈরি করুন"}</button>
          {course && <button type="button" className="btn btn-ghost ml-2" onClick={resetCourse}><RotateCcw className="mr-1 inline h-4 w-4" />নতুন কোর্স</button>}
          {course && <div className="mt-4 border-t pt-4"><h3 className="mb-2 font-medium">বর্তমান পরিকল্পনা</h3><div className="whitespace-pre-wrap break-words text-sm leading-7">{course.plan}</div></div>}
        </form>
      )}

      {mode === "learn" && (
        <section className="card-surface space-y-4 p-4 sm:p-5">
          <div className="flex items-start gap-3"><GraduationCap className="mt-1 h-5 w-5 text-primary" /><div><h2 className="font-semibold">একবারে একটি ব্যবহারিক পাঠ</h2><p className="mt-1 text-sm text-muted-foreground">কমান্ডের ব্যাখ্যা, নিরাপদ অনুশীলন, প্রত্যাশিত ফল, প্রতিরক্ষামূলক শিক্ষা ও কুইজ পাবেন।</p></div></div>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void generateLesson()}>{busy ? <LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 inline h-4 w-4" />} {course ? "পরের পাঠ তৈরি করুন" : "প্রথম পরিচিতিমূলক পাঠ তৈরি করুন"}</button>
          {course && <button type="button" className="btn btn-ghost ml-2" onClick={completeLesson}><CheckCircle2 className="mr-1 inline h-4 w-4" />বর্তমান পাঠ সম্পন্ন</button>}
        </section>
      )}

      {mode === "help" && (
        <form className="card-surface space-y-4 p-4 sm:p-5" onSubmit={getHelp}>
          <h2 className="font-semibold">Linux, Kali বা সাইবারসিকিউরিটি নিয়ে প্রশ্ন করুন</h2>
          <div><label htmlFor="cyber-question" className="mb-1.5 block text-sm font-medium">আপনার প্রশ্ন</label><textarea id="cyber-question" className="field min-h-24" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1500} required placeholder="যেমন: Kali Linux ভার্চুয়াল মেশিনে কীভাবে নিরাপদে শুরু করব?" /></div>
          <div><label htmlFor="cyber-context" className="mb-1.5 block text-sm font-medium">কমান্ড, লগ, error বা ল্যাবের তথ্য (ঐচ্ছিক)</label><textarea id="cyber-context" className="field min-h-28 font-mono text-sm" value={context} onChange={(event) => setContext(event.target.value)} maxLength={1800} placeholder="কমান্ড বা error এখানে দিন…" /></div>
          <button type="submit" className="btn btn-primary" disabled={busy || !question.trim()}><Sparkles className="mr-2 inline h-4 w-4" />{busy ? "উত্তর তৈরি হচ্ছে…" : "ব্যাখ্যা করে দাও"}</button>
        </form>
      )}

      {error && <p className="mt-4 rounded-md border border-destructive/30 p-3 text-sm text-destructive" role="alert">{error}</p>}
      {answer && (
        <section className="card-surface mt-4 space-y-3 p-4 sm:p-5" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3"><h2 className="font-semibold">আপনার পাঠ / উত্তর</h2><button type="button" className="btn btn-ghost" onClick={() => void copyAnswer()}><Copy className="mr-1 inline h-4 w-4" />কপি</button></div>
          <div className="whitespace-pre-wrap break-words text-sm leading-7">{answer}</div>
          {mode === "learn" && course && <button type="button" className="btn btn-primary" onClick={completeLesson}><CheckCircle2 className="mr-1 inline h-4 w-4" />পাঠ সম্পন্ন হিসেবে চিহ্নিত করুন</button>}
        </section>
      )}
      {notice && <p className="mt-3 text-sm text-muted-foreground" role="status">{notice}</p>}
      <p className="mt-4 text-xs text-muted-foreground">নোট: এটি শেখার সহকারী—কমান্ড, স্ক্যান বা কোড বাস্তবে চালায় না। বাস্তব পরীক্ষা কেবল নিজের বা স্পষ্ট অনুমতিপ্রাপ্ত পরিবেশে করুন; ফলাফল আলাদা করে যাচাই করুন।</p>
    </>
  );
}

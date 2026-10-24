import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { BookOpen, CheckCircle2, Code2, Copy, GraduationCap, Lightbulb, LoaderCircle, PlayCircle, RotateCcw, Sparkles } from "lucide-react";
import { PageHeader } from "@/lib/store";
import { askVoiceAssistant } from "@/lib/voice-chat.functions";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/coding-coach")({
  head: () => ({
    meta: [
      { title: "Coding Coach · Hasib AI Agent" },
      { name: "description", content: "A personalized coding tutor with bite-sized lessons, learning plans, practice exercises, and debugging help." },
    ],
  }),
  component: CodingCoach,
});

const STORAGE_KEY = "hasib-ai-agent.coding-coach.v1";
const languages = [
  "Python", "JavaScript", "TypeScript", "HTML & CSS", "Java", "C", "C++", "C#", "Go", "Rust",
  "PHP", "Ruby", "Swift", "Kotlin", "Dart / Flutter", "SQL", "R", "MATLAB", "Bash / Shell",
  "Solidity", "Scratch", "Lua", "Perl", "Scala", "Haskell", "Other / help me choose",
] as const;
type Level = "beginner" | "some" | "experienced";
type Course = { language: string; level: Level; goal: string; minutes: number; plan: string; completedLessons: number; createdAt: number };
type Mode = "plan" | "learn" | "help";

const levelLabels: Record<Level, string> = {
  beginner: "একদম নতুন",
  some: "কিছুটা জানি",
  experienced: "আগে থেকেই কোড করি",
};

function CodingCoach() {
  const runAssistant = useServerFn(askVoiceAssistant);
  const [mode, setMode] = useState<Mode>("plan");
  const [language, setLanguage] = useState<string>("Python");
  const [level, setLevel] = useState<Level>("beginner");
  const [goal, setGoal] = useState("প্রোগ্রামিংয়ের ভিত্তি শিখে ছোট বাস্তব প্রজেক্ট তৈরি করতে চাই");
  const [minutes, setMinutes] = useState(20);
  const [course, setCourse] = useState<Course | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [answer, setAnswer] = useState("");
  const [question, setQuestion] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          const item = parsed as Partial<Course>;
          if (typeof item.language === "string" && typeof item.plan === "string" &&
              typeof item.goal === "string" && typeof item.completedLessons === "number" &&
              typeof item.minutes === "number" && typeof item.createdAt === "number" &&
              ["beginner", "some", "experienced"].includes(String(item.level))) {
            setCourse(item as Course);
            setLanguage(item.language);
            setLevel(item.level as Level);
            setGoal(item.goal);
            setMinutes(item.minutes);
          }
        }
      }
    } catch {
      setNotice("আগের শেখার অগ্রগতি পড়া যায়নি; নতুন পরিকল্পনা তৈরি করতে পারবেন।");
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
    if (sessionError || !accessToken) throw new Error("শেখার কাজ চালাতে আবার সাইন ইন করুন।");
    return runAssistant({
      data: {
        message: prompt,
        history: [],
        language: "bn-BD",
        profile: "tutor",
        accessToken,
      },
    });
  }

  async function generatePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !goal.trim()) return;
    setBusy(true); setError(""); setAnswer(""); setNotice("");
    try {
      const prompt = [
        "You are Coding Coach, a patient practical programming teacher inside Hasib AI Agent.",
        "Create a personalized, realistic learning roadmap for the requested programming language. Reply in clear Bengali. Do not use Markdown bold/italic markers. Use plain text headings, numbered steps and simple line breaks.",
        "Language: " + language,
        "Current experience: " + levelLabels[level],
        "Daily time budget: " + minutes + " minutes",
        "Learner goal: " + goal.trim(),
        "Make a clear beginner-friendly plan with 5 to 8 ordered stages. For each stage give: learning outcome, small concepts, a tiny hands-on project or exercise, and a simple completion check. Include setup/tools, practice and debugging habits, common mistakes, revision days and a realistic milestone. Adjust the plan to the time budget and goal; do not promise unrealistic fluency dates. Start with the first useful step and explain jargon in plain language. Keep the response under about 850 words.",
        "This plan will be used as the learner's ongoing course. At the end include a short 'First lesson' suggestion.",
      ].join("\n\n");
      const plan = await askAI(prompt);
      const next: Course = { language, level, goal: goal.trim(), minutes, plan, completedLessons: 0, createdAt: Date.now() };
      setCourse(next);
      setMode("learn");
      setAnswer("");
      setNotice("আপনার শেখার পরিকল্পনা তৈরি ও এই ব্রাউজারে সংরক্ষণ করা হয়েছে।");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "পরিকল্পনা তৈরি করা যায়নি। আবার চেষ্টা করুন।");
    } finally { setBusy(false); }
  }

  async function generateLesson() {
    if (!course || busy) return;
    setBusy(true); setError(""); setAnswer(""); setNotice("");
    const lessonNumber = course.completedLessons + 1;
    try {
      const prompt = [
        "You are Coding Coach, a friendly expert tutor. Teach exactly one small, practical lesson in Bengali.",
        "Language: " + course.language + ". Learner level: " + levelLabels[course.level] + ". Goal: " + course.goal + ". Daily time budget: " + course.minutes + " minutes.",
        "Learning roadmap for context:\n" + course.plan.slice(0, 1800),
        "The learner has completed " + course.completedLessons + " lessons. Prepare lesson number " + lessonNumber + ". Make this lesson achievable in " + Math.max(5, Math.min(course.minutes, 25)) + " minutes.",
        "Structure: lesson title; one clear objective; explain at most 2 or 3 small ideas in plain language; a tiny example with readable code; explain the code line by line; one guided exercise; one independent mini-challenge; expected result or test; 2-question quick quiz with answers at the very end. For the first lesson, cover setup only if needed and keep the first code example runnable in the usual environment for this language.",
        "Avoid assuming that code was executed. State the expected output and reason it out. Do not overload the learner or skip prerequisites. Use plain text and readable indentation; avoid Markdown bold/italic. Keep under about 700 words.",
      ].join("\n\n");
      const result = await askAI(prompt);
      setAnswer(result);
      setMode("learn");
      setNotice("পাঠ তৈরি হয়েছে। অনুশীলন শেষ হলে “পাঠ সম্পন্ন” চাপুন।");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "পাঠ তৈরি করা যায়নি। আবার চেষ্টা করুন।");
    } finally { setBusy(false); }
  }

  async function getHelp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim() || busy) return;
    setBusy(true); setError(""); setAnswer(""); setNotice("");
    try {
      const prompt = [
        "You are Coding Coach, a patient multilingual programming tutor. Reply in Bengali, preserve code keywords in their original language, and explain unfamiliar jargon simply.",
        "Learner's programming language: " + (course?.language ?? language) + ". Experience: " + levelLabels[course?.level ?? level] + ". Goal: " + (course?.goal ?? goal),
        "Answer the learner's actual question. If code is supplied, review it carefully, identify the root cause before suggesting changes, provide a corrected example and explain the important lines. If they ask to learn a concept, use a simple analogy, a tiny example, and a small exercise. If requirements are unclear, state the assumption or ask one focused question. Never claim to run code or verify runtime behavior unless an execution tool actually did so. Mention security risks when relevant. Avoid Markdown bold/italic markers.",
        "Question:\n" + question.trim(),
        code.trim() ? "Code or error message:\n" + code.trim() : "",
      ].filter(Boolean).join("\n\n");
      setAnswer(await askAI(prompt));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "সহায়তা পাওয়া যায়নি। আবার চেষ্টা করুন।");
    } finally { setBusy(false); }
  }

  function completeLesson() {
    if (!course) return;
    setCourse({ ...course, completedLessons: course.completedLessons + 1 });
    setAnswer("");
    setNotice("দারুণ! পাঠটি সম্পন্ন হিসেবে সংরক্ষিত হয়েছে। এবার পরের ছোট পাঠ তৈরি করতে পারেন।");
  }

  async function copyAnswer() {
    try { await navigator.clipboard.writeText(answer); setNotice("উত্তর কপি করা হয়েছে।"); }
    catch { setNotice("কপি করা যায়নি—উত্তরটি নির্বাচন করে কপি করুন।"); }
  }

  function resetCourse() {
    setCourse(null); setAnswer(""); setQuestion(""); setCode(""); setError("");
    setMode("plan"); setNotice("নতুন শেখার পরিকল্পনা শুরু করুন।");
  }

  return (
    <>
      <PageHeader title="Coding Coach" sub="ছোট ছোট পাঠে কোডিং শিখুন, নিজের শেখার পরিকল্পনা তৈরি করুন এবং শেখা শেষ না হওয়া পর্যন্ত সহায়তা নিন।" />
      <section className="card-surface mb-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary"><GraduationCap className="h-6 w-6" aria-hidden="true" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">আপনার ব্যক্তিগত কোডিং শিক্ষক</h2>
            <p className="mt-1 text-sm text-muted-foreground">শেখার পরিকল্পনা → ছোট পাঠ → অনুশীলন → প্রশ্ন ও ডিবাগিং → পরের পাঠ। আপনার অগ্রগতি এই ব্রাউজারে সংরক্ষিত থাকে; এটি এখনো অন্য ডিভাইসে স্বয়ংক্রিয়ভাবে সিঙ্ক হয় না।</p>
          </div>
        </div>
        {course && (
          <div className="mt-4 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{course.language} · {levelLabels[course.level]}</p>
              <span className="text-sm text-muted-foreground">{course.completedLessons} পাঠ সম্পন্ন</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={10} aria-valuenow={Math.min(course.completedLessons, 10)} aria-label="শেখার অগ্রগতি">
              <div className="h-full bg-primary transition-all" style={{ width: Math.min(100, course.completedLessons * 10) + "%" }} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">লক্ষ্য: {course.goal}</p>
          </div>
        )}
      </section>

      <div className="mb-4 grid grid-cols-3 gap-2" role="tablist" aria-label="কোডিং শেখার বিভাগ">
        <button type="button" role="tab" aria-selected={mode === "plan"} onClick={() => setMode("plan")} className={"rounded-lg border p-3 text-sm " + (mode === "plan" ? "border-primary bg-primary/10" : "hover:bg-secondary")}><BookOpen className="mx-auto mb-1 h-5 w-5" />পরিকল্পনা</button>
        <button type="button" role="tab" aria-selected={mode === "learn"} onClick={() => setMode("learn")} className={"rounded-lg border p-3 text-sm " + (mode === "learn" ? "border-primary bg-primary/10" : "hover:bg-secondary")}><PlayCircle className="mx-auto mb-1 h-5 w-5" />ছোট পাঠ</button>
        <button type="button" role="tab" aria-selected={mode === "help"} onClick={() => setMode("help")} className={"rounded-lg border p-3 text-sm " + (mode === "help" ? "border-primary bg-primary/10" : "hover:bg-secondary")}><Lightbulb className="mx-auto mb-1 h-5 w-5" />সহায়তা</button>
      </div>

      {mode === "plan" && (
        <form className="card-surface space-y-4 p-4 sm:p-5" onSubmit={generatePlan}>
          <h2 className="font-semibold">আপনার শেখার পরিকল্পনা বানান</h2>
          <div>
            <label htmlFor="coding-language" className="mb-1.5 block text-sm font-medium">কোন ভাষা শিখতে চান?</label>
            <select id="coding-language" className="field" value={language} onChange={(event) => setLanguage(event.target.value)}>
              {languages.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">আপনার বর্তমান দক্ষতা</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["beginner", "some", "experienced"] as const).map((item) => <button key={item} type="button" aria-pressed={level === item} onClick={() => setLevel(item)} className={"rounded-md border p-3 text-sm " + (level === item ? "border-primary bg-primary/10" : "hover:bg-secondary")}>{levelLabels[item]}</button>)}
            </div>
          </fieldset>
          <div>
            <label htmlFor="coding-time" className="mb-1.5 block text-sm font-medium">প্রতিদিন কত সময় দিতে পারবেন?</label>
            <select id="coding-time" className="field" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))}>
              <option value={10}>১০ মিনিট</option><option value={20}>২০ মিনিট</option><option value={30}>৩০ মিনিট</option><option value={45}>৪৫ মিনিট</option><option value={60}>১ ঘণ্টা</option><option value={90}>দেড় ঘণ্টা</option>
            </select>
          </div>
          <div>
            <label htmlFor="coding-goal" className="mb-1.5 block text-sm font-medium">আপনার লক্ষ্য</label>
            <textarea id="coding-goal" className="field min-h-24" value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={500} required placeholder="যেমন: ওয়েবসাইট বানানো, চাকরির প্রস্তুতি, অ্যাপ তৈরি বা প্রোগ্রামিংয়ের ভিত্তি শেখা" />
          </div>
          <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={busy || !goal.trim()}><Sparkles className="mr-2 inline h-4 w-4" />{busy ? "পরিকল্পনা তৈরি হচ্ছে…" : course ? "পরিকল্পনা আপডেট করো" : "আমার শেখার পরিকল্পনা তৈরি করো"}</button>
          {course && <button type="button" className="btn btn-ghost ml-2" onClick={resetCourse}><RotateCcw className="mr-1 inline h-4 w-4" />নতুন কোর্স</button>}
          {course && <div className="mt-4 border-t pt-4"><h3 className="mb-2 font-medium">বর্তমান পরিকল্পনা</h3><div className="whitespace-pre-wrap break-words text-sm leading-7">{course.plan}</div></div>}
        </form>
      )}

      {mode === "learn" && (
        <section className="card-surface space-y-4 p-4 sm:p-5">
          <div className="flex items-start gap-3"><Code2 className="mt-1 h-5 w-5 text-primary" /><div><h2 className="font-semibold">একবারে একটি ছোট পাঠ</h2><p className="mt-1 text-sm text-muted-foreground">প্রতিটি পাঠে থাকবে সহজ ব্যাখ্যা, উদাহরণ, অনুশীলন ও নিজেকে যাচাই করার প্রশ্ন।</p></div></div>
          {course ? <div className="rounded-md bg-secondary/60 p-3 text-sm">বর্তমান কোর্স: {course.language} · সম্পন্ন পাঠ: {course.completedLessons}</div> : <p className="text-sm text-muted-foreground">প্রথমে পরিকল্পনা ট্যাবে আপনার শেখার পরিকল্পনা তৈরি করুন। চাইলে তবুও নিচের বোতামে একটি পরিচিতিমূলক পাঠের অনুরোধ করতে পারেন।</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void generateLesson(false)}>{busy ? <LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 inline h-4 w-4" />} {course ? "বর্তমান পরের পাঠ তৈরি করো" : "পরিচিতিমূলক পাঠ তৈরি করো"}</button>
          </div>
        </section>
      )}

      {mode === "help" && (
        <form className="card-surface space-y-4 p-4 sm:p-5" onSubmit={getHelp}>
          <h2 className="font-semibold">যেকোনো কোডিং প্রশ্নে সাহায্য নিন</h2>
          <p className="text-sm text-muted-foreground">কোনো বিষয় বুঝতে অসুবিধা, error, কোডের সমস্যা, প্রজেক্টের পরিকল্পনা বা পরের ধাপ—সবই সহজ ভাষায় জিজ্ঞেস করুন।</p>
          <div><label htmlFor="coding-question" className="mb-1.5 block text-sm font-medium">আপনার প্রশ্ন</label><textarea id="coding-question" className="field min-h-24" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1200} required placeholder="যেমন: for loop কী? সহজ উদাহরণ দিয়ে বোঝাও।" /></div>
          <div><label htmlFor="coding-code" className="mb-1.5 block text-sm font-medium">কোড বা error (ঐচ্ছিক)</label><textarea id="coding-code" className="field min-h-28 font-mono text-sm" value={code} onChange={(event) => setCode(event.target.value)} maxLength={1200} placeholder="আপনার কোড বা error এখানে দিন…" /></div>
          <button type="submit" className="btn btn-primary" disabled={busy || !question.trim()}><Sparkles className="mr-2 inline h-4 w-4" />{busy ? "সহায়তা তৈরি হচ্ছে…" : "সহজভাবে বুঝিয়ে দাও"}</button>
        </form>
      )}

      {error && <p className="mt-4 rounded-md border border-destructive/30 p-3 text-sm text-destructive" role="alert">{error}</p>}
      {answer && (
        <section className="card-surface mt-4 space-y-3 p-4 sm:p-5" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3"><h2 className="font-semibold">আপনার পাঠ / উত্তর</h2><button type="button" className="btn btn-ghost" onClick={() => void copyAnswer()}><Copy className="mr-1 inline h-4 w-4" />কপি</button></div>
          <div className="whitespace-pre-wrap break-words text-sm leading-7">{answer}</div>
          {mode === "learn" && course && <button type="button" className="btn btn-primary" onClick={completeLesson}><CheckCircle2 className="mr-1 inline h-4 w-4" />পাঠ সম্পন্ন হিসেবে চিহ্নিত করো</button>}
        </section>
      )}
      {notice && <p className="mt-3 text-sm text-muted-foreground" role="status">{notice}</p>}
      <p className="mt-4 text-xs text-muted-foreground">নোট: এই কোচ AI দিয়ে পাঠ, পরিকল্পনা ও ডিবাগিংয়ের পরামর্শ তৈরি করে; কোড এখানে বাস্তবে চালানো হয় না। ফলাফল যাচাই করতে সংশ্লিষ্ট ভাষার compiler, interpreter বা browser-এ অনুশীলন করুন।</p>
    </>
  );
}

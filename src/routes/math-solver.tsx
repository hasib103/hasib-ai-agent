import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { Calculator, CheckCircle2, Copy, RotateCcw, Sparkles } from "lucide-react";
import { PageHeader } from "@/lib/store";
import { askVoiceAssistant } from "@/lib/voice-chat.functions";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/math-solver")({
  head: () => ({
    meta: [
      { title: "Math Solver · Hasib AI Agent" },
      { name: "description", content: "Step-by-step AI math solver for arithmetic, algebra, geometry, calculus, statistics and more." },
    ],
  }),
  component: MathSolver,
});

const topics = [
  { id: "general", label: "Auto detect", instruction: "Identify the mathematical field and solve accordingly." },
  { id: "arithmetic", label: "Arithmetic", instruction: "Focus on arithmetic, fractions, decimals, percentages, ratios, exponents, roots and order of operations." },
  { id: "algebra", label: "Algebra & equations", instruction: "Focus on simplifying expressions, factoring, polynomials, inequalities, systems of equations and word problems." },
  { id: "geometry", label: "Geometry", instruction: "Focus on plane and solid geometry, angles, areas, perimeters, volumes, coordinate geometry and proofs." },
  { id: "trigonometry", label: "Trigonometry", instruction: "Focus on trigonometric identities, equations, radians, angles, graphs and triangles." },
  { id: "calculus", label: "Calculus", instruction: "Focus on limits, continuity, derivatives, integrals, series and differential equations." },
  { id: "statistics", label: "Statistics & probability", instruction: "Focus on probability, distributions, descriptive statistics, inference, combinatorics and expected values." },
  { id: "linear-algebra", label: "Linear algebra", instruction: "Focus on vectors, matrices, determinants, linear systems, eigenvalues, eigenvectors and vector spaces." },
  { id: "discrete", label: "Discrete math & number theory", instruction: "Focus on logic, sets, combinatorics, modular arithmetic, divisibility, primes, recurrence relations and graph theory." },
  { id: "units", label: "Units & conversions", instruction: "Focus on dimensional analysis, unit conversions, scientific notation and significant figures." },
] as const;

type TopicId = (typeof topics)[number]["id"];

function MathSolver() {
  const runAssistant = useServerFn(askVoiceAssistant);
  const [topic, setTopic] = useState<TopicId>("general");
  const [problem, setProblem] = useState("");
  const [detail, setDetail] = useState<"concise" | "step-by-step" | "teach">("step-by-step");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function solve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = problem.trim();
    if (!question || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    setAnswer("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) throw new Error("গণিত সমাধান করতে আবার সাইন ইন করুন।");
      const selected = topics.find((item) => item.id === topic) ?? topics[0];
      const styleInstruction = detail === "concise"
        ? "Give a concise solution, show the essential calculation, and clearly state the final answer."
        : detail === "teach"
          ? "Teach the concept as if tutoring a learner. Explain why each method works, define needed terms, show intermediate steps, and finish with a short check-your-understanding tip."
          : "Solve step by step. State the given information, identify the method or formula, show intermediate algebra and arithmetic without skipping important steps, explain substitutions, and clearly mark the final result.";
      const message = [
        "You are the dedicated Math Solver inside Hasib AI Agent.",
        "Mathematics topic guidance: " + selected.instruction,
        "Solution style: " + styleInstruction,
        "Solve the user's exact problem, not a different one. Check calculations, signs, units, domains, assumptions, and whether the result satisfies the original problem. For equations, verify the solution by substitution when practical. For proofs, make the logical steps explicit. For numerical results, keep sensible precision and do not imply exactness when rounded.",
        "If information is missing or the problem is ambiguous, state the ambiguity and ask for the minimum needed clarification rather than inventing values. If the problem has no solution or infinitely many solutions, explain why. If a question contains a false premise, point it out.",
        "Use plain text with readable line breaks. Avoid Markdown bold/italic markers. Use Unicode mathematical symbols or plain-text equations when clear; use LaTeX-style notation only when it improves readability. End with a clearly labelled final answer. Never fabricate calculator, code execution, or symbolic-computation verification.",
        "Important: AI-generated math can contain mistakes. Independently check the answer and state any assumptions.",
        "User's math problem:\n" + question,
      ].join("\n\n");
      const result = await runAssistant({
        data: {
          message,
          history: [],
          language: "bn-BD",
          profile: "study_tutor",
          accessToken,
        },
      });
      setAnswer(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "সমাধান তৈরি করা যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(answer);
      setNotice("সমাধান কপি করা হয়েছে।");
    } catch {
      setNotice("কপি করা যায়নি—সমাধানটি নির্বাচন করে কপি করুন।");
    }
  }

  return (
    <>
      <PageHeader title="Math Solver" sub="গণিতের প্রশ্ন লিখুন—ধাপে ধাপে সমাধান, সূত্র ও যাচাইসহ উত্তর পান।" />
      <section className="card-surface mb-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary"><Calculator className="h-6 w-6" aria-hidden="true" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">একটি আলাদা গণিত জেনারেটর</h2>
            <p className="mt-1 text-sm text-muted-foreground">স্কুল, কলেজ ও বিশ্ববিদ্যালয় পর্যায়ের বিভিন্ন গণিতের প্রশ্ন সমাধানে সহায়তা করে। সমাধানটি AI-তৈরি—বিশেষ করে গুরুত্বপূর্ণ পরীক্ষার আগে হিসাব ও শর্ত নিজে যাচাই করুন।</p>
          </div>
        </div>
      </section>

      <form className="card-surface space-y-4 p-4 sm:p-5" onSubmit={solve}>
        <div>
          <label htmlFor="math-topic" className="mb-1.5 block text-sm font-medium">গণিতের বিভাগ</label>
          <select id="math-topic" className="field" value={topic} onChange={(event) => setTopic(event.target.value as TopicId)}>
            {topics.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="math-problem" className="mb-1.5 block text-sm font-medium">আপনার প্রশ্ন</label>
          <textarea
            id="math-problem"
            className="field min-h-36"
            value={problem}
            onChange={(event) => setProblem(event.target.value)}
            maxLength={3500}
            required
            placeholder={"যেমন: 2x² - 5x - 3 = 0 সমীকরণটি ধাপে ধাপে সমাধান করো।\nঅথবা: x²-এর অন্তরক নির্ণয় করো এবং নিয়মটি বোঝাও।"}
          />
          <p className="mt-1 text-xs text-muted-foreground">{problem.length}/3500 অক্ষর · প্রশ্নে সূত্র, মান, একক ও প্রয়োজনীয় শর্ত উল্লেখ করুন।</p>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">সমাধানের ধরন</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            <button type="button" onClick={() => setDetail("concise")} aria-pressed={detail === "concise"} className={"rounded-md border p-3 text-left text-sm " + (detail === "concise" ? "border-primary bg-primary/10" : "hover:bg-secondary")}>সংক্ষিপ্ত উত্তর</button>
            <button type="button" onClick={() => setDetail("step-by-step")} aria-pressed={detail === "step-by-step"} className={"rounded-md border p-3 text-left text-sm " + (detail === "step-by-step" ? "border-primary bg-primary/10" : "hover:bg-secondary")}>ধাপে ধাপে</button>
            <button type="button" onClick={() => setDetail("teach")} aria-pressed={detail === "teach"} className={"rounded-md border p-3 text-left text-sm " + (detail === "teach" ? "border-primary bg-primary/10" : "hover:bg-secondary")}>শিখিয়ে বোঝাও</button>
          </div>
        </fieldset>
        <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={busy || !problem.trim()}>
          <Sparkles className="mr-2 inline h-4 w-4" aria-hidden="true" />{busy ? "সমাধান করা হচ্ছে…" : "সমাধান তৈরি করো"}
        </button>
      </form>

      {error && <p className="mt-4 rounded-md border border-destructive/30 p-3 text-sm text-destructive" role="alert">{error}</p>}
      {answer && (
        <section className="card-surface mt-4 space-y-3 p-4 sm:p-5" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <h2 className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" /> সমাধান</h2>
            <button type="button" className="btn btn-ghost" onClick={() => void copyAnswer()}><Copy className="mr-1.5 inline h-4 w-4" aria-hidden="true" />কপি</button>
          </div>
          <div className="whitespace-pre-wrap break-words text-sm leading-7">{answer}</div>
          {notice && <p className="text-sm text-muted-foreground" role="status">{notice}</p>}
          <button type="button" className="btn btn-ghost" onClick={() => { setProblem(""); setAnswer(""); setError(""); setNotice(""); }}>
            <RotateCcw className="mr-1.5 inline h-4 w-4" aria-hidden="true" />নতুন প্রশ্ন
          </button>
        </section>
      )}
      {!answer && notice && <p className="mt-3 text-sm text-muted-foreground" role="status">{notice}</p>}
    </>
  );
}

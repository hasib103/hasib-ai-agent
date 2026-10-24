import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { Activity, AlertTriangle, Copy, HeartPulse, Leaf, PawPrint, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import { PageHeader } from "@/lib/store";
import { askVoiceAssistant } from "@/lib/voice-chat.functions";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/pet-care")({
  head: () => ({
    meta: [
      { title: "Pet Care & Health Guide · Hasib AI Agent" },
      { name: "description", content: "Pet health education, symptom triage, prevention, nutrition, grooming and country-aware veterinary medicine guidance." },
    ],
  }),
  component: PetCare,
});

const animals = ["কুকুর", "বিড়াল", "খরগোশ", "গিনি পিগ", "হ্যামস্টার", "পাখি", "মাছ", "কচ্ছপ", "ফেরেট", "ঘোড়া", "ছাগল", "গরু", "অন্যান্য"];
const countries = [
  "বাংলাদেশ", "ভারত", "পাকিস্তান", "নেপাল", "শ্রীলঙ্কা", "যুক্তরাষ্ট্র", "যুক্তরাজ্য", "কানাডা", "অস্ট্রেলিয়া",
  "নিউজিল্যান্ড", "সৌদি আরব", "সংযুক্ত আরব আমিরাত", "মালয়েশিয়া", "সিঙ্গাপুর", "ইন্দোনেশিয়া", "ফিলিপাইন",
  "দক্ষিণ আফ্রিকা", "অন্যান্য দেশ",
];
const topics = [
  { title: "লক্ষণ বুঝতে সহায়তা", detail: "খাবার না খাওয়া, বমি, ডায়রিয়া, চুলকানি, কাশি, অবসাদ, প্রস্রাবের পরিবর্তনসহ লক্ষণ গুছিয়ে দেখা।" },
  { title: "রোগ প্রতিরোধ", detail: "টিকা, পরজীবী নিয়ন্ত্রণ, দাঁতের যত্ন, নিয়মিত স্বাস্থ্য পরীক্ষা ও নিরাপদ পরিবেশ।" },
  { title: "খাদ্য ও পুষ্টি", detail: "প্রজাতি, বয়স, ওজন ও জীবনের পর্যায় অনুযায়ী খাবারের মৌলিক নির্দেশনা; বিষাক্ত খাবার এড়ানো।" },
  { title: "পরিচর্যা ও আচরণ", detail: "গ্রুমিং, ব্যায়াম, লিটার/খাঁচা পরিষ্কার, আচরণগত পরিবর্তন ও মানসিক উদ্দীপনা।" },
  { title: "ওষুধ সম্পর্কে শিক্ষা", detail: "জেনেরিক নাম, কী কাজে ব্যবহৃত হয়, সম্ভাব্য ঝুঁকি, স্থানীয় অনুমোদন ও পশুচিকিৎসকের কাছে যাচাই করার প্রশ্ন।" },
  { title: "জরুরি অবস্থা", detail: "বিষক্রিয়া, শ্বাসকষ্ট, খিঁচুনি, প্রচুর রক্তপাত, প্রস্রাব করতে না পারা বা হঠাৎ অচেতন হলে দ্রুত চিকিৎসা।" },
];
const urgentSigns = [
  "শ্বাস নিতে কষ্ট, নীলচে/ফ্যাকাশে মাড়ি বা জিহ্বা",
  "খিঁচুনি, অচেতনতা, ধসে পড়া বা তীব্র দুর্বলতা",
  "প্রচুর রক্তপাত, বড় আঘাত, পেট হঠাৎ ফুলে যাওয়া",
  "বারবার বমি, রক্তমিশ্রিত বমি/পায়খানা বা বিষাক্ত কিছু খাওয়ার সম্ভাবনা",
  "প্রস্রাবের চেষ্টা করেও না হওয়া—বিশেষত বিড়াল",
  "পাখির ক্ষেত্রে খাঁচার তলায় বসে থাকা, হাঁপানো বা হঠাৎ খাওয়া বন্ধ",
];

function PetCare() {
  const runAssistant = useServerFn(askVoiceAssistant);
  const [animal, setAnimal] = useState("কুকুর");
  const [country, setCountry] = useState("বাংলাদেশ");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [duration, setDuration] = useState("");
  const [history, setHistory] = useState("");
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<"symptoms" | "medicine" | "prevention" | "general">("symptoms");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function askAI(prompt: string) {
    const { data, error: sessionError } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (sessionError || !accessToken) throw new Error("এই সহায়তা ব্যবহার করতে আবার সাইন ইন করুন।");
    return runAssistant({ data: { message: prompt, history: [], language: "bn-BD", profile: "tutor", accessToken } });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setAnswer(""); setNotice("");
    try {
      const modeInstruction = mode === "symptoms"
        ? "Provide a careful symptom triage guide: possible causes (not a diagnosis), what to observe, safe supportive care while arranging help, what not to do, urgency level and when to contact a veterinarian. Do not over-reassure."
        : mode === "medicine"
          ? "Provide veterinary medicine education, not a prescription. You may explain relevant generic medicine names/classes and their usual purpose only when clinically appropriate, key contraindications, adverse effects, interactions, species-specific dangers and local regulatory/availability caveats. NEVER calculate or state a dose, dose range, frequency, duration, route or step-by-step administration for this animal. Do not recommend starting/stopping a medicine. Explain that product strengths and approvals vary by country and a licensed veterinarian must select the drug and exact dose after examination. Explicitly warn that human medicines and medicines for another species can be toxic."
        : mode === "prevention"
          ? "Give a practical species-appropriate prevention and routine-care plan: vaccines (state schedules vary by region and veterinarian), parasite prevention, nutrition, hygiene, dental care, enrichment, safe housing and preventive checkups. Flag toxic foods/plants and risks relevant to this species."
          : "Answer the general pet-care question with species-appropriate, evidence-conscious education and practical next steps. Distinguish established facts from uncertainty.";
      const prompt = [
        "You are Pet Care Guide inside Hasib AI Agent. Respond in clear Bengali, using readable headings and numbered steps; avoid Markdown bold/italic markers.",
        "You provide educational support and triage, not a substitute for an examination by a licensed veterinarian. Never claim to diagnose, prescribe, or have examined the animal.",
        "Safety rules: never give individualized drug dosing, dose calculations, route, frequency, or duration. Do not recommend human painkillers, antibiotics, dewormers, flea/tick products, or home remedies without veterinary direction. Do not induce vomiting or force food/water unless a veterinarian or poison service directs it. For urgent red flags, tell the user to contact an emergency veterinarian now and not delay for an AI answer.",
        "If the animal may have ingested poison/medication, ask them to keep the package and report the substance, approximate amount and time to a veterinarian; do not suggest home detox. For species where fasting or small delays can be dangerous, do not recommend waiting.",
        "Country-aware guidance: user's country is " + country + ". Do not invent local brand availability, legal approval or an official dosing protocol. Prefer generic names and tell them to verify registration, label, and product strength with a locally licensed veterinarian/pharmacist. Rules and formulations differ by country.",
        modeInstruction,
        "Animal: " + animal,
        "Country/region: " + country,
        age.trim() ? "Age: " + age.trim() : "Age: not provided",
        weight.trim() ? "Weight: " + weight.trim() : "Weight: not provided",
        duration.trim() ? "Symptom duration: " + duration.trim() : "",
        symptoms.trim() ? "Reported signs/symptoms: " + symptoms.trim() : "",
        history.trim() ? "Known history, medicines, allergies or possible exposure: " + history.trim() : "",
        question.trim() ? "User's question: " + question.trim() : "",
        "Start with an urgent-care warning if indicated. If key information is missing, state what matters and ask only the most important follow-up questions. Keep the answer useful, cautious and under about 750 words."
      ].filter(Boolean).join("\n\n");
      setAnswer(await askAI(prompt));
      setNotice("তথ্যটি শিক্ষামূলক সহায়তা। জরুরি লক্ষণ থাকলে উত্তর পড়ার অপেক্ষা না করে পশুচিকিৎসকের কাছে যান।");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "উত্তর তৈরি করা যায়নি। আবার চেষ্টা করুন।");
    } finally { setBusy(false); }
  }

  async function copyAnswer() {
    try { await navigator.clipboard.writeText(answer); setNotice("উত্তর কপি করা হয়েছে।"); }
    catch { setNotice("কপি করা যায়নি—উত্তরটি নির্বাচন করে কপি করুন।"); }
  }

  return (
    <>
      <PageHeader title="Pet Care & Health Guide" sub="পোষা ও গৃহপালিত প্রাণীর লক্ষণ, প্রাথমিক পরিচর্যা, রোগ প্রতিরোধ, পুষ্টি ও দেশভিত্তিক পশুচিকিৎসা-ওষুধ সম্পর্কে নিরাপদ শিক্ষামূলক সহায়তা।" />
      <section className="card-surface mb-4 space-y-3 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary"><PawPrint className="h-6 w-6" aria-hidden="true" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">প্রাণীর যত্ন—লক্ষণ থেকে প্রতিরোধ পর্যন্ত</h2>
            <p className="mt-1 text-sm text-muted-foreground">প্রজাতি ও দেশ অনুযায়ী তথ্য সাজিয়ে নিন। লক্ষণ লিখলে সম্ভাব্য কারণ, কতটা জরুরি, কী পর্যবেক্ষণ করবেন এবং পশুচিকিৎসকের সঙ্গে কী আলোচনা করবেন—তা বুঝতে সাহায্য করবে।</p>
          </div>
        </div>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-5 w-5" aria-hidden="true" />জরুরি লক্ষণ</div>
          <p className="mt-1 text-sm text-muted-foreground">নিচের কোনো লক্ষণ থাকলে AI উত্তর বা অনলাইন পরামর্শের জন্য অপেক্ষা করবেন না—এখনই নিকটস্থ পশুচিকিৎসক/জরুরি ক্লিনিকে যোগাযোগ করুন।</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{urgentSigns.map((sign) => <li key={sign}>{sign}</li>)}</ul>
        </div>
      </section>

      <section className="card-surface mb-4 p-4 sm:p-5">
        <h2 className="mb-3 font-semibold">এই ফিচারে যা পাবেন</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {topics.map((topic) => <div key={topic.title} className="rounded-lg border p-3"><h3 className="font-medium">{topic.title}</h3><p className="mt-1 text-sm text-muted-foreground">{topic.detail}</p></div>)}
        </div>
      </section>

      <form className="card-surface space-y-4 p-4 sm:p-5" onSubmit={submit}>
        <h2 className="font-semibold">প্রাণীর তথ্য ও আপনার প্রশ্ন</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="pet-animal" className="mb-1.5 block text-sm font-medium">প্রাণীর ধরন</label><select id="pet-animal" className="field" value={animal} onChange={(e) => setAnimal(e.target.value)}>{animals.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div><label htmlFor="pet-country" className="mb-1.5 block text-sm font-medium">দেশ (স্থানীয় ওষুধ/নিয়মের প্রেক্ষাপট)</label><select id="pet-country" className="field" value={country} onChange={(e) => setCountry(e.target.value)}>{countries.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div><label htmlFor="pet-age" className="mb-1.5 block text-sm font-medium">বয়স (যদি জানা থাকে)</label><input id="pet-age" className="field" value={age} onChange={(e) => setAge(e.target.value)} maxLength={80} placeholder="যেমন: ২ বছর / প্রায় ৬ মাস" /></div>
          <div><label htmlFor="pet-weight" className="mb-1.5 block text-sm font-medium">ওজন (যদি জানা থাকে)</label><input id="pet-weight" className="field" value={weight} onChange={(e) => setWeight(e.target.value)} maxLength={80} placeholder="যেমন: ৪.৫ কেজি" /></div>
          <div className="sm:col-span-2"><label htmlFor="pet-mode" className="mb-1.5 block text-sm font-medium">কী ধরনের সাহায্য চান?</label><select id="pet-mode" className="field" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}><option value="symptoms">লক্ষণ ও জরুরিতা বুঝতে</option><option value="medicine">ওষুধ সম্পর্কে তথ্য ও পশুচিকিৎসককে জিজ্ঞাসার বিষয়</option><option value="prevention">রোগ প্রতিরোধ ও নিয়মিত পরিচর্যা</option><option value="general">সাধারণ প্রশ্ন / পুষ্টি / আচরণ</option></select></div>
          <div className="sm:col-span-2"><label htmlFor="pet-symptoms" className="mb-1.5 block text-sm font-medium">লক্ষণ / সমস্যা</label><textarea id="pet-symptoms" className="field min-h-24" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} maxLength={2500} placeholder="কী পরিবর্তন হয়েছে, খাওয়া-পানির অবস্থা, বমি/ডায়রিয়া/কাশি/চুলকানি ইত্যাদি লিখুন।" /></div>
          <div><label htmlFor="pet-duration" className="mb-1.5 block text-sm font-medium">কতক্ষণ ধরে?</label><input id="pet-duration" className="field" value={duration} onChange={(e) => setDuration(e.target.value)} maxLength={100} placeholder="যেমন: আজ সকাল থেকে" /></div>
          <div><label htmlFor="pet-history" className="mb-1.5 block text-sm font-medium">আগের রোগ, ওষুধ, অ্যালার্জি বা সম্ভাব্য বিষক্রিয়া</label><input id="pet-history" className="field" value={history} onChange={(e) => setHistory(e.target.value)} maxLength={500} placeholder="যা জানা আছে" /></div>
          <div className="sm:col-span-2"><label htmlFor="pet-question" className="mb-1.5 block text-sm font-medium">আপনার নির্দিষ্ট প্রশ্ন</label><textarea id="pet-question" className="field min-h-20" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1500} placeholder="যেমন: কী কী লক্ষণ নজরে রাখব? কীভাবে প্রতিরোধ করব? কোন ওষুধের বিষয়টি ভেটের সঙ্গে আলোচনা করব?" /></div>
        </div>
        <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={busy || (!symptoms.trim() && !question.trim() && mode !== "prevention")}><Sparkles className="mr-2 inline h-4 w-4" />{busy ? "নিরাপদ নির্দেশনা তৈরি হচ্ছে…" : "সহায়তা তৈরি করুন"}</button>
        {error && <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
      </form>

      {answer && <section className="card-surface mt-4 p-4 sm:p-5" aria-live="polite">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">আপনার জন্য তৈরি করা তথ্য</h2><button type="button" className="btn" onClick={() => void copyAnswer()}><Copy className="mr-2 inline h-4 w-4" />কপি</button></div>
        <div className="whitespace-pre-wrap break-words text-sm leading-7">{answer}</div>
        <p className="mt-4 rounded-md border p-3 text-sm text-muted-foreground"><Stethoscope className="mr-2 inline h-4 w-4" />এটি রোগ নির্ণয় বা প্রেসক্রিপশন নয়। নির্দিষ্ট ওষুধ, ডোজ, প্রয়োগপথ ও চিকিৎসার মেয়াদ পশুচিকিৎসকই নির্ধারণ করবেন।</p>
      </section>}

      <section className="card-surface mt-4 p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5" />প্রতিদিনের প্রতিরোধমূলক অভ্যাস</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex gap-2"><HeartPulse className="mt-0.5 h-4 w-4 shrink-0 text-primary" />খাবার, পানি পান, প্রস্রাব-পায়খানা, চলাফেরা ও আচরণের স্বাভাবিক ধরন লক্ষ্য করুন।</li>
          <li className="flex gap-2"><Activity className="mt-0.5 h-4 w-4 shrink-0 text-primary" />টিকা, পরজীবী নিয়ন্ত্রণ, দাঁত/ত্বক পরীক্ষা ও স্বাস্থ্য পরীক্ষার সময়সূচি স্থানীয় পশুচিকিৎসকের সঙ্গে ঠিক করুন।</li>
          <li className="flex gap-2"><Leaf className="mt-0.5 h-4 w-4 shrink-0 text-primary" />প্রজাতি-উপযোগী সুষম খাবার, পরিষ্কার পানি, নিরাপদ আশ্রয়, ব্যায়াম ও মানসিক উদ্দীপনা দিন।</li>
          <li className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />মানুষের ওষুধ বা অন্য প্রাণীর ওষুধ নিজে থেকে দেবেন না; প্যাকেট/ওষুধের নাম ও স্বাস্থ্য-রেকর্ড সংরক্ষণ করুন।</li>
        </ul>
      </section>
    </>
  );
}

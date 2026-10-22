import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { enforceAiRequestQuota } from "@/lib/ai-request-quota";

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("click"), selector: z.string().trim().min(1).max(300) }),
  z.object({ type: z.literal("type"), selector: z.string().trim().min(1).max(300), text: z.string().max(2000) }),
  z.object({ type: z.literal("wait"), milliseconds: z.number().int().min(100).max(5000) }),
]);
const inputSchema = z.object({
  url: z.string().trim().url().max(2048),
  goal: z.string().trim().min(1).max(500),
  actions: z.array(actionSchema).max(6).default([]),
  accessToken: z.string().trim().min(1).max(8192),
});

function assertPublicHttpsUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("একটি সঠিক ওয়েব ঠিকানা দিন।"); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("শুধু HTTP/HTTPS ওয়েবসাইট ব্যবহার করা যাবে।");
  if (url.username || url.password) throw new Error("URL-এর মধ্যে লগইন তথ্য দেওয়া যাবে না।");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const blocked = host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
    host === "metadata.google.internal" || host === "metadata";
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  const privateIpv4 = ipv4 && (
    Number(ipv4[1]) === 0 || Number(ipv4[1]) === 10 || Number(ipv4[1]) === 127 ||
    (Number(ipv4[1]) === 169 && Number(ipv4[2]) === 254) ||
    (Number(ipv4[1]) === 172 && Number(ipv4[2]) >= 16 && Number(ipv4[2]) <= 31) ||
    (Number(ipv4[1]) === 192 && Number(ipv4[2]) === 168) ||
    Number(ipv4[1]) >= 224
  );
  const privateIpv6 = host.includes(":");
  if (blocked || privateIpv4 || privateIpv6) throw new Error("স্থানীয় বা ব্যক্তিগত নেটওয়ার্কের ঠিকানায় ব্রাউজ করা নিরাপত্তার কারণে বন্ধ।");
  return url;
}

const browserProgram = `export default async ({ page, context }) => {
  const isPublic = (raw) => {
    try {
      const u = new URL(raw);
      if (!["http:", "https:"].includes(u.protocol) || u.username || u.password) return false;
      const h = u.hostname.toLowerCase().replace(/^\\[|\\]$/g, "");
      if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h === "metadata" || h === "metadata.google.internal") return false;
      const m = h.match(/^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$/);
      if (m) {
        const a = +m[1], b = +m[2];
        if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
      }
      if (h.includes(":")) return false;
      return true;
    } catch { return false; }
  };
  await page.setRequestInterception(true);
  page.on("request", request => {
    if (isPublic(request.url())) void request.continue().catch(() => {});
    else void request.abort("blockedbyclient").catch(() => {});
  });
  const trace = [];
  try {
    if (!isPublic(context.url)) throw new Error("Blocked non-public URL");
    await page.goto(context.url, { waitUntil: "domcontentloaded", timeout: 18000 });
    trace.push("Opened " + page.url());
    for (const action of context.actions || []) {
      if (action.type === "click") {
        await page.waitForSelector(action.selector, { timeout: 5000 });
        await page.click(action.selector);
        trace.push("Clicked selector: " + action.selector);
      } else if (action.type === "type") {
        await page.waitForSelector(action.selector, { timeout: 5000 });
        await page.click(action.selector);
        await page.keyboard.press("Control+A");
        await page.type(action.selector, action.text, { delay: 5 });
        trace.push("Filled selector: " + action.selector);
      } else if (action.type === "wait") {
        await new Promise(resolve => setTimeout(resolve, action.milliseconds));
        trace.push("Waited " + action.milliseconds + "ms");
      }
    }
    await page.waitForTimeout(250);
    const data = await page.evaluate(() => ({
      title: document.title || "",
      url: location.href,
      text: (document.body?.innerText || "").slice(0, 12000),
      links: Array.from(document.querySelectorAll("a[href]")).slice(0, 15).map(a => ({
        text: (a.innerText || a.getAttribute("aria-label") || "").trim().slice(0, 120),
        href: a.href
      })).filter(a => a.text && /^https?:/.test(a.href))
    }));
    return { data: { ...data, actions: trace }, type: "application/json" };
  } catch (error) {
    return { data: { error: error instanceof Error ? error.message : "Browser task failed", actions: trace }, type: "application/json" };
  }
};`;

export const runBrowserTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: authData, error: authError } = await supabase.auth.getUser(data.accessToken);
    if (authError || !authData.user) throw new Error("সেশন শেষ হয়েছে। আবার সাইন ইন করুন।");
    const token = process.env["BROWSERLESS_API_TOKEN"];
    if (!token) throw new Error("ব্রাউজার টুল এখনো কনফিগার করা হয়নি। সার্ভারে BROWSERLESS_API_TOKEN যোগ করতে হবে।");
    const startUrl = assertPublicHttpsUrl(data.url);
    await enforceAiRequestQuota(data.accessToken, "chat");

    const endpoint = "https://production-sfo.browserless.io/function?token=" + encodeURIComponent(token) + "&timeout=25000";
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: browserProgram, context: { url: startUrl.toString(), actions: data.actions } }),
        signal: AbortSignal.timeout(28000),
      });
    } catch {
      throw new Error("দূরবর্তী ব্রাউজারে সংযোগ করা যায়নি। পরে আবার চেষ্টা করুন।");
    }
    if (response.status === 401 || response.status === 403) throw new Error("Browserless API token সঠিক নয় বা অনুমতি নেই।");
    if (response.status === 429) throw new Error("ব্রাউজার ব্যবহারের সীমা শেষ হয়েছে। কিছুক্ষণ পরে চেষ্টা করুন।");
    if (!response.ok) throw new Error("ব্রাউজার সার্ভার ব্যর্থ হয়েছে (HTTP " + response.status + ")।");
    const raw = await response.json() as { data?: unknown; error?: string; title?: string; url?: string; text?: string; links?: unknown; actions?: unknown };
    const result = (raw && typeof raw.data === "object" && raw.data !== null ? raw.data : raw) as {
      error?: string; title?: string; url?: string; text?: string; links?: Array<{ text: string; href: string }>; actions?: string[];
    };
    if (result.error) throw new Error("ব্রাউজার কাজ সম্পন্ন হয়নি: " + result.error.slice(0, 250));
    return {
      goal: data.goal,
      title: (result.title || "").slice(0, 300),
      url: (result.url || startUrl.toString()).slice(0, 2048),
      text: (result.text || "").slice(0, 12000),
      links: (result.links || []).filter((link) => typeof link.href === "string" && /^https?:\/\//i.test(link.href)).slice(0, 15),
      actions: (result.actions || []).slice(0, 8),
    };
  });

import { getJSON, setJSON } from "./storage.js";

// Text generation through Groq's free API (open models, no card required).
const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
export const aiEnabled = Boolean(GROQ_KEY);
export const aiProvider = aiEnabled ? "groq" : null;

// After a rate-limit response, skip AI calls until this time (the free tier has daily caps).
let pausedUntil = 0;

// Free-tier daily token caps (console.groq.com/settings/limits). Groq doesn't
// send the daily token budget in its headers, so tokens are counted here.
const DAILY_TOKENS = {
  "openai/gpt-oss-120b": 200_000,
  "openai/gpt-oss-20b": 200_000,
  "llama-3.3-70b-versatile": 100_000,
  "llama-3.1-8b-instant": 500_000,
};
const dailyTokenLimit = Number(process.env.GROQ_DAILY_TOKENS) || DAILY_TOKENS[GROQ_MODEL] || null;

// Usage per UTC day (Groq's daily caps use a rolling window, so this is an
// approximation), saved in storage so a restart doesn't zero the counter.
const usageKey = () => `ai-usage-${new Date().toISOString().slice(0, 10)}`;
let usage = null; // { day, requests, tokens, errors }
let limits = null; // latest rate-limit headers sent by Groq

async function loadUsage() {
  const day = usageKey();
  if (usage?.day !== day) usage = { day, requests: 0, tokens: 0, errors: 0, ...(await getJSON(day).catch(() => null)) };
  return usage;
}

async function recordUsage(tokens, failed) {
  const u = await loadUsage();
  u.requests += 1;
  u.tokens += tokens;
  if (failed) u.errors += 1;
  await setJSON(u.day, u, 2 * 86_400);
}

const header = (res, name) => {
  const v = res.headers.get(name);
  if (v == null || v === "") return null;
  return Number.isNaN(Number(v)) ? v : Number(v);
};

function readLimits(res) {
  if (res.headers.get("x-ratelimit-limit-requests") == null) return;
  limits = {
    at: new Date().toISOString(),
    requestsPerDay: header(res, "x-ratelimit-limit-requests"),
    requestsLeft: header(res, "x-ratelimit-remaining-requests"),
    requestsReset: header(res, "x-ratelimit-reset-requests"),
    tokensPerMinute: header(res, "x-ratelimit-limit-tokens"),
    tokensLeft: header(res, "x-ratelimit-remaining-tokens"),
    tokensReset: header(res, "x-ratelimit-reset-tokens"),
  };
}

export async function aiUsage() {
  if (!aiEnabled) return { enabled: false };
  const u = await loadUsage();
  return {
    enabled: true,
    model: GROQ_MODEL,
    today: { requests: u.requests, tokens: u.tokens, errors: u.errors },
    dailyTokenLimit,
    limits,
    pausedUntil: Date.now() < pausedUntil ? new Date(pausedUntil).toISOString() : null,
  };
}

export async function askAI(system, prompt) {
  if (!aiEnabled || Date.now() < pausedUntil) return null;
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      // gpt-oss models reason before answering; keep it short to save the free quota.
      ...(GROQ_MODEL.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
      max_completion_tokens: 2000,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  readLimits(res);
  if (res.status === 429) {
    recordUsage(0, true).catch(() => {});
    const retry = Number(res.headers.get("retry-after")) || 60;
    pausedUntil = Date.now() + Math.min(retry, 3600) * 1000;
    throw new Error(`Groq: límite gratuito alcanzado, reintento en ${retry}s`);
  }
  const body = await res.json().catch(() => ({}));
  recordUsage(body.usage?.total_tokens ?? 0, !res.ok).catch(() => {});
  if (!res.ok) throw new Error(`Groq ${res.status}: ${body.error?.message ?? "error"}`);
  return body.choices?.[0]?.message?.content?.trim() || null;
}

// First JSON object in an AI answer (models sometimes wrap it in prose), or null.
export function parseJsonAnswer(text) {
  const json = text?.match(/\{[\s\S]*\}/)?.[0];
  try {
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

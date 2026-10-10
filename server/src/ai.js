// Text generation through Groq's free API (open models, no card required).
const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
export const aiEnabled = Boolean(GROQ_KEY);
export const aiProvider = aiEnabled ? "groq" : null;

// After a rate-limit response, skip AI calls until this time (the free tier has daily caps).
let pausedUntil = 0;

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
  if (res.status === 429) {
    const retry = Number(res.headers.get("retry-after")) || 60;
    pausedUntil = Date.now() + Math.min(retry, 3600) * 1000;
    throw new Error(`Groq: límite gratuito alcanzado, reintento en ${retry}s`);
  }
  const body = await res.json().catch(() => ({}));
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

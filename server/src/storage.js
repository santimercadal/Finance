import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Key-value storage. Uses Upstash Redis (REST API) when configured, so data
// survives redeploys on hosts with ephemeral disks (e.g. Render free tier);
// otherwise falls back to JSON files in server/data for local development.
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
export const storageKind = REDIS_URL && REDIS_TOKEN ? "upstash" : "file";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(here, "..", "data");

async function redis(command) {
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(`Upstash: ${body.error ?? res.status}`);
  return body.result;
}

// Detects a read-only token (Upstash's "Readonly Token" rejects SET with NOPERM).
// Cached for 10 minutes so frequent health checks don't spend the free command quota.
let writableCheck = { at: 0, result: null };
export async function storageWritable() {
  if (Date.now() - writableCheck.at < 10 * 60_000) return writableCheck.result;
  let result;
  try {
    await setJSON("health-check", { at: Date.now() }, 600);
    result = true;
  } catch (err) {
    result = err.message.slice(0, 120);
  }
  writableCheck = { at: Date.now(), result };
  return result;
}

export async function getJSON(key) {
  if (storageKind === "upstash") {
    const raw = await redis(["GET", key]);
    return raw == null ? null : JSON.parse(raw);
  }
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, `${key}.json`), "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

export async function setJSON(key, value, ttlSeconds) {
  if (storageKind === "upstash") {
    const command = ["SET", key, JSON.stringify(value)];
    if (ttlSeconds) command.push("EX", String(ttlSeconds));
    await redis(command);
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, `${key}.json`), JSON.stringify(value, null, 2));
}

// Long-lived cache for expensive results (AI answers) that should survive
// restarts. Only backed by Upstash: local JSON files have no expiry, so in
// development these are no-ops. Failures never break the caller.
const durable = storageKind === "upstash";
export const recall = (key) => (durable ? getJSON(key).catch(() => null) : Promise.resolve(null));
export const remember = (key, value, ttlSeconds) =>
  durable ? setJSON(key, value, ttlSeconds).catch(() => {}) : Promise.resolve();

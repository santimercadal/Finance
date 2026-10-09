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

export async function setJSON(key, value) {
  if (storageKind === "upstash") {
    await redis(["SET", key, JSON.stringify(value)]);
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, `${key}.json`), JSON.stringify(value, null, 2));
}

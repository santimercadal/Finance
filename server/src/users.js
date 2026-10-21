import crypto from "node:crypto";
import { promisify } from "node:util";
import { AsyncLocalStorage } from "node:async_hooks";
import { getJSON, setJSON, delJSON } from "./storage.js";
import { httpError } from "./util.js";

// Accounts: the owner signs in with APP_PASSWORD (admin); friends get their own
// name + password, created by the owner from the app. Each friend has a
// separate portfolio and preferences; eToro sync is only for the owner.

const scrypt = promisify(crypto.scrypt);
const PASSWORD = process.env.APP_PASSWORD ?? "";
export const authEnabled = Boolean(PASSWORD);

const ADMIN = { id: "admin", name: "Admin", admin: true };
const USERS_KEY = "users";
// Signs session tokens. Derived from APP_PASSWORD, so changing it signs everyone out.
const TOKEN_KEY = crypto.createHash("sha256").update(`tokens:${PASSWORD}`).digest();

// User making the current request (set by the auth middleware for the whole call).
const current = new AsyncLocalStorage();
export const runAs = (user, fn) => current.run(user, fn);
export const currentUser = () => current.getStore() ?? ADMIN;
export const isAdmin = () => currentUser().admin === true;

// Storage key for per-user data: the owner keeps the original keys so nothing
// existing moves; friends get a suffix.
export const userKey = (base) => (isAdmin() ? base : `${base}-${currentUser().id}`);

const sameSecret = (a, b) => {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};

let users = null; // [{ id, name, salt, hash, secret, createdAt }]
async function loadUsers() {
  users ??= (await getJSON(USERS_KEY)) ?? [];
  return users;
}
async function saveUsers(list) {
  await setJSON(USERS_KEY, list);
  users = list;
}

const hashPassword = async (password, salt) => (await scrypt(password, salt, 32)).toString("hex");

// Easy to dictate or type on a phone: no 0/O or 1/l/I.
function newPassword() {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  const pick = () => Array.from(crypto.randomBytes(4), (b) => chars[b % chars.length]).join("");
  return `${pick()}-${pick()}-${pick()}`;
}

const sign = (id, secret) => crypto.createHmac("sha256", TOKEN_KEY).update(`${id}.${secret}`).digest("base64url");
const tokenFor = (user) => `${user.id}.${sign(user.id, user.secret ?? "")}`;

// Who sent this x-app-key: a session token, or the raw APP_PASSWORD (sent by
// installs from before accounts existed). Null when it is not valid.
export async function userFromKey(key) {
  if (!key) return null;
  if (sameSecret(key, PASSWORD)) return ADMIN;
  const [id, sig] = key.split(".");
  if (!id || !sig) return null;
  if (id === ADMIN.id) return sameSecret(sig, sign(ADMIN.id, "")) ? ADMIN : null;
  const user = (await loadUsers()).find((u) => u.id === id);
  if (!user || !sameSecret(sig, sign(user.id, user.secret))) return null;
  return { id: user.id, name: user.name, admin: false };
}

// Failed sign-ins per IP, to slow down password guessing.
const failures = new Map(); // ip -> { count, until }
const MAX_FAILURES = 8;
const LOCK_MS = 15 * 60_000;

export async function login(ip, name, password) {
  const f = failures.get(ip);
  if (f && f.until > Date.now() && f.count >= MAX_FAILURES) {
    throw httpError(429, "Demasiados intentos. Probá de nuevo en 15 minutos.");
  }
  name = String(name ?? "").trim();
  password = String(password ?? "");
  let user = null;
  if (password && sameSecret(password, PASSWORD)) {
    user = ADMIN;
  } else if (name && password) {
    const found = (await loadUsers()).find((u) => u.name.toLowerCase() === name.toLowerCase());
    if (found && sameSecret(await hashPassword(password, found.salt), found.hash)) user = found;
  }
  if (!user) {
    const prev = f && f.until > Date.now() ? f.count : 0;
    failures.set(ip, { count: prev + 1, until: Date.now() + LOCK_MS });
    throw httpError(401, "Nombre o contraseña incorrectos");
  }
  failures.delete(ip);
  return { token: tokenFor(user), user: { name: user.name, admin: user.id === ADMIN.id } };
}

// --- Owner-only management -------------------------------------------------

function requireAdmin() {
  if (!isAdmin()) throw httpError(403, "Solo el administrador puede hacer esto");
  if (!authEnabled) throw httpError(400, "Configurá APP_PASSWORD en el servidor para usar cuentas de amigos");
}

const publicUser = (u) => ({ id: u.id, name: u.name, createdAt: u.createdAt });

export async function listUsers() {
  requireAdmin();
  return (await loadUsers()).map(publicUser);
}

export async function createUser(name) {
  requireAdmin();
  name = String(name ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 30) throw httpError(400, "El nombre debe tener entre 2 y 30 caracteres");
  const list = await loadUsers();
  if (name.toLowerCase() === ADMIN.name.toLowerCase() || list.some((u) => u.name.toLowerCase() === name.toLowerCase())) {
    throw httpError(409, `Ya existe un usuario llamado ${name}`);
  }
  const password = newPassword();
  const salt = crypto.randomBytes(16).toString("hex");
  const user = {
    id: crypto.randomBytes(6).toString("hex"),
    name,
    salt,
    hash: await hashPassword(password, salt),
    secret: crypto.randomBytes(8).toString("hex"),
    createdAt: new Date().toISOString(),
  };
  await saveUsers([...list, user]);
  return { user: publicUser(user), password };
}

// New password; the old one and every open session stop working.
export async function resetPassword(id) {
  requireAdmin();
  const list = await loadUsers();
  const user = list.find((u) => u.id === id);
  if (!user) throw httpError(404, "Usuario no encontrado");
  const password = newPassword();
  const salt = crypto.randomBytes(16).toString("hex");
  const updated = { ...user, salt, hash: await hashPassword(password, salt), secret: crypto.randomBytes(8).toString("hex") };
  await saveUsers(list.map((u) => (u.id === id ? updated : u)));
  return { user: publicUser(updated), password };
}

// Removes the account and its data; open sessions stop working right away.
export async function deleteUser(id) {
  requireAdmin();
  const list = await loadUsers();
  if (!list.some((u) => u.id === id)) throw httpError(404, "Usuario no encontrado");
  await saveUsers(list.filter((u) => u.id !== id));
  await Promise.all(["portfolio", "preferences"].map((k) => delJSON(`${k}-${id}`).catch(() => {})));
  return { ok: true };
}

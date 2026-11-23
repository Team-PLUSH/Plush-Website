// Passwords and signed session cookies for the team's private admin pages.
//
// Nothing secret lives in this repo (it is public). Everything comes from
// Vercel environment variables, set in the dashboard for Production:
//
//   ADMIN_PASSWORD         the built-in "owner" sign-in (username: owner), used
//                          to create everyone's personal accounts
//   ADMIN_SESSION_SECRET   a long random string (32+ chars) used to sign the
//                          session cookie, e.g. `openssl rand -base64 48`
//
// Personal accounts' passwords are stored in Redis as PBKDF2-SHA256 hashes
// (210,000 rounds, random salt per password), never in plain text.
//
// The session cookie is HttpOnly + Secure + SameSite=Strict and carries only an
// expiry time, a random session id and an HMAC over both — no data. The id is
// also recorded in Redis (see admin.functions.ts), so signing out really ends
// the session, even if someone had copied the cookie. Changing ADMIN_PASSWORD
// or ADMIN_SESSION_SECRET signs everyone out, because both feed the signing key.
//
// Only import this from inside server-function handlers.

export const ADMIN_COOKIE = "__Host-plush_admin";
export const ADMIN_SESSION_SECONDS = 12 * 60 * 60; // 12 hours

const encoder = new TextEncoder();

type AdminConfig = { password: string; secret: string };

function readEnv(name: string): string {
  const env = typeof process !== "undefined" ? (process.env ?? {}) : {};
  return (env[name] ?? "").trim();
}

/** The admin config, or null if it is missing or too weak to be safe. */
export function adminConfig(): AdminConfig | null {
  const password = readEnv("ADMIN_PASSWORD");
  const secret = readEnv("ADMIN_SESSION_SECRET");
  if (password.length < 12 || secret.length < 32) return null;
  return { password, secret };
}

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * A second password for the built-in "owner" sign-in, kept in the repo as a
 * PBKDF2 hash only (the repo is public — never commit a password itself). The
 * password is ~99 random bits, so the hash can't be brute-forced. To rotate
 * it, replace this with `hashPassword(newPassword)`; set it to "" to turn it off.
 */
const OWNER_PASSWORD_HASH =
  "pbkdf2$210000$NzCGntmqm36FMVfHqGQqyA$sLquy82MNNN5bxKbxq2Ru0EuzH_w4P0jSDz4u6Zk7RQ";

/**
 * True if `attempt` is the owner password: either ADMIN_PASSWORD (compared in
 * constant time, both sides hashed to the same length first) or the password
 * behind OWNER_PASSWORD_HASH. Both checks always run, so timing reveals nothing.
 */
export async function passwordMatches(attempt: string, cfg: AdminConfig): Promise<boolean> {
  const envMatch = equalBytes(await sha256(attempt), await sha256(cfg.password));
  const hashMatch = await verifyPassword(attempt, OWNER_PASSWORD_HASH || null);
  return envMatch || hashMatch;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string, cfg: AdminConfig): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`${cfg.secret}\u0000${cfg.password}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`plush-admin:${payload}`));
  return toBase64Url(new Uint8Array(mac));
}

export type Session = { id: string; expires: number };

/** A fresh session and its token: `<expiry ms>.<session id>.<signature>`. */
export async function createSession(cfg: AdminConfig): Promise<Session & { token: string }> {
  const expires = Date.now() + ADMIN_SESSION_SECONDS * 1000;
  const id = toBase64Url(crypto.getRandomValues(new Uint8Array(18)));
  return { id, expires, token: `${expires}.${id}.${await sign(`${expires}.${id}`, cfg)}` };
}

/** The session a token names, if its signature is right and it hasn't expired. */
export async function readSessionToken(
  token: string | undefined,
  cfg: AdminConfig,
): Promise<Session | null> {
  if (!token || token.length > 200) return null;
  const [expires, id, signature, ...rest] = token.split(".");
  if (!expires || !id || !signature || rest.length > 0) return null;
  if (!/^\d{1,16}$/.test(expires) || !/^[A-Za-z0-9_-]{24}$/.test(id)) return null;
  if (Number(expires) <= Date.now()) return null;
  const expected = await sign(`${expires}.${id}`, cfg);
  if (!equalBytes(encoder.encode(signature), encoder.encode(expected))) return null;
  return { id, expires: Number(expires) };
}

// ---- Personal account passwords ------------------------------------------

const PBKDF2_ROUNDS = 210_000;

async function pbkdf2(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  rounds: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: rounds },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** `pbkdf2$<rounds>$<salt>$<hash>`, safe to store. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ROUNDS);
  return `pbkdf2$${PBKDF2_ROUNDS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

/**
 * Checks a password against a stored hash in constant time. With no stored
 * hash (unknown username) it still does the same work, so response time
 * doesn't reveal which usernames exist.
 */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const parts = stored?.split("$") ?? [];
  const valid = parts.length === 4 && parts[0] === "pbkdf2" && /^\d{5,7}$/.test(parts[1]);
  const rounds = valid ? Number(parts[1]) : PBKDF2_ROUNDS;
  const salt = valid ? fromBase64Url(parts[2]) : new Uint8Array(16);
  const expected = valid ? fromBase64Url(parts[3]) : new Uint8Array(32);
  const actual = await pbkdf2(password, salt, rounds);
  return equalBytes(actual, expected) && valid;
}

const TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o, 1/l/i

/** A random one-time password like `k7mq-x2fh-9tnp-c4wr` (~79 bits). */
export function temporaryPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = [...bytes].map((b) => TEMP_ALPHABET[b % TEMP_ALPHABET.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

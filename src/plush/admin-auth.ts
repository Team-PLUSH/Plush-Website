// Password check and signed session cookie for the team's private admin pages.
//
// Nothing secret lives in this repo (it is public). Everything comes from
// Vercel environment variables, set in the dashboard for Production:
//
//   ADMIN_PASSWORD         the password the team types on /admin/inventory
//   ADMIN_SESSION_SECRET   a long random string (32+ chars) used to sign the
//                          session cookie, e.g. `openssl rand -base64 48`
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

/** Constant-time comparison: both sides are hashed to the same length first. */
export async function passwordMatches(attempt: string, cfg: AdminConfig): Promise<boolean> {
  return equalBytes(await sha256(attempt), await sha256(cfg.password));
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

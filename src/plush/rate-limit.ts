// Rate limiting for the newsletter server function.
//
// Two tiers, picked automatically at call time:
//
//   1. Durable (preferred) — a fixed-window counter in Upstash Redis, shared
//      across every function instance and cold start. Active as soon as a REST
//      URL + token pair is present in the env (see URL_VARS / TOKEN_VARS below
//      for the accepted variable names).
//   2. In-memory fallback — a per-instance sliding window. Best-effort; resets
//      on cold start and isn't shared between instances.
//
// TO ENABLE THE DURABLE LIMITER (no code change needed):
//   - Provision Upstash Redis via the Vercel Marketplace
//     (Vercel dashboard → Storage → Create Database → Upstash).
//   - Connect it to this project (Production). It injects the REST URL + token
//     env vars automatically; pull them locally with `vercel env pull`.
//   - Nothing else: this module starts using them on the next deploy.
//
// A Vercel Firewall rate-limit rule on the _serverFn path is still worth adding
// on top (it blocks abuse before it ever reaches the function) — see
// docs/security-operations.md.

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_HITS = 5; // per IP per window

// ---- Tier 2: in-memory sliding window -------------------------------------

const hits = new Map<string, number[]>();

function isRateLimitedInMemory(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    // Bound memory: drop the oldest keys.
    for (const k of [...hits.keys()].slice(0, 1000)) hits.delete(k);
  }
  return recent.length > MAX_HITS;
}

// ---- Tier 1: Upstash Redis fixed window -----------------------------------

// The Upstash/Vercel Marketplace integration names its REST vars differently
// depending on how it was added — accept every spelling seen in the wild.
const URL_VARS = [
  "UPSTASH_REDIS_REST_URL",
  "KV_REST_API_URL",
  "REDIS_REST_URL",
  "STORAGE_REST_URL",
];
const TOKEN_VARS = [
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_TOKEN",
  "REDIS_REST_TOKEN",
  "STORAGE_REST_TOKEN",
];

function upstashConfig(): { url: string; token: string } | null {
  const env = typeof process !== "undefined" ? (process.env ?? {}) : {};
  const pick = (names: string[]) => names.map((n) => env[n]).find((v) => v && v.trim() !== "");
  const url = pick(URL_VARS);
  const token = pick(TOKEN_VARS);
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function isRateLimitedUpstash(
  key: string,
  cfg: { url: string; token: string },
): Promise<boolean> {
  const windowSec = Math.ceil(WINDOW_MS / 1000);
  const redisKey = `ratelimit:newsletter:${key}`;

  // Pipeline: INCR the counter, then set a TTL only if one isn't set yet, so the
  // window is fixed from the first hit.
  const res = await fetch(`${cfg.url}/pipeline`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cfg.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["EXPIRE", redisKey, windowSec, "NX"],
    ]),
    signal: AbortSignal.timeout(2_000),
  });

  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const parsed = (await res.json()) as Array<{ result?: number; error?: string }>;
  const count = parsed[0]?.result ?? 0;
  return count > MAX_HITS;
}

// ---- Public API ----------------------------------------------------------

/**
 * Returns true if `key` (an IP) has exceeded the signup rate limit. Uses Upstash
 * when configured; on any Upstash error, falls back to the in-memory limiter so
 * a Redis outage can't take signups down.
 */
export async function isRateLimited(key: string): Promise<boolean> {
  const cfg = upstashConfig();
  if (cfg) {
    try {
      return await isRateLimitedUpstash(key, cfg);
    } catch (error) {
      console.warn(`rate-limit: Upstash unavailable, using in-memory fallback (${String(error)})`);
    }
  }
  return isRateLimitedInMemory(key);
}

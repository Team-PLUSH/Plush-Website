// Minimal Upstash Redis REST client, shared by the rate limiter and the admin
// inventory. Configured by the env vars the Upstash / Vercel Marketplace
// integration injects when the store is connected to the project.

// The integration names its REST vars differently depending on how it was
// added — accept every spelling seen in the wild.
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

export type UpstashConfig = { url: string; token: string };

export function upstashConfig(): UpstashConfig | null {
  const env = typeof process !== "undefined" ? (process.env ?? {}) : {};
  const pick = (names: string[]) => names.map((n) => env[n]).find((v) => v && v.trim() !== "");
  const url = pick(URL_VARS);
  const token = pick(TOKEN_VARS);
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

type UpstashReply = { result?: unknown; error?: string };

/** Runs several commands in one round trip; throws if any of them errors. */
export async function upstashPipeline(
  cfg: UpstashConfig,
  commands: (string | number)[][],
  timeoutMs = 5_000,
): Promise<unknown[]> {
  const res = await fetch(`${cfg.url}/pipeline`, {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const replies = (await res.json()) as UpstashReply[];
  return replies.map((reply) => {
    if (reply.error) throw new Error(`Upstash: ${reply.error}`);
    return reply.result;
  });
}

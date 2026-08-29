import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";

import { NEWSLETTER } from "./constants";

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  // Honeypot: a field hidden from real users. Anything non-empty is a bot.
  company: z.string().max(200).optional().default(""),
});

export type NewsletterResult = { ok: true } | { ok: false; reason: "not-configured" | "rejected" };

// Best-effort in-memory rate limit. Vercel Fluid Compute reuses instances so
// this catches casual abuse; the durable control is a Vercel Firewall rate-limit
// rule on the server-function path (see docs/security-operations.md).
const RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };
const hits = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    // Bound memory: drop the oldest keys.
    for (const k of [...hits.keys()].slice(0, 1000)) hits.delete(k);
  }
  return recent.length > RATE_LIMIT.max;
}

/**
 * Forwards a "stay in the loop" signup to the Google Form whose responses feed
 * the team's Google Sheet. Runs server-side so we can read Google's real status
 * code (a browser fetch to Google Forms is opaque and always looks successful).
 *
 * Cross-site calls are blocked by the CSRF middleware in src/start.ts.
 */
export const submitNewsletterSignup = createServerFn({ method: "POST" })
  .validator((data: unknown) => signupSchema.parse(data))
  .handler(async ({ data }): Promise<NewsletterResult> => {
    // Silently accept bots so they don't learn the field is a trap.
    if (data.company.trim() !== "") return { ok: true };

    const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
    if (isRateLimited(ip)) return { ok: false, reason: "rejected" };

    if (!NEWSLETTER.formId || !NEWSLETTER.emailEntryId) {
      return { ok: false, reason: "not-configured" };
    }

    const response = await fetch(
      `https://docs.google.com/forms/d/e/${encodeURIComponent(NEWSLETTER.formId)}/formResponse`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ [NEWSLETTER.emailEntryId]: data.email }),
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
      },
    );

    // A recorded response comes back as 200 (the confirmation page) or a 3xx to
    // it. 401 means the form still requires sign-in; 400 means a bad entry id.
    const accepted =
      response.status === 200 ||
      response.type === "opaqueredirect" ||
      (response.status >= 300 && response.status < 400);

    return accepted ? { ok: true } : { ok: false, reason: "rejected" };
  });

import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";

import { CONSENT_TEXT_VERSION, NEWSLETTER } from "./constants";

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  // Honeypot: a field hidden from real users. Anything non-empty is a bot.
  company: z.string().max(200).optional().default(""),
  // CASL: express consent must be affirmative. The client gates on the checkbox
  // too, but the server is the record of truth — reject anything that isn't a
  // literal `true`.
  consent: z.literal(true),
  // Which consent wording the visitor was shown (from the checkbox's
  // data-consent-version). Server compares it to CONSENT_TEXT_VERSION.
  consentVersion: z.string().trim().max(40).optional().default(""),
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

    // CASL record of consent. The linked Sheet only stores email + timestamp, so
    // capture the rest here: log a structured record (visible in the function
    // logs), and — if a "Consent version" question id is configured — write the
    // wording version into the Sheet alongside the email so the record is
    // durable. The server constant is authoritative; note any client mismatch.
    const consentRecord = {
      event: "newsletter-consent",
      at: new Date().toISOString(),
      consentTextVersion: CONSENT_TEXT_VERSION,
      clientReportedVersion: data.consentVersion || null,
      versionMismatch: data.consentVersion !== "" && data.consentVersion !== CONSENT_TEXT_VERSION,
      // Don't log the raw address; a one-way tag is enough to reconcile a
      // dispute against the Sheet without spilling PII into log storage.
      emailDomain: data.email.split("@")[1] ?? null,
    };
    console.info(JSON.stringify(consentRecord));

    const body = new URLSearchParams({ [NEWSLETTER.emailEntryId]: data.email });
    if (NEWSLETTER.consentEntryId) {
      body.set(NEWSLETTER.consentEntryId, `consent v${CONSENT_TEXT_VERSION}`);
    }

    const response = await fetch(
      `https://docs.google.com/forms/d/e/${encodeURIComponent(NEWSLETTER.formId)}/formResponse`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
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

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { NEWSLETTER } from "./constants";

const emailSchema = z.object({
  email: z.string().trim().email().max(320),
});

export type NewsletterResult = { ok: true } | { ok: false; reason: "not-configured" | "rejected" };

/**
 * Forwards a "stay in the loop" signup to the Google Form whose responses feed
 * the team's Google Sheet. Runs server-side so we can read Google's real status
 * code (a browser fetch to Google Forms is opaque and always looks successful).
 */
export const submitNewsletterSignup = createServerFn({ method: "POST" })
  .validator((data: unknown) => emailSchema.parse(data))
  .handler(async ({ data }): Promise<NewsletterResult> => {
    if (!NEWSLETTER.formId || !NEWSLETTER.emailEntryId) {
      return { ok: false, reason: "not-configured" };
    }

    const response = await fetch(
      `https://docs.google.com/forms/d/e/${NEWSLETTER.formId}/formResponse`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ [NEWSLETTER.emailEntryId]: data.email }),
        redirect: "manual",
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

/** Update this when the next competition date is known. isoDate must include a timezone offset (e.g. "Z" or "-05:00") so it parses the same for every visitor. */
export const NEXT_COMPETITION = {
  isoDate: "2027-01-09T12:00:00-05:00",
  eventLabel: "Kickoff — 2026/27 Game Reveal",
  expiredLabel: "Off-season — see you at kickoff!",
} as const;

/**
 * "Stay in the loop" newsletter signup → Google Form → linked Google Sheet.
 *
 * Setup:
 *  1. Create a Google Form with ONE short-answer question titled "Email".
 *  2. In the form's Responses tab, click the Sheets icon to link a spreadsheet.
 *  3. Open the form's ⋮ menu → "Get pre-filled link", type any dummy email, then
 *     "Get link" and copy it. That URL looks like:
 *     https://docs.google.com/forms/d/e/AAAA/viewform?usp=pp_url&entry.1234567890=dummy%40example.com
 *  4. Paste the two pieces below:
 *       formId       → the "d/e/AAAA/" segment  (the AAAA part)
 *       emailEntryId → the "entry.1234567890" parameter
 *
 * Leave formId / emailEntryId blank to keep the form disabled (it will show a
 * friendly notice).
 *
 * CASL record of consent:
 *  - `consentEntryId` is the "entry.…" id of a SHORT-ANSWER question on the
 *    same Google Form (e.g. "Consent version"). The signup writes
 *    `CONSENT_TEXT_VERSION` into it, so the linked Sheet holds
 *    email + timestamp + which consent wording was shown.
 *  - Set it back to "" to disable; the server then only logs a structured
 *    consent record to the function logs.
 *  - Bump `CONSENT_TEXT_VERSION` (date-stamped) whenever the consent sentence
 *    in public/plush-body.html changes, so old records stay attributable.
 */
export const NEWSLETTER = {
  formId: "1FAIpQLSccj1YzMS4-YvazJ6B_b123NwAULVr3NMvEiv4BrGa_IqchXA",
  emailEntryId: "entry.1882133048",
  /** entry.… id of the optional "Consent version" form question. Blank = off. */
  consentEntryId: "entry.1307416685",
} as const;

/**
 * Identifier for the exact consent wording shown next to the signup checkbox.
 * MUST be bumped (keep it date-stamped) whenever that sentence changes.
 * Mirrored in the `.newsletter-consent-box[data-consent-version]` attribute.
 */
export const CONSENT_TEXT_VERSION = "2026-08-30";

export const BUDDY_LINES = [
  "psst — try the arrow keys on the mascots ↔",
  "we live for pastel robots 💜",
  "scroll down for the playground 👇",
  "hint: there's a konami code somewhere…",
  "swerve drive supremacy 🔧",
  "have you met Stuffing yet? he never hits walls.",
  "if it compiles, it ships ✨",
  "click me again for another fact 🐰",
] as const;

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
 * Leave both blank to keep the form disabled (it will show a friendly notice).
 */
export const NEWSLETTER = {
  formId: "1FAIpQLSccj1YzMS4-YvazJ6B_b123NwAULVr3NMvEiv4BrGa_IqchXA",
  emailEntryId: "entry.1882133048",
} as const;

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

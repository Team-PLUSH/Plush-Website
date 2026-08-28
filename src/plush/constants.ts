/** Update this when the next competition date is known. isoDate must include a timezone offset (e.g. "Z" or "-05:00") so it parses the same for every visitor. */
export const NEXT_COMPETITION = {
  isoDate: "2027-01-09T12:00:00-05:00",
  eventLabel: "Kickoff — 2026/27 Game Reveal",
  expiredLabel: "Off-season — see you at kickoff!",
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

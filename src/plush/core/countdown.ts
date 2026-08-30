import { NEXT_COMPETITION } from "../constants";
import type { Cleanup } from "../types";

const COUNTDOWN_IDS = ["cdDays", "cdHours", "cdMins", "cdSecs"] as const;

function setCountdownValue(id: string, value: string) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function showExpiredState() {
  COUNTDOWN_IDS.forEach((id) => setCountdownValue(id, "—"));

  const label = document.querySelector<HTMLElement>(".countdown-label");
  const event = document.querySelector<HTMLElement>(".countdown-event");
  if (label) label.textContent = "⏱ season status";
  if (event) event.textContent = NEXT_COMPETITION.expiredLabel;
}

function updateCountdown() {
  const target = new Date(NEXT_COMPETITION.isoDate);
  const diff = target.getTime() - Date.now();

  if (diff <= 0) {
    showExpiredState();
    return;
  }

  const event = document.querySelector<HTMLElement>(".countdown-event");
  if (event) event.textContent = `🏟 ${NEXT_COMPETITION.eventLabel}`;

  setCountdownValue("cdDays", String(Math.floor(diff / 86_400_000)).padStart(2, "0"));
  setCountdownValue(
    "cdHours",
    String(Math.floor((diff % 86_400_000) / 3_600_000)).padStart(2, "0"),
  );
  setCountdownValue("cdMins", String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, "0"));
  setCountdownValue("cdSecs", String(Math.floor((diff % 60_000) / 1_000)).padStart(2, "0"));
}

export function mountCountdown(): Cleanup {
  updateCountdown();
  const intervalId = window.setInterval(updateCountdown, 1_000);
  return () => window.clearInterval(intervalId);
}

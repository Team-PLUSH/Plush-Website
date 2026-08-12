import { BUDDY_LINES } from "../constants";
import type { Cleanup } from "../types";

export function mountBuddy(): Cleanup {
  document.getElementById("plush-buddy")?.remove();
  document.getElementById("plush-buddy-bubble")?.remove();

  const buddy = document.createElement("div");
  buddy.id = "plush-buddy";
  buddy.setAttribute("role", "button");
  buddy.setAttribute("aria-label", "Plush buddy — click for a fact");
  buddy.innerHTML = `
    <svg viewBox="0 0 100 100" width="78" height="78" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="92" rx="24" ry="4" fill="#0d1120" opacity=".2"/>
      <rect x="20" y="30" width="60" height="52" rx="18" fill="#bfa8d8" stroke="#2c3a58" stroke-width="2"/>
      <rect x="28" y="40" width="44" height="26" rx="10" fill="#e8dff5" stroke="#2c3a58" stroke-width="1.5"/>
      <circle class="buddy-eye" cx="42" cy="53" r="4" fill="#2c3a58"/>
      <circle class="buddy-eye" cx="58" cy="53" r="4" fill="#2c3a58"/>
      <circle cx="43" cy="52" r="1.2" fill="#fff"/>
      <circle cx="59" cy="52" r="1.2" fill="#fff"/>
      <path d="M42 72 Q50 78 58 72" stroke="#2c3a58" stroke-width="2" fill="none" stroke-linecap="round"/>
      <line x1="50" y1="18" x2="50" y2="30" stroke="#2c3a58" stroke-width="2"/>
      <circle cx="50" cy="15" r="4" fill="#a4c9b0" stroke="#2c3a58" stroke-width="1.5"/>
      <g class="buddy-wave"><rect x="72" y="46" width="18" height="7" rx="3" fill="#bfa8d8" stroke="#2c3a58" stroke-width="1.5"/></g>
      <rect x="10" y="46" width="14" height="7" rx="3" fill="#bfa8d8" stroke="#2c3a58" stroke-width="1.5"/>
    </svg>`;

  const bubble = document.createElement("div");
  bubble.id = "plush-buddy-bubble";
  document.body.appendChild(buddy);
  document.body.appendChild(bubble);

  let lineIndex = 0;
  let hideTimer = 0;

  const say = (message: string) => {
    bubble.textContent = message;
    bubble.classList.add("show");
    buddy.classList.add("talking");
    window.setTimeout(() => buddy.classList.remove("talking"), 500);
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => bubble.classList.remove("show"), 4200);
  };

  const onClick = () => say(BUDDY_LINES[lineIndex++ % BUDDY_LINES.length]);
  buddy.addEventListener("click", onClick);
  const introTimer = window.setTimeout(() => say("hi! i'm your build buddy 👋"), 2500);

  return () => {
    window.clearTimeout(introTimer);
    window.clearTimeout(hideTimer);
    buddy.removeEventListener("click", onClick);
    buddy.remove();
    bubble.remove();
  };
}

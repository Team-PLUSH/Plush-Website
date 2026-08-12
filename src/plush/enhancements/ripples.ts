import type { Cleanup } from "../types";

const BUTTON_SELECTOR =
  ".cta-dark, .cta-light, .btn-inv, .btn-ghost, .nav-pill, .playground-btn, .newsletter-btn, .social-btn";

export function mountRipples(): Cleanup {
  const onClick = (event: MouseEvent) => {
    const btn = (event.target as HTMLElement).closest<HTMLElement>(BUTTON_SELECTOR);
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const dot = document.createElement("span");
    dot.className = "plush-ripple";
    const size = 12;
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.left = `${event.clientX - rect.left}px`;
    dot.style.top = `${event.clientY - rect.top}px`;

    if (getComputedStyle(btn).position === "static") btn.style.position = "relative";
    btn.style.overflow ||= "hidden";
    btn.appendChild(dot);
    window.setTimeout(() => dot.remove(), 650);
  };

  document.addEventListener("click", onClick);
  return () => document.removeEventListener("click", onClick);
}

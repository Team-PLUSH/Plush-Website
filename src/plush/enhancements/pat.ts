import type { Cleanup } from "../types";

const PAT_TARGET_SELECTOR = ".sticker, #mascotFigure";
const HEART_SYMBOLS = ["💜", "✨", "💫"];
const MILESTONE_EVERY = 10;

const comboCounts = new WeakMap<Element, number>();

function spawnBurst(target: HTMLElement, big: boolean) {
  const rect = target.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const symbols = big ? [...HEART_SYMBOLS, "⚙️", "⚙️", "✨"] : HEART_SYMBOLS;
  const count = big ? 10 : 4;

  for (let i = 0; i < count; i++) {
    const particle = document.createElement("span");
    particle.className = "plush-pat-particle";
    particle.textContent = symbols[(Math.random() * symbols.length) | 0];
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const dist = big ? 60 + Math.random() * 50 : 30 + Math.random() * 24;
    particle.style.left = `${cx}px`;
    particle.style.top = `${cy}px`;
    particle.style.fontSize = big ? "1.4rem" : "1.05rem";
    particle.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    particle.style.setProperty("--dy", `${Math.sin(angle) * dist - dist * 0.4}px`);
    document.body.appendChild(particle);
    window.setTimeout(() => particle.remove(), 900);
  }
}

export function mountPatInteractions(): Cleanup {
  const onClick = (event: MouseEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(PAT_TARGET_SELECTOR);
    if (!target) return;

    const count = (comboCounts.get(target) ?? 0) + 1;
    comboCounts.set(target, count);
    const milestone = count % MILESTONE_EVERY === 0;

    target.classList.remove("pat-squish", "pat-squish-big");
    void target.offsetWidth;
    target.classList.add(milestone ? "pat-squish-big" : "pat-squish");
    window.setTimeout(() => target.classList.remove("pat-squish", "pat-squish-big"), 420);

    spawnBurst(target, milestone);
  };

  document.addEventListener("click", onClick);
  return () => document.removeEventListener("click", onClick);
}

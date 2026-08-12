import type { Cleanup } from "../types";

const KONAMI_SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
] as const;

export function mountKonami(): Cleanup {
  let progress = 0;
  const emojis = ["🐱", "🐰", "🐻", "💜", "💙", "💚", "✨", "🤖", "⚙️", "🎀"];

  const triggerRain = () => {
    const toast = document.createElement("div");
    toast.id = "plush-konami-toast";
    toast.textContent = "✦ plushie rain unlocked ✦";
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    window.setTimeout(() => {
      toast.classList.remove("show");
      window.setTimeout(() => toast.remove(), 400);
    }, 1800);

    for (let n = 0; n < 80; n++) {
      const drop = document.createElement("div");
      drop.className = "plush-rain-drop";
      drop.textContent = emojis[(Math.random() * emojis.length) | 0];
      drop.style.left = `${Math.random() * 100}vw`;
      drop.style.animationDuration = `${3 + Math.random() * 3}s`;
      drop.style.animationDelay = `${Math.random() * 1.2}s`;
      drop.style.fontSize = `${1.6 + Math.random() * 2}rem`;
      document.body.appendChild(drop);
      window.setTimeout(() => drop.remove(), 7000);
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === KONAMI_SEQUENCE[progress]) {
      progress++;
      if (progress === KONAMI_SEQUENCE.length) {
        progress = 0;
        triggerRain();
      }
      return;
    }

    progress = key === KONAMI_SEQUENCE[0] ? 1 : 0;
  };

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}

import type { Cleanup } from "../types";

export function mountHeroParallax(): Cleanup {
  const hero = document.querySelector<HTMLElement>(".hero");
  const smears = Array.from(document.querySelectorAll<HTMLElement>(".smear"));
  const word = document.querySelector<HTMLElement>(".hero-wordmark .word");
  if (!hero) return () => {};

  const onMove = (event: MouseEvent) => {
    const rect = hero.getBoundingClientRect();
    if (event.clientY < rect.top || event.clientY > rect.bottom) return;

    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;

    smears.forEach((smear, index) => {
      const strength = (index + 1) * 8;
      smear.style.setProperty(
        "transform",
        `translate(${px * strength}px, ${py * strength}px) rotate(${(index - 1) * 1.5}deg)`,
      );
    });

    if (word) {
      word.style.transform = `translate(${px * 12}px, ${py * 8}px)`;
    }
  };

  hero.addEventListener("mousemove", onMove);
  return () => hero.removeEventListener("mousemove", onMove);
}

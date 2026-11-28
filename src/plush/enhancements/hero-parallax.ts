import type { Cleanup } from "../types";

/**
 * Gentle depth on the hero portraits: each [data-parallax] element drifts with
 * the pointer by its own strength (in px). Pointer-only, and off entirely for
 * people who ask for reduced motion.
 */
export function mountHeroParallax(): Cleanup {
  const hero = document.querySelector<HTMLElement>(".hero");
  if (!hero) return () => {};
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return () => {};

  const layers = Array.from(hero.querySelectorAll<HTMLElement>("[data-parallax]"));
  if (!layers.length) return () => {};

  let raf = 0;
  let px = 0;
  let py = 0;

  const apply = () => {
    raf = 0;
    layers.forEach((layer) => {
      const strength = Number(layer.dataset.parallax) || 8;
      layer.style.translate = `${px * strength}px ${py * strength}px`;
    });
  };

  const onMove = (event: MouseEvent) => {
    const rect = hero.getBoundingClientRect();
    px = (event.clientX - rect.left) / rect.width - 0.5;
    py = (event.clientY - rect.top) / rect.height - 0.5;
    if (!raf) raf = requestAnimationFrame(apply);
  };

  const onLeave = () => {
    px = 0;
    py = 0;
    if (!raf) raf = requestAnimationFrame(apply);
  };

  hero.addEventListener("mousemove", onMove);
  hero.addEventListener("mouseleave", onLeave);
  return () => {
    cancelAnimationFrame(raf);
    hero.removeEventListener("mousemove", onMove);
    hero.removeEventListener("mouseleave", onLeave);
    layers.forEach((layer) => (layer.style.translate = ""));
  };
}

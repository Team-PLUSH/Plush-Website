import type { Cleanup } from "../types";

// Only the scrapbook bits wobble: mascot stickers and the hero polaroids.
const CARD_SELECTOR = ".sticker, .polaroid";

export function mountCardTilt(): Cleanup {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};

  const nodes = Array.from(document.querySelectorAll<HTMLElement>(CARD_SELECTOR));
  nodes.forEach((node) => node.classList.add("tilt-shine"));

  const observer = new MutationObserver(() => {
    document
      .querySelectorAll<HTMLElement>(CARD_SELECTOR)
      .forEach((node) => node.classList.add("tilt-shine"));
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const onMove = (event: MouseEvent) => {
    const el = (event.target as HTMLElement).closest<HTMLElement>(CARD_SELECTOR);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);

    const rotateX = (0.5 - py) * 16;
    const rotateY = (px - 0.5) * 16;
    el.style.transform = `perspective(500px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
  };

  const onLeave = (event: MouseEvent) => {
    const el = (event.target as HTMLElement).closest<HTMLElement>(CARD_SELECTOR);
    if (!el) return;
    el.style.transform = "";
  };

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseout", onLeave);

  return () => {
    observer.disconnect();
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseout", onLeave);
    document.querySelectorAll<HTMLElement>(CARD_SELECTOR).forEach((node) => {
      node.classList.remove("tilt-shine");
      node.style.transform = "";
    });
  };
}

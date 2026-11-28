import { BUDDY_LINES } from "../constants";
import type { Cleanup } from "../types";

/**
 * Patting one of the hero stickers makes the speech bubble above them say
 * the next line from BUDDY_LINES, so the mascots "talk" back.
 */
export function mountStickerChat(): Cleanup {
  const bubble = document.querySelector<HTMLElement>(".hero-bubble");
  if (!bubble) return () => {};

  let index = 0;
  const onClick = (event: MouseEvent) => {
    if (!(event.target as HTMLElement).closest(".hero .sticker")) return;
    index = (index + 1) % BUDDY_LINES.length;
    bubble.textContent = BUDDY_LINES[index];
    bubble.classList.remove("bubble-pop");
    void bubble.offsetWidth;
    bubble.classList.add("bubble-pop");
  };

  document.addEventListener("click", onClick);
  return () => document.removeEventListener("click", onClick);
}

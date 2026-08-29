import type { Cleanup, CursorType } from "../types";

const STORAGE_KEY = "plush-cursor";
const CURSOR_EMOJIS: Record<Exclude<CursorType, "none">, string> = {
  cat: "🐱",
  bunny: "🐰",
  bear: "🐻",
};

function normalizeCursor(value: string | null): CursorType {
  if (value === "cat" || value === "bunny" || value === "bear" || value === "none") {
    return value;
  }
  return "none";
}

export function mountCursor(): Cleanup {
  window.__plushCursorCleanup?.();

  const cursorEl = document.getElementById("custom-cursor");
  if (!cursorEl) return () => {};

  let cursorActive = normalizeCursor(localStorage.getItem(STORAGE_KEY));

  const setCursor = (type: CursorType) => {
    document.body.classList.remove("cursor-cat", "cursor-bunny", "cursor-bear");
    document.querySelectorAll<HTMLElement>(".cursor-btn").forEach((btn) => btn.classList.remove("active"));

    if (type === "none") {
      cursorActive = "none";
      cursorEl.style.display = "none";
    } else {
      cursorActive = type;
      document.body.classList.add(`cursor-${type}`);
      cursorEl.textContent = CURSOR_EMOJIS[type];
      cursorEl.style.display = "block";

      const activeBtn = document.getElementById(
        `cursor${type.charAt(0).toUpperCase()}${type.slice(1)}`,
      );
      activeBtn?.classList.add("active");
    }

    localStorage.setItem(STORAGE_KEY, type);
  };

  setCursor(cursorActive);

  const buttonBindings: Array<{ el: HTMLElement; type: CursorType }> = [];
  const bind = (id: string, type: CursorType) => {
    const el = document.getElementById(id);
    if (!el) return;
    const handler = () => setCursor(type);
    el.addEventListener("click", handler);
    buttonBindings.push({ el, type });
    el.dataset.cursorBound = "true";
    (el as HTMLElement & { __cursorHandler?: () => void }).__cursorHandler = handler;
  };
  bind("cursorCat", "cat");
  bind("cursorBunny", "bunny");
  bind("cursorBear", "bear");
  document.querySelectorAll<HTMLElement>(".cursor-btn-off").forEach((el) => {
    const handler = () => setCursor("none");
    el.addEventListener("click", handler);
    (el as HTMLElement & { __cursorHandler?: () => void }).__cursorHandler = handler;
    buttonBindings.push({ el, type: "none" });
  });

  const onMove = (event: MouseEvent) => {
    if (cursorActive === "none") return;
    cursorEl.style.left = `${event.clientX}px`;
    cursorEl.style.top = `${event.clientY}px`;
  };

  const hideCursor = () => {
    if (cursorActive !== "none") cursorEl.style.display = "none";
  };

  const showCursor = () => {
    if (cursorActive !== "none") cursorEl.style.display = "block";
  };

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseleave", hideCursor);
  document.addEventListener("mouseenter", showCursor);

  const cleanup = () => {
    delete window.__plushCursorCleanup;
    buttonBindings.forEach(({ el }) => {
      const bound = el as HTMLElement & { __cursorHandler?: () => void };
      if (bound.__cursorHandler) {
        el.removeEventListener("click", bound.__cursorHandler);
        delete bound.__cursorHandler;
      }
    });
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseleave", hideCursor);
    document.removeEventListener("mouseenter", showCursor);
  };

  window.__plushCursorCleanup = cleanup;
  return cleanup;
}

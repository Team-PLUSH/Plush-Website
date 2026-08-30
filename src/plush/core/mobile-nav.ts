import type { Cleanup } from "../types";

const DESKTOP_BREAKPOINT = 720;

/** Wires the mobile hamburger menu: toggle, outside-click, Escape, and resize. */
export function mountMobileNav(): Cleanup {
  const nav = document.querySelector<HTMLElement>(".site-topbar nav");
  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("primaryNav");

  if (!nav || !toggle || !links) return () => {};

  const setOpen = (open: boolean) => {
    nav.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };

  const onToggle = (event: Event) => {
    event.stopPropagation();
    setOpen(!nav.classList.contains("nav-open"));
  };

  // A tap on any nav destination should dismiss the menu (routing.ts handles the navigation itself).
  const onLinksClick = (event: Event) => {
    if ((event.target as HTMLElement).closest("[data-page]")) setOpen(false);
  };

  const onDocumentClick = (event: Event) => {
    if (!nav.contains(event.target as Node)) setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") setOpen(false);
  };

  const onResize = () => {
    if (window.innerWidth > DESKTOP_BREAKPOINT) setOpen(false);
  };

  toggle.addEventListener("click", onToggle);
  links.addEventListener("click", onLinksClick);
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", onResize);

  return () => {
    toggle.removeEventListener("click", onToggle);
    links.removeEventListener("click", onLinksClick);
    document.removeEventListener("click", onDocumentClick);
    document.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("resize", onResize);
  };
}

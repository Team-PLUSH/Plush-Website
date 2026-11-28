import type { Cleanup } from "../types";

const HOME = "home";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let fadeObserver: IntersectionObserver | null = null;

function triggerPageFades(page: HTMLElement) {
  fadeObserver?.disconnect();
  const fades = page.querySelectorAll<HTMLElement>(".fade");

  if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
    fades.forEach((el) => el.classList.add("in"));
    return;
  }

  fades.forEach((el) => {
    el.classList.remove("in");
    void el.offsetWidth;
  });

  fadeObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          fadeObserver?.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
  );

  fades.forEach((el) => fadeObserver?.observe(el));
}

function pageExists(pageId: string) {
  return Boolean(document.getElementById(`page-${pageId}`));
}

/** The page named in the URL hash ("#about" → "about"), or null when the hash isn't a page. */
function pageFromHash(): string | null {
  const id = decodeURIComponent(window.location.hash.replace(/^#\/?/, ""));
  return id && pageExists(id) ? id : null;
}

export function navigate(pageId: string, options: { push?: boolean; focus?: boolean } = {}) {
  const target = document.getElementById(`page-${pageId}`);
  if (!target) return;

  document
    .querySelectorAll<HTMLElement>(".page")
    .forEach((page) => page.classList.remove("active"));
  document.querySelectorAll<HTMLAnchorElement>(".nav-links a[data-page]").forEach((link) => {
    const isCurrent = link.dataset.page === pageId;
    link.classList.toggle("active", isCurrent);
    if (isCurrent) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  target.classList.add("active");

  if (options.push) {
    const url = pageId === HOME ? window.location.pathname : `#${pageId}`;
    if (url !== `${window.location.pathname}${window.location.hash}`) {
      window.history.pushState({ page: pageId }, "", url);
    }
  }

  window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  triggerPageFades(target);

  // Move focus to the new content so keyboard and screen-reader users land on
  // the page they just opened, not on the link they clicked in the old one.
  if (options.focus) {
    document.getElementById("site-main")?.focus({ preventScroll: true });
  }
}

export function mountRouting(): Cleanup {
  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const trigger = (event.target as HTMLElement).closest<HTMLElement>("[data-page]");
    const pageId = trigger?.dataset.page;
    if (!pageId || !pageExists(pageId)) return;

    event.preventDefault();
    navigate(pageId, { push: true, focus: true });
  };

  const onPopState = () => {
    const page = pageFromHash();
    // A non-page fragment (e.g. the "#site-main" skip link) is in-page
    // navigation, not a route change; leave the current page alone.
    if (!page && window.location.hash) return;
    navigate(page ?? HOME, { focus: true });
  };

  document.addEventListener("click", onClick);
  window.addEventListener("popstate", onPopState);

  // Deep links: frc11740.ca/#sponsors opens the sponsors page directly.
  const initial = pageFromHash();
  if (initial && initial !== HOME) {
    navigate(initial);
  } else {
    const active = document.querySelector<HTMLElement>(".page.active");
    if (active) triggerPageFades(active);
  }

  return () => {
    fadeObserver?.disconnect();
    document.removeEventListener("click", onClick);
    window.removeEventListener("popstate", onPopState);
  };
}

import type { Cleanup } from "../types";

function triggerPageFades(page: HTMLElement) {
  page.querySelectorAll<HTMLElement>(".fade").forEach((el) => {
    el.classList.remove("in");
    void el.offsetWidth;
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08 },
  );

  page.querySelectorAll<HTMLElement>(".fade").forEach((el) => observer.observe(el));
}

export function navigate(pageId: string) {
  document.querySelectorAll<HTMLElement>(".page").forEach((page) => page.classList.remove("active"));
  document.querySelectorAll<HTMLAnchorElement>(".nav-links a").forEach((link) => {
    link.classList.toggle("active", link.dataset.page === pageId);
  });

  const target = document.getElementById(`page-${pageId}`);
  if (!target) return;

  target.classList.add("active");
  window.scrollTo(0, 0);
  triggerPageFades(target);
}

export function mountRouting(): Cleanup {
  const onClick = (event: MouseEvent) => {
    const trigger = (event.target as HTMLElement).closest<HTMLElement>("[data-page]");
    if (!trigger?.dataset.page) return;
    event.preventDefault();
    navigate(trigger.dataset.page);
  };

  document.addEventListener("click", onClick);

  const introTimer = window.setTimeout(() => {
    document.querySelectorAll<HTMLElement>("#page-home .fade").forEach((el) => el.classList.add("in"));
  }, 80);

  return () => {
    window.clearTimeout(introTimer);
    document.removeEventListener("click", onClick);
  };
}

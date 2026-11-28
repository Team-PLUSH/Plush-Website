import type { Cleanup } from "../types";

/**
 * Which season stage (data-stage on .season-stop) we're in today, or null in
 * the May–August gap. Approximate on purpose: kickoff is early January, design
 * runs about two weeks, then build until districts in March.
 */
function currentStage(now = new Date()): number | null {
  const month = now.getMonth(); // 0 = January
  const day = now.getDate();
  if (month >= 8) return 1; // Sep–Dec: offseason & preseason
  if (month === 0) return day < 11 ? 2 : day < 25 ? 3 : 4;
  if (month === 1) return 4; // February: build
  if (month === 2) return 5; // March: districts
  if (month === 3) return 6; // April: provincials
  return null;
}

export function mountTrackRoadmap(): Cleanup {
  const graph = document.querySelector<HTMLElement>(".season-path");
  const svg = graph?.querySelector<SVGSVGElement>("svg");
  const path = svg?.querySelector<SVGPathElement>("#trackPath");
  if (!graph || !svg || !path) return () => {};

  const stage = currentStage();
  let nowStop: HTMLElement | null = null;
  graph.querySelectorAll<HTMLElement>(".season-stop").forEach((stop) => {
    const isNow = stage !== null && stop.dataset.stage === String(stage);
    stop.classList.toggle("is-now", isNow);
    if (isNow) {
      stop.setAttribute("aria-current", "step");
      nowStop = stop;
    } else stop.removeAttribute("aria-current");
  });

  // The drawn (violet) line is progress: it runs from the start through
  // today's stage, and the grey rule beneath shows the rest of the season.
  const drawToNow = () => {
    const width = graph.clientWidth;
    if (!width) return;
    const end = nowStop ? (nowStop.offsetLeft + nowStop.offsetWidth) / width : 1;
    path.setAttribute("d", `M0 2H${Math.max(0.001, Math.min(1, end)) * 1000}`);
  };
  drawToNow();
  window.addEventListener("resize", drawToNow);

  let started = false;

  const start = () => {
    if (started) return;
    started = true;
    drawToNow(); // measure now: the page may have been hidden when this mounted
    graph.classList.add("in-view");
  };

  if (typeof IntersectionObserver === "undefined") {
    start();
    return () => window.removeEventListener("resize", drawToNow);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) start();
    },
    // Not a visibility ratio: stacked on a phone the timeline is taller than
    // the screen, so "30% visible" would never happen. Start once it reaches
    // the lower quarter of the viewport instead.
    { threshold: 0, rootMargin: "0px 0px -25% 0px" },
  );
  observer.observe(graph);

  return () => {
    observer.disconnect();
    window.removeEventListener("resize", drawToNow);
  };
}

import type { Cleanup } from "../types";

export function mountTrackRoadmap(): Cleanup {
  const graph = document.querySelector<HTMLElement>(".season-path");
  const svg = graph?.querySelector<SVGSVGElement>("svg");
  const path = svg?.querySelector<SVGPathElement>("#trackPath");
  if (!graph || !svg || !path) return () => {};

  let started = false;

  const start = () => {
    if (started) return;
    started = true;
    graph.classList.add("in-view");
  };

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) start();
    },
    { threshold: 0.3 },
  );
  observer.observe(graph);

  return () => observer.disconnect();
}

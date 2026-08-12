import type { Cleanup } from "../types";

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

export function mountTrackRoadmap(): Cleanup {
  const graph = document.querySelector<HTMLElement>(".track-graph");
  const svg = graph?.querySelector<SVGSVGElement>("svg");
  const path = svg?.querySelector<SVGPathElement>("#trackPath");
  if (!graph || !svg || !path) return () => {};

  let started = false;

  const start = () => {
    if (started) return;
    started = true;
    graph.classList.add("in-view");

    const bot = document.createElementNS(SVG_NS, "text");
    bot.textContent = "🤖";
    bot.setAttribute("font-size", "26");
    bot.setAttribute("text-anchor", "middle");
    bot.setAttribute("dominant-baseline", "central");
    bot.classList.add("track-roaming-bot");

    const motion = document.createElementNS(SVG_NS, "animateMotion");
    motion.setAttribute("dur", "5s");
    motion.setAttribute("begin", "0.3s");
    motion.setAttribute("repeatCount", "indefinite");
    motion.setAttribute("keyPoints", "0;1;0");
    motion.setAttribute("keyTimes", "0;0.5;1");
    motion.setAttribute("calcMode", "linear");

    const mpath = document.createElementNS(SVG_NS, "mpath");
    mpath.setAttributeNS(XLINK_NS, "xlink:href", "#trackPath");
    motion.appendChild(mpath);
    bot.appendChild(motion);
    svg.appendChild(bot);
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

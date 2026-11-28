import { mountCountdown } from "./core/countdown";
import { mountCursor } from "./core/cursor";
import { mountMascots } from "./core/mascots";
import { mountMobileNav } from "./core/mobile-nav";
import { mountNewsletter } from "./core/newsletter";
import { mountReachMap } from "./core/reach-map";
import { mountRouting } from "./core/routing";
import { mountTheme } from "./core/theme";
import { initPlushEnhancements } from "./enhancements";
import type { Cleanup } from "./types";

/** Boot the ported Team PLUSH site after markup is in the DOM. */
export function initPlushSite(): Cleanup {
  const cleanups: Cleanup[] = [
    mountRouting(),
    mountMobileNav(),
    mountNewsletter(),
    mountTheme(),
    mountCursor(),
    mountMascots(),
    mountCountdown(),
    mountReachMap(),
    initPlushEnhancements(),
  ];

  return () => cleanups.forEach((cleanup) => cleanup());
}

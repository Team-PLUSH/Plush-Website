import { mountCountdown } from "./core/countdown";
import { mountCursor } from "./core/cursor";
import { mountMascots } from "./core/mascots";
import { mountMobileNav } from "./core/mobile-nav";
import { mountNewsletter } from "./core/newsletter";
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
    initPlushEnhancements(),
  ];

  return () => cleanups.forEach((cleanup) => cleanup());
}

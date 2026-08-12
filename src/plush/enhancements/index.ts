import type { Cleanup } from "../types";
import { mountBuddy } from "./buddy";
import { mountCardTilt } from "./card-tilt";
import { mountHeroParallax } from "./hero-parallax";
import { mountKonami } from "./konami";
import { mountPatInteractions } from "./pat";
import { mountPlayground } from "./playground";
import { mountRipples } from "./ripples";
import { mountSparkleTrail } from "./sparkle-trail";
import { mountTrackRoadmap } from "./track-roadmap";

/** Layered polish on top of the ported Team PLUSH markup. */
export function initPlushEnhancements(): Cleanup {
  const cleanups: Cleanup[] = [
    mountSparkleTrail(),
    mountBuddy(),
    mountKonami(),
    mountPlayground(),
    mountCardTilt(),
    mountRipples(),
    mountHeroParallax(),
    mountPatInteractions(),
    mountTrackRoadmap(),
  ];

  return () => cleanups.forEach((cleanup) => cleanup());
}

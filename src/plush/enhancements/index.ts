import type { Cleanup } from "../types";
import { mountCardTilt } from "./card-tilt";
import { mountHeroParallax } from "./hero-parallax";
import { mountKonami } from "./konami";
import { mountPatInteractions } from "./pat";
import { mountRipples } from "./ripples";
import { mountSparkleTrail } from "./sparkle-trail";
import { mountTrackRoadmap } from "./track-roadmap";

/** Layered polish on top of the ported Team PLUSH markup. */
export function initPlushEnhancements(): Cleanup {
  const cleanups: Cleanup[] = [
    mountSparkleTrail(),
    mountKonami(),
    mountCardTilt(),
    mountRipples(),
    mountHeroParallax(),
    mountPatInteractions(),
    mountTrackRoadmap(),
  ];

  return () => cleanups.forEach((cleanup) => cleanup());
}

// Single source of truth for the site's search and social metadata.
//
// Two rules drive the copy below:
//   1. "11740" appears in the title, the description and the <h1>. "Team PLUSH"
//      on its own is ambiguous to a search engine; the number is what makes the
//      team unique, and it is what people type when they already know us.
//   2. Absolute URLs everywhere. Crawlers and link-preview bots resolve og:image
//      and canonical against their own idea of the origin, not ours, so a
//      relative path is unreliable in exactly the places previews matter.

/** Canonical origin. No trailing slash — paths are appended. */
export const SITE_ORIGIN = "https://frc11740.ca";

/** Canonical address of the home page. */
export const SITE_URL = `${SITE_ORIGIN}/`;

export const SITE_TITLE = "Team PLUSH — FRC 11740 Robotics Team | Ottawa, Ontario";

export const SITE_DESCRIPTION =
  "Team PLUSH (FRC 11740) is a student-run FIRST Robotics Competition team in Ottawa, " +
  "Ontario building bold, pastel robots. Meet the crew, our robots, values, season " +
  "schedule, and sponsors.";

/** 1200x630 so X/Discord/LinkedIn render the large card, not a small thumbnail. */
export const OG_IMAGE_URL = `${SITE_ORIGIN}/og-image.png`;

const SOCIAL_PROFILES = [
  "https://instagram.com/frc11740",
  "https://youtube.com/@frc11740",
  "https://linkedin.com/company/frc11740",
  "https://tiktok.com/@frc11740",
  "https://facebook.com/frc11740",
  "https://x.com/frc11740",
];

/**
 * Structured data describing the team as an organization. `sameAs` is the part
 * that does the real work: it tells Google the social accounts and this domain
 * are one entity, which is how a brand becomes a known thing rather than a
 * string of characters.
 */
export const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SportsOrganization",
  name: "Team PLUSH",
  alternateName: ["FRC 11740", "PLUSH Robotics", "FRC Team 11740"],
  url: SITE_URL,
  logo: `${SITE_ORIGIN}/plush-logo.png`,
  image: OG_IMAGE_URL,
  description: SITE_DESCRIPTION,
  sport: "Robotics",
  memberOf: {
    "@type": "Organization",
    name: "FIRST Robotics Competition",
    url: "https://www.firstinspires.org/robotics/frc",
  },
  address: {
    "@type": "PostalAddress",
    addressLocality: "Ottawa",
    addressRegion: "ON",
    addressCountry: "CA",
  },
  sameAs: SOCIAL_PROFILES,
} as const;

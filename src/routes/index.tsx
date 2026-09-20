import { createFileRoute } from "@tanstack/react-router";
import { PlushSite } from "@/plush/components/PlushSite";
import { ORGANIZATION_JSON_LD, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESCRIPTION },
      { property: "og:title", content: SITE_TITLE },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      // Renders as <script type="application/ld+json">. Tells Google that
      // frc11740.ca, "Team PLUSH", "FRC 11740" and the six social accounts are
      // all one organization rather than unrelated strings.
      { "script:ld+json": ORGANIZATION_JSON_LD },
    ],
    links: [
      { rel: "stylesheet", href: "/plush.css" },
      { rel: "stylesheet", href: "/plush-extras.css" },
      { rel: "stylesheet", href: "/plush-scribble-jam.css" },
      // Self-hosted webfonts — no third-party request, no fonts.googleapis.com.
      { rel: "stylesheet", href: "/fonts.css" },
      {
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href: "/fonts/nunito-latin.woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href: "/fonts/caveat-latin.woff2",
        crossOrigin: "anonymous",
      },
    ],
  }),
  component: PlushSite,
});

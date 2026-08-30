import { createFileRoute } from "@tanstack/react-router";
import { PlushSite } from "@/plush/components/PlushSite";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Team PLUSH — Live · Laugh · Love · Robotics" },
      {
        name: "description",
        content:
          "Team PLUSH is a student-run FRC robotics team building bold, pastel robots. Meet the crew, our robots, values, schedule, and sponsors.",
      },
      { property: "og:title", content: "Team PLUSH — Live · Laugh · Love · Robotics" },
      {
        property: "og:description",
        content:
          "Pastel robots, gracious competition, and one very cute plush buddy. Come build with us.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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

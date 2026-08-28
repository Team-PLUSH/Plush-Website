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
        content: "Pastel robots, gracious competition, and one very cute plush buddy. Come build with us.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: "/plush.css" },
      { rel: "stylesheet", href: "/plush-extras.css" },
      { rel: "stylesheet", href: "/plush-scribble-jam.css" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Nunito:ital,wght@0,400;0,700;0,800;0,900;1,400&family=Space+Grotesk:wght@500;700&display=swap",
      },
    ],
  }),
  component: PlushSite,
});

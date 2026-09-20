import { useEffect } from "react";

import { initPlushSite } from "@/plush/init";

// The site body is compiled in as a string at build time rather than fetched at
// runtime, so the full document — team, robots, sponsors, values — is present in
// the server-rendered HTML that crawlers and link-preview bots receive on the
// first response. Fetching it in an effect meant the SSR output was an empty
// div and every word of content depended on JS executing.
//
// This is first-party repo content, exactly as trusted as this file, which is
// why it is no longer put through DOMPurify: it lives in src/ (never served as
// its own URL), it contains no <script>, no inline style attributes and no
// event-handler attributes, so it adds nothing the CSP has to allow.
import bodyHtml from "../content/plush-body.html?raw";

export function PlushSite() {
  // The imperative enhancements (routing, theme, mascots, cursor) query the DOM
  // directly, so they can only run once the markup is committed on the client.
  useEffect(() => initPlushSite(), []);

  return <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />;
}

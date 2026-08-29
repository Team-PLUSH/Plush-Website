import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { initPlushSite } from "@/plush/init";

// DOMPurify strips scripts, event handlers and javascript: URIs by default.
// This hook additionally forces every link that opens a new tab to also drop
// its access back to this page (reverse tabnabbing) and never send a referrer.
let hookInstalled = false;
function installLinkHardeningHook() {
  if (hookInstalled || typeof window === "undefined") return;
  hookInstalled = true;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.getAttribute("target") === "_blank") {
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
}

const SANITIZE_CONFIG = {
  ADD_ATTR: ["target"],
  // Belt-and-braces: these can never appear in trusted body content.
  FORBID_TAGS: ["style", "base", "noscript"],
  FORBID_ATTR: ["ping", "srcset"],
} satisfies Parameters<typeof DOMPurify.sanitize>[1];

export function PlushSite() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    installLinkHardeningHook();

    fetch("/plush-body.html")
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load site content (${response.status})`);
        return response.text();
      })
      .then((markup) => {
        if (live) setHtml(DOMPurify.sanitize(markup, SANITIZE_CONFIG));
      })
      .catch((error: unknown) => {
        if (live) {
          setLoadError(error instanceof Error ? error.message : "Failed to load site content");
        }
      });

    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!html || !hostRef.current) return;
    return initPlushSite();
  }, [html]);

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d1120] px-4 text-center text-[#e8edf8]">
        <div>
          <p className="text-lg font-semibold">Team PLUSH could not load</p>
          <p className="mt-2 text-sm opacity-80">{loadError}</p>
        </div>
      </div>
    );
  }

  return <div ref={hostRef} dangerouslySetInnerHTML={{ __html: html ?? "" }} />;
}

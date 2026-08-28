import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { initPlushSite } from "@/plush/init";

export function PlushSite() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;

    fetch("/plush-body.html")
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load site content (${response.status})`);
        return response.text();
      })
      .then((markup) => {
        if (live) setHtml(DOMPurify.sanitize(markup, { ADD_ATTR: ["target"] }));
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

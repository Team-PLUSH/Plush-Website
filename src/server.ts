import "./lib/error-capture";

import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import {
  applySecurityHeaders,
  createCspNonce,
  CSP_REPORT_ENDPOINT,
  writeHtmlSecurityHeaders,
} from "./lib/security-headers";

type StreamHandlerContext = {
  request: Request;
  router: {
    options: { ssr?: { nonce?: string } };
  };
  responseHeaders: Headers;
};

// TanStack Start's stream handler, wrapped so every SSR document carries a
// fresh per-request nonce-based Content-Security-Policy plus the rest of the
// security-header set. The nonce is handed to the router so TanStack stamps it
// onto the bootstrap <script> tags it emits, and written onto the response
// headers so the browser accepts exactly those scripts.
const securedStreamHandler = (ctx: StreamHandlerContext) => {
  const nonce = createCspNonce();
  ctx.router.options.ssr = { ...ctx.router.options.ssr, nonce };
  writeHtmlSecurityHeaders(ctx.responseHeaders, nonce);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defaultStreamHandler(ctx as any);
};

const startFetch = createStartHandler(
  securedStreamHandler as Parameters<typeof createStartHandler>[0],
) as (request: Request, ...rest: unknown[]) => Promise<Response>;

function securityHardenedErrorResponse(status = 500): Response {
  return applySecurityHeaders(
    new Response(renderErrorPage(), {
      status,
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
    createCspNonce(),
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return securityHardenedErrorResponse(500);
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Collector for Content-Security-Policy violation reports. Browsers POST here
// via the CSP's `report-uri` (content-type application/csp-report) and the
// newer Reporting API (`report-to`, content-type application/reports+json).
// We just log a compact summary so real violations surface in the function
// logs; the body is read with a hard size cap so it can't be used to flood.
async function handleCspReport(request: Request): Promise<Response> {
  const noContent = () => new Response(null, { status: 204 });
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } });
  }
  try {
    const raw = (await request.text()).slice(0, 8_000);
    const parsed: unknown = JSON.parse(raw);
    // report-to sends an array of reports; report-uri sends { "csp-report": {…} }.
    const reports = Array.isArray(parsed) ? parsed : [parsed];
    for (const report of reports) {
      const body =
        (report as { body?: unknown })?.body ??
        (report as { "csp-report"?: unknown })?.["csp-report"] ??
        report;
      const b = body as Record<string, unknown>;
      console.warn(
        JSON.stringify({
          event: "csp-violation",
          directive: b["effective-directive"] ?? b["violated-directive"] ?? b.effectiveDirective,
          blockedUri: b["blocked-uri"] ?? b.blockedURL,
          documentUri: b["document-uri"] ?? b.documentURL,
          sourceFile: b["source-file"] ?? b.sourceFile,
          line: b["line-number"] ?? b.lineNumber,
        }),
      );
    }
  } catch {
    // Malformed or oversized payload — ignore, still 204 so the browser stops retrying.
  }
  return noContent();
}

// Guarantee the security headers on every response we return. The SSR success
// path sets them inside securedStreamHandler; this backstops error responses
// produced deeper in the stack (e.g. the errorMiddleware in src/start.ts) that
// never passed through it.
function ensureSecurityHeaders(response: Response): Response {
  if (response.headers.has("Content-Security-Policy")) return response;
  return applySecurityHeaders(response, createCspNonce());
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    if (new URL(request.url).pathname === CSP_REPORT_ENDPOINT) {
      return handleCspReport(request);
    }
    try {
      const response = await startFetch(request, env, ctx);
      return ensureSecurityHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return securityHardenedErrorResponse(500);
    }
  },
};

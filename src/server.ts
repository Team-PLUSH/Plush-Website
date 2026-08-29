import "./lib/error-capture";

import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import {
  applySecurityHeaders,
  createCspNonce,
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
    try {
      const response = await startFetch(request, env, ctx);
      return ensureSecurityHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return securityHardenedErrorResponse(500);
    }
  },
};

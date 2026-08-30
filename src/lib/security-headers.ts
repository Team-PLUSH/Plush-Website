// Central definition of the site's HTTP security posture.
//
// Two delivery paths use this module:
//   1. src/server.ts wraps every SSR response and calls applySecurityHeaders()
//      with a fresh per-request nonce, so HTML documents get a strict,
//      nonce-based Content-Security-Policy.
//   2. vite.config.ts mirrors STATIC_SECURITY_HEADERS into Nitro routeRules so
//      static assets (JS, CSS, images, fonts, the sponsorship PDF) served
//      straight from the CDN — never touching the function — still carry the
//      transport/January headers.
//
// Keep the two in sync: STATIC_SECURITY_HEADERS is the shared source of truth
// for everything except CSP (which must be dynamic to carry the nonce).

/** Headers that are safe to apply to *every* response, static or dynamic. */
export const STATIC_SECURITY_HEADERS: Record<string, string> = {
  // Force HTTPS for two years, including subdomains, and allow preload-list
  // inclusion. frc11740.ca is HTTPS-only via Vercel, so this is safe.
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  // Never let a browser MIME-sniff a response into an executable type.
  "X-Content-Type-Options": "nosniff",
  // Send only the origin on cross-origin navigations; full URL same-origin.
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Disable the legacy XSS auditor (it introduced its own vulnerabilities).
  "X-XSS-Protection": "0",
  "X-DNS-Prefetch-Control": "off",
  // No Flash / Silverlight / Acrobat cross-domain policy files.
  "X-Permitted-Cross-Domain-Policies": "none",
  // Isolate our browsing-context group from cross-origin openers/openees.
  "Cross-Origin-Opener-Policy": "same-origin",
  // Only same-origin documents may embed our resources as no-cors subresources.
  "Cross-Origin-Resource-Policy": "same-origin",
  // Turn off every powerful feature — this is a static marketing site.
  "Permissions-Policy": [
    "accelerometer=()",
    "autoplay=()",
    "camera=()",
    "clipboard-read=()",
    "clipboard-write=(self)",
    "display-capture=()",
    "encrypted-media=()",
    "fullscreen=(self)",
    "geolocation=()",
    "gyroscope=()",
    "hid=()",
    "idle-detection=()",
    "magnetometer=()",
    "microphone=()",
    "midi=()",
    "payment=()",
    "picture-in-picture=()",
    "publickey-credentials-get=()",
    "screen-wake-lock=()",
    "serial=()",
    "usb=()",
    "xr-spatial-tracking=()",
  ].join(", "),
};

/** Headers applied only to HTML documents rendered by the SSR function. */
const HTML_ONLY_SECURITY_HEADERS: Record<string, string> = {
  // Legacy clickjacking defence; modern browsers use CSP frame-ancestors below.
  "X-Frame-Options": "DENY",
};

/**
 * Generate a cryptographically-random CSP nonce (128 bits, base64).
 * Uses Web Crypto, which is available on every Nitro target (Node ≥ 18,
 * Workers, Vercel Fluid Compute).
 */
export function createCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Build the Content-Security-Policy for an HTML document.
 *
 * Scripts: nonce + strict-dynamic — only the SSR-emitted bootstrap scripts
 * (which TanStack Start stamps with this nonce) run, plus whatever they choose
 * to load. No host allowlist, no 'unsafe-inline', no 'unsafe-eval'.
 *
 * Styles: 'unsafe-inline' is retained deliberately. The page body is authored
 * HTML with ~60 inline style="" attributes and TanStack may inline critical
 * CSS during SSR; none of it is attacker-influenced (the fetched body is
 * DOMPurify-sanitised). Style injection without script is not a meaningful
 * escalation here. Revisit if the inline styles are ever moved to classes.
 *
 * Fonts: self-hosted from /fonts (see public/fonts.css), so no
 * fonts.googleapis.com / fonts.gstatic.com allowance is needed.
 */
export function buildContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://docs.google.com",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' https://docs.google.com",
    "media-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/**
 * Write the full HTML security-header set (static headers + nonce CSP) onto a
 * mutable Headers object, replacing any existing values. Used for the streaming
 * SSR response, whose headers must be finalised before the body starts.
 */
export function writeHtmlSecurityHeaders(headers: Headers, nonce: string): void {
  for (const [name, value] of Object.entries(STATIC_SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  for (const [name, value] of Object.entries(HTML_ONLY_SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));
  // Don't advertise the server implementation.
  headers.delete("X-Powered-By");
  headers.delete("Server");
}

/**
 * Return a copy of `response` with the full security-header set applied,
 * including a fresh nonce-based CSP. The body stream is passed through
 * untouched so this is safe for streaming SSR responses.
 */
export function applySecurityHeaders(response: Response, nonce: string): Response {
  const headers = new Headers(response.headers);
  writeHtmlSecurityHeaders(headers, nonce);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

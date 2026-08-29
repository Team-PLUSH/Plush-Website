// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Security headers for responses that never touch the SSR function — static
// assets, fonts, images, and the sponsorship PDF served straight from the CDN.
// HTML documents get a stricter, nonce-based CSP applied in src/server.ts via
// src/lib/security-headers.ts; keep the shared header names in sync with
// STATIC_SECURITY_HEADERS there.
const STATIC_ASSET_SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-XSS-Protection": "0",
  "X-DNS-Prefetch-Control": "off",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy":
    "accelerometer=(), autoplay=(), camera=(), clipboard-read=(), clipboard-write=(self), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), hid=(), idle-detection=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), usb=(), xr-spatial-tracking=()",
};

const securityConfig = {
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Forwarded verbatim to nitro() from nitro/vite by the Lovable wrapper.
  nitro: {
    routeRules: {
      "/**": { headers: { ...STATIC_ASSET_SECURITY_HEADERS } },
      // The sponsorship PDF is embedded in a same-origin <iframe> on the
      // sponsors page, so allow same-origin framing but block cross-origin
      // sites from embedding it, and ask the browser to render it inline.
      "/sponsorship-package.pdf": {
        headers: {
          ...STATIC_ASSET_SECURITY_HEADERS,
          "X-Frame-Options": "SAMEORIGIN",
          "Content-Disposition": 'inline; filename="Team-PLUSH-Sponsorship-Package.pdf"',
        },
      },
    },
  },
};

export default defineConfig(
  securityConfig as unknown as Parameters<typeof defineConfig>[0],
);

# Security Policy

## Reporting a vulnerability

Email **teamplushrobotics@gmail.com** with:

- a description of the issue and where you found it,
- steps to reproduce (a proof of concept if you have one), and
- the impact you think it has.

Please give us a reasonable window to investigate and fix the issue before
disclosing it publicly. We do not run a paid bug-bounty program, but we are
grateful for responsible reports and will credit you if you would like.

This site is a public marketing website plus one private area, `/admin`, for
team leads. The newsletter form posts to a same-origin server function
(CSRF-checked, rate-limited, zod-validated) that forwards the address to a
Google Form; "join the team" is an external Google Form link.

`/admin` holds the team's inventory, orders, expenses, grants and sponsorships,
and membership fees (member names, payment status and optional contact emails).
None of that data is in this repository: it lives in the project's Upstash
Redis store and is only sent to a signed-in browser.

- One shared password (`ADMIN_PASSWORD`, 12+ characters), checked in constant
  time; sign-in is limited to 10 attempts per IP per 15 minutes, counted in
  Redis.
- Sessions are an HMAC-signed `__Host-` cookie (HttpOnly, Secure,
  SameSite=Strict, 12 h) whose random id must also be live in Redis, so signing
  out really ends a session and "Sign out everywhere" ends all of them.
  Rotating `ADMIN_PASSWORD` or `ADMIN_SESSION_SECRET` also signs everyone out.
- Every write is schema-validated (zod; unknown fields dropped, sizes capped)
  and saved with an atomic compare-and-set; the last 50 versions are kept as
  backups under `plush:admin:v1:history`.
- Admin responses are `Cache-Control: no-store` and `noindex`.

See also [`/.well-known/security.txt`](public/.well-known/security.txt) and the
operational hardening checklist in
[`docs/security-operations.md`](docs/security-operations.md).

## What is already in place

- **Nonce-based Content-Security-Policy** on every HTML document
  (`script-src 'self' 'nonce-…' 'strict-dynamic'`), built per request in
  [`src/lib/security-headers.ts`](src/lib/security-headers.ts) and applied in
  [`src/server.ts`](src/server.ts).
- **HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, COOP, CORP, `X-Frame-Options`** on documents, and the
  same transport headers on static assets / the sponsorship PDF via Nitro
  `routeRules` in [`vite.config.ts`](vite.config.ts).
- The page body is first-party HTML compiled into the bundle (no runtime fetch,
  no user-supplied markup), so it is not sanitised at runtime; every
  `target="_blank"` link in it carries `rel="noopener noreferrer"`.
- No inline event handlers or inline `<script>` in shipped HTML, so the CSP
  needs no `'unsafe-inline'` for scripts.
- Dependencies are watched by **Dependabot**
  ([`.github/dependabot.yml`](.github/dependabot.yml)) and every push / PR runs
  `npm audit` ([`.github/workflows/security.yml`](.github/workflows/security.yml)).
- Secrets live only in Vercel environment variables; `.env*` is git-ignored.

# Security Policy

## Reporting a vulnerability

Email **teamplushrobotics@gmail.com** with:

- a description of the issue and where you found it,
- steps to reproduce (a proof of concept if you have one), and
- the impact you think it has.

Please give us a reasonable window to investigate and fix the issue before
disclosing it publicly. We do not run a paid bug-bounty program, but we are
grateful for responsible reports and will credit you if you would like.

This site is a static marketing website. It has no user accounts, no database,
and collects no personal data server-side. The newsletter form submits directly
to a Google Form; "join the team" is an external Google Form link.

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
- All fetched HTML is sanitised with **DOMPurify** before it is inserted into
  the page; `target="_blank"` links are forced to `rel="noopener noreferrer"`.
- No inline event handlers or inline `<script>` in shipped HTML, so the CSP
  needs no `'unsafe-inline'` for scripts.
- Dependencies are watched by **Dependabot**
  ([`.github/dependabot.yml`](.github/dependabot.yml)) and every push / PR runs
  `npm audit` ([`.github/workflows/security.yml`](.github/workflows/security.yml)).
- Secrets live only in Vercel environment variables; `.env*` is git-ignored.

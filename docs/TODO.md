# Team Plush — TODO / pick up here

Last updated: 2026-08-30. **Shipped: `site-hardening-newsletter-nav` merged to
`main` and live on frc11740.ca.** Everything that can be done in code is done;
what's left needs an account/dashboard, a file, or a decision — see below.

## Blocked on the user (not code)

- [ ] **Replace `public/sponsorship-package.pdf`** with the current 9-page
      export (the file exists — it just needs to be saved into the repo and
      committed; a binary can't be written from a chat attachment). The old
      stopgap is what's live until then.
- [ ] **Connect Upstash to the Vercel project.** Store `upstash-kv-aqua-blanket`
      is provisioned; click **Connect to Project** on its Upstash page → this
      project → Production. It exposes `KV_REST_API_URL` / `KV_REST_API_TOKEN`
      (already in `src/plush/rate-limit.ts`'s accepted names) so the durable
      rate limiter activates on the next deploy. Until then the in-memory
      fallback runs. A Vercel Firewall rate-limit rule on `_serverFn` is still
      worth adding on top.
- [ ] **Watch the CSP violation logs** in the Vercel dashboard for a day or two
      (`csp-violation` lines) and tighten anything real. Reporting is wired and
      confirmed live.
- [ ] **Check the Google Sheet** caught the consent test rows with the version
      in the right column; delete the `cctest…@example.com` rows.
- [ ] **CASL unsubscribe** — pick a send tool (Buttondown / Mailchimp / manual)
      before the first newsletter goes out. Most tools handle unsubscribe
      themselves, so there's no code to write until one is chosen.
- [ ] **Photo / media release forms** for students (minors → parent/guardian) —
      offline legal docs, not a code change.
- [ ] **Real sponsor cards** — swap the "your logo here / Open" placeholders in
      `public/plush-body.html` as sponsors sign.
- [ ] **Manual a11y walkthrough** — screen reader + keyboard. The automated
      axe-core pass is clean (A/AA, both themes); a human pass before a big push
      is still worth it.
- [ ] **`security.txt` renewal** before `Expires: 2027-08-28`.
- [ ] Operational hardening in [`security-operations.md`](security-operations.md)
      — 2FA everywhere, branch protection + required checks on `main`, the SPF /
      DMARC / null-MX / CAA DNS records for `frc11740.ca`, one authoritative
      lockfile (`bun.lock` is now stale vs `package-lock.json`).

## Done — verified

- **Google Form** accepts responses without sign-in (test POST → 200).
- **Consent version** wired: `NEWSLETTER.consentEntryId = entry.1307416685`,
  test POST accepted. Bump `CONSENT_TEXT_VERSION` + the checkbox's
  `data-consent-version` in `public/plush-body.html` together whenever the
  consent sentence changes.
- **Merged to `main` and deployed.** Live headers checked:
  - MDN HTTP Observatory **A+**, 10/10 tests, 0 failed.
  - securityheaders.com blocks bots (403) but every graded header is present
    → A/A+.
  - CSP: nonce + `strict-dynamic`, no `unsafe-inline` / `unsafe-eval`; the only
    csp-evaluator nitpick is `data:` in `img-src` (needed for inline SVG —
    deliberate, low risk).
  - `/csp-report` returns 204 live; fonts self-hosted (`font/woff2`, 7-day
    cache); static assets carry the full header set.
- **CI:** `npm audit` clean after `audit fix`; workflow bumped to
  `actions/checkout@v5` / `setup-node@v5` / Node 24.

## Done — earlier on this branch

- Newsletter signup wired to Google Form/Sheet + CASL consent checkbox +
  honeypot, rate limit, CSRF middleware, fetch timeout.
- Mobile hamburger nav (toggle / outside-click / Escape / resize).
- Security headers: nonce CSP on SSR + mirrored onto static assets;
  DOMPurify link hardening; `security.txt`, `SECURITY.md`, dependabot, CI.
- Not-a-registered-charity / not-tax-deductible note on Sponsors + Terms.
- Scribble Jam copy tweaks, real social glyph SVGs, mascot role lines cleared,
  friendlier SSR error page.

### 2026-08-30

- `.gitattributes` (`* text=auto eol=lf` + binary rules) and `npm run format`;
  clears the ~1340 CRLF lint errors on Windows checkouts.
- Self-hosted Caveat / Nunito / Space Grotesk (latin + latin-ext woff2) from
  `/fonts`; dropped `fonts.googleapis.com` and `fonts.gstatic.com` from the CSP
  (`style-src` / `font-src` are first-party only). No third-party request on load.
- Newsletter consent recorded server-side: `consent: true` is now required
  (zod `z.literal(true)`), and a consent record is logged (+ written to the
  Sheet via `consentEntryId`). `CONSENT_TEXT_VERSION` in constants.
- Moved all 82 inline `style=""` attributes in `plush-body.html` into classes
  in `plush.css`; tightened CSP to `style-src 'self'` (no `'unsafe-inline'`).
- Durable rate limiter: `src/plush/rate-limit.ts` uses Upstash Redis when env
  vars are present, in-memory fallback otherwise.
- CSP violation reporting: `report-uri` / `report-to` → same-origin
  `/csp-report` handler in `src/server.ts` (logs `csp-violation`, returns 204).
- Accessibility pass — axe-core (WCAG 2.1 A/AA + best-practice) clean on all 10
  pages in both themes: `<header>` / `<main>` / `<h1>` landmarks + skip link,
  icon-button labels, and text-safe "ink" colour tokens replacing pastel-as-
  text / faint-grey that failed contrast.

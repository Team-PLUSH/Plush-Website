# Team Plush — TODO / pick up here

Last updated: 2026-08-30. **Branch `site-hardening-newsletter-nav` merged to
`main` (`ba67f9b`) and pushed — Vercel deploying production.**

## Needs the user (can't be done in code)

- [x] ~~Verify the newsletter Google Form accepts responses without sign-in.~~
      Confirmed 2026-08-30 (test POST returned 200, no 401).
- [x] ~~Wire the "Consent version" question.~~ `NEWSLETTER.consentEntryId =
    entry.1307416685`, tested. Bump `CONSENT_TEXT_VERSION` (and the checkbox's
      `data-consent-version` in `public/plush-body.html`) whenever the consent
      sentence changes. → Check the Google Sheet caught the test rows with the
      version in the right column.
- [ ] **Replace `public/sponsorship-package.pdf`** with the current 9-page
      export. Save the file over the old one and commit — no code change. The
      old stopgap is what's live until then.
- [ ] **Photo / media release forms** for students (minors → parent/guardian).
      Handled offline per the privacy policy; the actual forms still need to exist.
- [x] ~~Push / merge to main.~~ Done 2026-08-30 (`ba67f9b`).

## Security — future implementation

Operational steps (accounts, DNS) are tracked in
[`security-operations.md`](security-operations.md). The items below are code/site
changes to harden further:

- [ ] **Activate the durable rate limiter.** The signup fn prefers an Upstash
      Redis counter (`src/plush/rate-limit.ts`) and falls back to the in-memory
      window. The Upstash store `upstash-kv-aqua-blanket` is provisioned but not
      yet connected to the Vercel project — click **Connect to Project** on its
      Upstash page and pick this project + Production. It exposes
      `KV_REST_API_URL` / `KV_REST_API_TOKEN`, already in the code's accepted
      names, so it activates on the next deploy after connecting. A Vercel
      Firewall rate-limit rule on the `_serverFn` path is still worth adding.
- [ ] **Watch the CSP violation logs after deploy.** Reporting is wired
      (`report-uri` / `report-to` → `/csp-report`, logged as `csp-violation`).
      Check the function logs for a day or two post-launch and tighten anything
      real that shows up.
- [ ] **CASL unsubscribe.** Every newsletter email needs a working unsubscribe
      link. No sending mechanism is built — pick the tool (Buttondown, Mailchimp,
      Gmail manual) before the first send. Most tools (Buttondown/Mailchimp)
      handle unsubscribe themselves, so hold off building a custom endpoint until
      the tool is chosen.
- [ ] **Renew `public/.well-known/security.txt`** before `Expires: 2027-08-28`.
- [ ] Re-run <https://securityheaders.com/>, <https://observatory.mozilla.org/>,
      and <https://csp-evaluator.withgoogle.com/> after the first production
      deploy and address anything they flag.

## Code / site work still open

- [ ] Sponsor section: "your logo here / Open" placeholder cards in
      `public/plush-body.html` — swap for real sponsors as they sign.
- [ ] Accessibility: automated pass is clean (see below). Still worth a manual
      screen-reader + keyboard walkthrough before launch, and check any new
      components against the same bar.

## Done (this branch)

- Newsletter signup wired to Google Form/Sheet + CASL consent checkbox +
  honeypot, rate limit, CSRF middleware, fetch timeout.
- Mobile hamburger nav (toggle / outside-click / Escape / resize).
- Security headers: nonce CSP on SSR + mirrored onto static assets;
  DOMPurify link hardening; `security.txt`, `SECURITY.md`, dependabot, CI.
- Restored `sponsorship-package.pdf`; embed + link intact.
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
  Sheet when `consentEntryId` is set). `CONSENT_TEXT_VERSION` in constants.
- Moved all 82 inline `style=""` attributes in `plush-body.html` into classes
  in `plush.css`; tightened CSP to `style-src 'self'` (no `'unsafe-inline'`).
  Verified across all pages, no CSP violations, no visual change.
- Durable rate limiter scaffolded: `src/plush/rate-limit.ts` uses Upstash Redis
  when env vars are present, in-memory fallback otherwise (see Security above).
- CSP violation reporting: `report-uri` / `report-to` → same-origin
  `/csp-report` handler in `src/server.ts` (logs `csp-violation`, returns 204).
- Accessibility pass — axe-core (WCAG 2.1 A/AA + best-practice) clean on all 10
  pages in both themes: `<header>` / `<main>` / `<h1>` landmarks + skip link,
  icon-button labels, and text-safe "ink" colour tokens replacing pastel-as-
  text / faint-grey that failed contrast.

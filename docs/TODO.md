# Team Plush — TODO / pick up here

Last updated: 2026-08-30. Work on branch `site-hardening-newsletter-nav`
(through commit `9a25588`) — not yet merged to `main`, not pushed.

## Needs the user (can't be done in code)

- [ ] **Verify the newsletter Google Form accepts responses without sign-in.**
      Check `NEWSLETTER.formId` / `emailEntryId` in `src/plush/constants.ts` are
      correct by submitting the live form once deployed. If it 401s, the form
      still requires Google sign-in and must be reconfigured.
- [ ] **Add a "Consent version" question to the Google Form** (short answer),
      then paste its `entry.…` id into `NEWSLETTER.consentEntryId` in
      `src/plush/constants.ts`. The signup already sends the value; until the id
      is set it only lands in the function logs, not the Sheet. Bump
      `CONSENT_TEXT_VERSION` (and the checkbox's `data-consent-version` in
      `public/plush-body.html`) whenever the consent sentence changes.
- [ ] **Replace `public/sponsorship-package.pdf`** with the current version
      (a normal "Save as PDF" from Chrome is fine). The old one was restored from
      git history as a stopgap. No code change needed — just overwrite the file.
- [ ] **Photo / media release forms** for students (minors → parent/guardian).
      Handled offline per the privacy policy; the actual forms still need to exist.
- [ ] Decide whether to **push the branch / open a PR / merge to main**
      (triggers Vercel deploy).

## Security — future implementation

Operational steps (accounts, DNS) are tracked in
[`security-operations.md`](security-operations.md). The items below are code/site
changes to harden further:

- [ ] **Activate the durable rate limiter.** The signup fn already prefers an
      Upstash Redis counter (`src/plush/rate-limit.ts`) and falls back to the
      in-memory window. Provision Upstash Redis via the Vercel Marketplace — it
      sets `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` and the code
      picks them up on the next deploy. A Vercel Firewall rate-limit rule on the
      `_serverFn` path is still worth adding on top.
- [ ] **CSP violation reporting.** Once any backend endpoint exists, add
      `report-to` / a `/csp-report` collector so real violations are visible
      instead of silent.
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
- [ ] WCAG 2.1 AA accessibility pass (AODA best practice).

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

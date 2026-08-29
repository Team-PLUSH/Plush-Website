# Team Plush — TODO / pick up here

Last updated: 2026-08-29. Work committed on branch `site-hardening-newsletter-nav`
(commits `b875729`, `3fd34fe`) — not yet merged to `main`, not pushed.

## Needs the user (can't be done in code)

- [ ] **Verify the newsletter Google Form accepts responses without sign-in.**
      Check `NEWSLETTER.formId` / `emailEntryId` in `src/plush/constants.ts` are
      correct by submitting the live form once deployed. If it 401s, the form
      still requires Google sign-in and must be reconfigured.
- [ ] **Replace `public/sponsorship-package.pdf`** with the current version
      (a normal "Save as PDF" from Chrome is fine). The old one was restored from
      git history as a stopgap. No code change needed — just overwrite the file.
- [ ] **Photo / media release forms** for students (minors → parent/guardian).
      Handled offline per the privacy policy; the actual forms still need to exist.
- [ ] Decide whether to **push the branch / open a PR / merge to main**
      (triggers Vercel deploy).

## Code / site work still open

- [ ] **Lint is red: ~1340 `Delete ␍` (CRLF) prettier errors.** Caused by git
      converting LF→CRLF on this Windows checkout. Fix once, repo-wide: add a
      `.gitattributes` with `* text=auto eol=lf`, renormalize
      (`git add --renormalize .`), then `npm run format`. Do this on its own
      commit so it doesn't bury real diffs. `tsc` and `vite build` are green.
- [ ] **CASL "record of consent":** the checkbox gates submit client-side, but
      the Google Sheet only stores email + timestamp. Confirm that's an adequate
      consent record, or capture consent explicitly (e.g. a second hidden form
      field set when the box is ticked).
- [ ] **Newsletter unsubscribe:** every newsletter email must carry a working
      unsubscribe link (CASL). No sending mechanism is built yet — decide the
      tool (Gmail manual, Mailchimp, Buttondown…) before the first send.
- [ ] Confirm the durable rate-limit for the signup server fn — the in-memory
      limiter is best-effort; `docs/security-operations.md` calls for a Vercel
      Firewall rate-limit rule on the server-function path.
- [ ] Sponsor section: 6 "your logo here / Open" placeholder cards in
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

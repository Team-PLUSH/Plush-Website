# Security operations checklist

Things the code cannot do for you. Work top to bottom; most take a few minutes.

## 1. Accounts (do this first)

- [ ] **GitHub** — enable 2FA on every account with access to `Team-PLUSH/Plush-Website`.
      Org owners: Settings → Authentication security → **Require two-factor authentication**.
- [ ] **GitHub collaborators** — remove anyone who does not currently need write
      access; give students **Write**, not **Admin**. Only 1–2 people should be Admin.
- [ ] **Vercel** (`eason-yang` team) — enable 2FA for all members; set the
      project's Git connection to require PR checks; keep Production deploys
      restricted to `main`.
- [ ] **Porkbun** (domain registrar) — enable 2FA, enable **registrar lock**
      ("Domain Lock"), and turn on **DNSSEC** for `frc11740.ca`.
- [ ] **Google account** behind `teamplushrobotics@gmail.com` and the Google
      Form / Sheet — enable 2FA; this account effectively owns the newsletter data.

## 2. Repository settings (GitHub → Settings)

- [ ] **Branch protection** on `main`: require a pull request, require the
      `security` workflow to pass, disallow force-pushes, disallow deletion.
- [ ] **Code security**: enable Dependabot alerts, Dependabot security updates,
      and **Secret scanning + push protection**.
- [ ] Confirm **Actions → General → Workflow permissions** is set to
      _Read repository contents_ (the `security.yml` workflow only needs read).

## 3. DNS records for `frc11740.ca` (Porkbun / Cloudflare)

No mail is sent from `@frc11740.ca` (the team uses a Gmail address), so lock the
domain down against email spoofing:

| Type | Host     | Value                                                                               |
| ---- | -------- | ----------------------------------------------------------------------------------- |
| TXT  | `@`      | `v=spf1 -all`                                                                       |
| TXT  | `_dmarc` | `v=DMARC1; p=reject; adkim=s; aspf=s; fo=1; rua=mailto:teamplushrobotics@gmail.com` |
| MX   | `@`      | `0 .` (RFC 7505 "null MX" — this domain receives no mail)                           |
| CAA  | `@`      | `0 issue "letsencrypt.org"`                                                         |
| CAA  | `@`      | `0 iodef "mailto:teamplushrobotics@gmail.com"`                                      |

Notes:

- If you later add Google Workspace or send mail from `@frc11740.ca`, you must
  update SPF (`v=spf1 include:_spf.google.com ~all`), add the Google DKIM record,
  loosen DMARC to `p=quarantine` while you monitor `rua` reports, and remove the
  null MX. Do not skip DKIM.
- Vercel issues certificates via Let's Encrypt; if that ever changes, update the
  CAA record or certificate renewal will fail.
- Keep `www` and the apex both on HTTPS. Optionally add a redirect so `www`
  canonicalises to the apex.

## 4. Ongoing

- [ ] Review and merge Dependabot PRs weekly; do not let them pile up.
- [ ] Watch the `security` GitHub Action — a red run means `npm audit` found a
      high/critical advisory or the build broke.
- [ ] Keep **one** lockfile authoritative. Both `package-lock.json` and
      `bun.lock` are committed; pick the package manager Vercel uses (npm) and
      regenerate/commit that lockfile on every dependency change.
- [ ] `bunfig.json` already enforces a 24-hour supply-chain delay on new package
      versions — only add entries to `minimumReleaseAgeExcludes` deliberately.
- [ ] Rotate any credential that is ever pasted into chat, a screenshot, or a
      public issue. The Vercel OIDC token in `.env.local` is short-lived and
      machine-generated — leave it to the Vercel CLI.
- [ ] After each deploy, spot-check headers:
      `curl -sI https://frc11740.ca | grep -i -E 'content-security|strict-transport|x-content-type|referrer|permissions-policy'`
- [ ] Re-check the CSP with <https://csp-evaluator.withgoogle.com/> and the
      overall config with <https://securityheaders.com/> and
      <https://observatory.mozilla.org/>.
- [ ] Update the `Expires` date in `public/.well-known/security.txt` before it
      lapses (currently 2027-08-28).

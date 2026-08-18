# Security and Privacy Review

Reviewed 2026-08-17. Scope: the Eleventy repository at commit `8a45dc394b3270a1b206ed7d07ac48fca9b6c495` and its current working deployment at `https://clirdlf.github.io/publications_v2/`. The future/custom domain `https://publications.clir.org/` was also checked because it is declared in repository and deployment configuration, but it is not currently the working deployment.

## Executive summary

No committed credential, exposed private source file, or confirmed XSS path was found. The strongest repository controls are Nunjucks autoescaping, explicit JSON-for-script escaping, HTTP(S)-only URL normalization for Zenodo records, a narrow Eleventy passthrough list, frozen lockfile installation, and least-privilege workflow permissions.

The main risks are policy, privacy, and supply-chain related. The working GitHub Pages deployment has no CSP or other modern browser policy headers, loads Google Analytics using a placeholder ID, loads Google Fonts, and dynamically executes citation libraries from jsDelivr. Citation styles are fetched from a mutable `master` branch. These external requests and scripts should be reduced and disclosed. Separately, the configured future/custom domain currently routes to a public WordPress multisite signup page and must be corrected before it is advertised or made canonical.

## Deployment findings

### DEP-01 — Informational until launch; High if made canonical — Configured custom domain serves an unintended WordPress surface

- **Location:** `https://publications.clir.org/` and tested paths including `/.env`, `/.git/config`, `/package.json`, `/sitemap.xml`, and `/assets/search-index.json`.
- **Evidence:** Each request returned `302 Location: https://wordpress.clir.org/wp-signup.php?new=publications.clir.org`. Following the redirect produced a WordPress multisite signup page with WordPress/plugin scripts, an AJAX endpoint, REST URL, an analytics-enabled search plugin, and a cache-probe plugin. The repository declares the same custom domain in `src/CNAME:1` and the workflow sets it in `.github/workflows/build-deploy.yml:43`.
- **Impact:** This does not affect visitors using the current GitHub Pages project URL. It becomes a High operational/security issue if the custom domain is published, indexed, or treated as canonical while it continues to route users to the unrelated dynamic WordPress surface.
- **Fix:** Before activating or advertising the custom domain, correct DNS/Cloudflare origin and GitHub Pages custom-domain configuration. Remove the WordPress catch-all/subdomain mapping. Verify both the root request and several nonexistent paths after the change.
- **Mitigation:** Until corrected, show a controlled maintenance response at the edge rather than redirecting to WordPress signup.
- **False-positive note:** The project owner confirms that `https://clirdlf.github.io/publications_v2/` is the current working domain, so this is recorded as pre-launch configuration risk rather than a current production-site failure.

### DEP-02 — Medium — Working deployment lacks browser security-policy headers

- **Location:** current working deployment at `https://clirdlf.github.io/publications_v2/` and a report page.
- **Evidence:** Live responses included normal GitHub Pages caching headers but no `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, or clickjacking control (`frame-ancestors`/`X-Frame-Options`).
- **Impact:** A future injection or compromised third-party script has a larger blast radius; pages can be framed; referrer data and powerful browser features are not explicitly constrained.
- **Fix:** Requires hosting/edge configuration; see HC-01. GitHub Pages does not provide repository-controlled arbitrary response headers.
- **Mitigation:** A CSP meta tag can constrain most resource loading, but cannot provide `frame-ancestors`, report-only operation, or all header features.

### DEP-03 — Medium (privacy) — Google tag loads with a placeholder analytics ID

- **Location:** reachable home and report HTML; generated from `src/_includes/google_analytics.njk:1-8` and `src/_data/site.js:10`.
- **Evidence:** Live markup loads `https://www.googletagmanager.com/gtag/js?id=UA-XXXXXXXXX-X` and calls `gtag('config', 'UA-XXXXXXXXX-X')`. The template enables analytics for any nonempty value; it does not enforce the README's “valid production measurement ID” claim.
- **Impact:** Every page view makes a request to Google even though the ID appears invalid. This discloses visitor IP/user-agent/referrer data to a third party without a clear necessity, and it may create analytics cookies or additional requests depending on tag behavior.
- **Fix:** Remove the deployment variable until a deliberate analytics configuration and privacy basis exist. Validate IDs against the supported format at build time. If analytics is retained, use privacy-preserving settings, document retention/data-sharing choices, and implement consent where required by the site's audiences and applicable law.
- **Mitigation:** Load analytics only after consent and use a strict referrer policy. Confirm behavior with browser storage/network inspection after deploying a real ID.

### DEP-04 — Low — Public search index republishes a broad metadata corpus

- **Location:** `https://clirdlf.github.io/publications_v2/assets/search-index.json` (about 770 KB during review); generated by `scripts/build-search-index.mjs:35-95`.
- **Evidence:** The index contains titles, creators, keywords, and normalized searchable descriptions for reports, podcasts, and videos.
- **Impact:** This expected public content is easy to bulk-download. Creator names are personal data even when already public, and accidental private/draft records upstream would be amplified.
- **Fix:** Confirm that every indexed field and upstream record is intended for public bulk access. Add a publication-status allowlist or explicit inclusion flag before indexing if Zenodo community membership alone is insufficient.
- **False-positive note:** This is not a vulnerability if bulk-public metadata is intentional.

## Repository findings

### REPO-01 — Medium — Runtime code execution depends on third-party CDNs and a mutable branch

- **Location:** `src/assets/js/report-citation.js:1-19,204-211`; loaded by `src/reports/item.njk:162`.
- **Evidence:** Report pages import three executable ESM packages from jsDelivr. Citation styles are fetched from `citation-style-language/styles@master`. Browser module imports do not carry SRI attributes, and `master` is mutable.
- **Impact:** Compromise or unexpected change at npm/jsDelivr/GitHub can execute code in the site's origin context or silently alter citations. The external module also resolves DOI metadata at runtime (`src/assets/js/report-citation.js:214-225`), creating additional third-party requests.
- **Fix:** Install Citation.js as a locked dependency, bundle it into a first-party static asset, and vendor the required CSL files pinned to a reviewed commit. Consider generating citations at build time to eliminate runtime code/data fetches.
- **Mitigation:** A CSP can restrict scripts to first-party plus the exact required origins, but self-hosting is preferable.

### REPO-02 — Medium — Remote image processing lacks a hostname allowlist

- **Location:** `eleventy.config.js:30-81`; `scripts/fetch-zenodo.mjs:130-145,216`; nightly build in `.github/workflows/build-deploy.yml:38-46`.
- **Evidence:** Any HTTP(S) thumbnail URL normalized from a Zenodo community record may be passed to `@11ty/eleventy-img`, which fetches it during CI. URL validation restricts schemes but not hosts.
- **Impact:** If an upstream record or API response is compromised, CI can be induced to request attacker-chosen HTTP(S) endpoints (build-time SSRF) or consume excessive image-processing resources.
- **Fix:** Allowlist expected image hosts (for example, the exact Zenodo hostnames used by current records), reject private/link-local IP destinations after resolution, set conservative fetch/image limits, and fail rather than falling back silently for disallowed sources.
- **Mitigation:** Keep CI runners ephemeral and secrets narrowly scoped. The current GitHub-hosted runner reduces persistence, and the token is passed only to the build step.

### REPO-03 — Low — Build actions are version-tag pinned, not commit-SHA pinned

- **Location:** `.github/workflows/build-deploy.yml:24-30,49-52,65`; `.github/workflows/rebuild-main.yml:18-24`.
- **Evidence:** Third-party/official actions use tags such as `actions/checkout@v6` and `pnpm/action-setup@v4`.
- **Impact:** A moved or compromised tag could alter CI execution. This is principally a supply-chain hardening gap.
- **Fix:** Pin every action to a reviewed full commit SHA and use an update bot/process to refresh pins.
- **Mitigation:** Existing job permissions are appropriately narrow: the test workflow is read-only, and Pages write/OIDC permissions are limited to the deploy workflow.

### REPO-04 — Low (privacy) — Third-party fonts and embeds are not minimized

- **Location:** Google Fonts in `src/_layouts/base.njk:14-16`; YouTube privacy-enhanced iframe in `src/items/video-item.njk:18`; external HubSpot signup link in `src/_includes/footer.njk:39-44`.
- **Evidence:** All pages connect to Google Fonts. Video detail pages load `youtube-nocookie.com` immediately. The iframe has no `referrerpolicy` or `sandbox` and grants clipboard write, encrypted media, gyroscope, and other features. Newsletter signup leaves the site for HubSpot; there is no embedded form in this repository.
- **Impact:** Page visits disclose network metadata to Google; video pages contact YouTube before interaction. Broad iframe capabilities increase exposure if embedded content is compromised. HubSpot handles personal data after navigation and must be covered by privacy disclosures.
- **Fix:** Self-host the selected font (the repository already self-hosts other fonts), use a click-to-load video facade, narrow iframe `allow`, add `referrerpolicy="strict-origin-when-cross-origin"`, and assess whether sandboxing is compatible. Make the privacy notice explicit at newsletter signup.
- **False-positive note:** `youtube-nocookie.com` is preferable to the standard embed and the HubSpot form is not embedded, so both risks are lower than common alternatives.

## Checks with no confirmed issue

- **Secrets:** No credential-like value or private-key block was found in tracked files or by the targeted history search. `.env` exists locally but is ignored by `.gitignore:1-3`; its contents were intentionally not inspected or reproduced. `ZENODO_TOKEN` comes from GitHub Secrets (`.github/workflows/build-deploy.yml:42`) and is used only as an Authorization header (`scripts/fetch-zenodo.mjs:234-238`).
- **Draft/development exposure:** Eleventy copies only explicit assets and `CNAME` (`eleventy.config.js:89-110`), and deploys only `dist` (`.github/workflows/build-deploy.yml:51-54`). Probes of `.env`, `.git/config`, `package.json`, the lockfile, and README at the GitHub Pages project URL returned 404. No draft collection was found.
- **Template/DOM XSS:** Nunjucks autoescaping is active by default. Remote rich-text descriptions are converted to plain text (`src/reports/item.njk:121-125`, `src/lib/content-utils.cjs:29-35`). Layout `content | safe` is the normal Eleventy pattern for already-rendered child templates. JSON embedded in scripts uses `scriptSafeJson`, escaping `<`, `>`, `&`, U+2028, and U+2029 (`src/lib/content-utils.cjs:38-44`). The search renderer uses `innerHTML`, but every dynamic field is HTML-escaped (`src/assets/js/site-search.js:24-31,105-114`); no attacker-controlled executable sink was confirmed.
- **Forms:** Repository forms are client-side GET search forms and do not transmit data to a backend (`src/_layouts/landing-page.njk:10-27`, `src/_includes/header.njk:47`). Newsletter collection happens only after an explicit navigation to HubSpot.
- **Dependencies:** `pnpm install --frozen-lockfile` is used. The production dependency set is minimal. The package manager version is pinned in `package.json`. The audit command did not report a finding during this review, but dependency scanning should still be automated because advisory data changes continuously.
- **Cookies/local storage:** Repository JavaScript does not directly set cookies or use web storage. Google Analytics and embedded/linked third parties remain separate privacy considerations.

## Hosting-configuration recommendations

### HC-01 — Put the static site behind a header-capable edge

GitHub Pages does not allow this repository to set arbitrary response headers. If these controls are desired, put the working site behind Cloudflare or another header-capable edge; the custom-domain migration is a natural point to do so. Start CSP in `Content-Security-Policy-Report-Only`, collect violations, then enforce it. A feasible end state after self-hosting citation code, CSL, and fonts is:

```text
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self' https://share.hsforms.com; script-src 'self'; style-src 'self'; img-src 'self' data: https://zenodo.org; media-src 'self' https:; frame-src https://www.youtube-nocookie.com; connect-src 'self' https://doi.org; upgrade-insecure-requests
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()
Cross-Origin-Opener-Policy: same-origin
```

Adjust `connect-src` after observing Citation.js/DOI behavior, or eliminate it through build-time citation generation. If Google Analytics remains, its script/connect/image origins and consent behavior must be added deliberately. Use CSP `frame-ancestors` rather than relying only on legacy `X-Frame-Options`.

Consider HSTS only after verifying that the domain and every required subdomain are permanently HTTPS-capable; do not add `includeSubDomains` or preload casually.

### HC-02 — Make privacy behavior testable

Maintain a short data inventory covering Cloudflare/GitHub access logs, Google Analytics, Google Fonts, YouTube, DOI resolution, jsDelivr, Zenodo media, and HubSpot newsletter signup. Document purpose, data fields, processors, retention, transfers, and consent/legal basis. Add a release check that records cookies/storage and third-party requests before interaction and after video/analytics consent.

### HC-03 — Add continuous security checks

Enable dependency update automation and advisory scanning, secret scanning/push protection, and CodeQL for JavaScript. Add a post-deploy smoke test for the current GitHub Pages URL. Before custom-domain launch, extend that test to assert that the custom domain returns the Eleventy page (not a cross-host redirect) and verifies the required response headers.

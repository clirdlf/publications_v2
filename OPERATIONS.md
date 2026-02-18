# OPERATIONS.md

CLIR Publications Static Site

---

## 1. What This Site Is

`publications.clir.org` is a static site built with:

* [Eleventy (11ty)](https://www.11ty.dev/)
* [Tailwind](https://tailwindcss.com/) (via [PostCSS](https://postcss.org/))
* [Zenodo community](https://zenodo.org/communities/clir/) as canonical metadata source (for reports)
* Client-side search ([MiniSearch](https://lucaong.github.io/minisearch/))
* No runtime backend

Everything is built at deploy time. Nothing fetches live APIs in production.

If something looks wrong on the site, it is either:

1. Incorrect in Zenodo metadata
2. Incorrect in a local `_data/*.json` file
3. A build script failure

It is not a database issue. **There is no database**.

---

## 2. System of Record

### Reports

[Zenodo community](https://zenodo.org/communities/clir/): `clir`

All reports displayed on the site come from Zenodo community membership.

If a report is not appearing:

* Confirm it is in the CLIR Zenodo community
* Confirm it has required metadata
* Trigger a rebuild

Required Zenodo Metadata

#### Every record must have:

* Title
* Publication date
* Description (abstract)
* Creators
* Community: **CLIR**
* Keywords following controlled vocabulary rules (see below)
* DOI
* Attached files (PDF, HTML, ZIP)

## 3. Controlled Vocabulary (Keywords)

Zenodo keywords must follow this prefix convention:

### Required prefixes

* type:report
* series:annual-report (if applicable)

### Optional prefixes

* topic:open-access
* topic:digital-preservation
* program:xyz
* audience:libraries

Rules:

* Do not invent new `type:` values without updating this document.
* Do not use free text for `type:` or `series:`.
* Prefixes are lowercase.
* No spaces around the colon.

Example:

```text
type:report
series:annual-report
topic:open-access
```

The site parses these programmatically. If you change patterns, you must update build scripts.

---

## 4. Legacy / Outliers

Some historical reports:

* May not have PDFs
* May only have consolidated HTML pages
* May not exist in Zenodo

These are handled via:

```bash
src/_data/outliers.json
```

Only use this file when:

* A record cannot reasonably be represented in Zenodo
* A legacy HTML page must be preserved

Goal: keep this file small.

---

## 5. Redirects

Old URLs on `www.clir.org` are redirected via Apache.

Source of truth:

```bash
src/_data/redirects.json
```

Build script generates:

```bash
dist/assets/redirects.map
```

Apache uses that generated map file.

Never manually edit `redirects.map`.

---

## 6. Build Process

### Local development

```bash
pnpm install
pnpm run dev
```

To refresh Zenodo metadata locally:

```bash
pnpm run fetch:zenodo
```

Note: `pnpm fetch` is a pnpm dependency command and does not run project scripts.

This:

* Fetches Zenodo records
* Builds search index
* Generates redirect map
* Compiles Tailwind
* Runs Eleventy dev server

### Production build

```bash
pnpm run build
```

Order of operations:

* Fetch Zenodo records
* Normalize metadata
* Build search index
* Generate Apache redirect map
* Compile Tailwind
* Run Eleventy
* Run smoke tests

If build fails, fix the error before deploying.

---

## 7. Deployment

* Hosted on Cloudflare Pages (or GitHub Pages if changed later)
* GitHub Actions triggers:
    * Scheduled nightly build
    * Manual rebuild via workflow_dispatch

To manually rebuild:

* Go to GitHub → Actions → “Build & Deploy”
* Click “Run workflow”

---

## 8. Updating Zenodo Content

Publishing workflow:

* Create or update record in Zenodo
* Ensure correct community
* Apply required keyword prefixes
* Publish
* Trigger rebuild

The site will reflect changes after next build.

---

## 9. Dependency Policy

This site intentionally has very few dependencies:

* @11ty/eleventy
* tailwindcss
* @tailwindcss/postcss
* postcss
* minisearch
* zod

Rules:

* Update dependencies only when necessary.
* Accept Dependabot PRs when build passes.
* Upgrade Node only when moving to next LTS.

Do not introduce:

* Databases
* Server runtimes
* Client-side frameworks unless justified
* Build tools beyond PostCSS

The goal is long-term stability, not novelty.

---

## 10. Adding a New Collection

Preferred method:

* Add `series:collection-name` to Zenodo records.
* Create a template page filtering on that keyword.

Avoid hardcoding ID lists unless absolutely necessary.

---

## 11. Troubleshooting

### Report missing?

* Check Zenodo community membership
* Check keyword prefixes
* Rebuild site

### Build failing?

* Check Zenodo API availability
* Check schema validation errors (Zod)
* Check that required metadata fields exist

### Search not working?

* Ensure dist/assets/search-index.json exists
* Confirm search index built during build step

---

## 12.  What Not To Do

* Do not fetch Zenodo at runtime.
* Do not manually edit generated JSON files.
* Do not bypass keyword conventions.
* Do not add a CMS unless absolutely required.

This project is intentionally static.

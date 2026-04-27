# CLIR Publications

Static site for `publications.clir.org`.

Built with:
- Eleventy (11ty)
- Tailwind CSS (via PostCSS)
- MiniSearch
- Zenodo community metadata (`clir`) as system of record for reports

## Requirements

- Node.js `>=23`
- `pnpm` (project uses `pnpm@10.30.0`)

## Install

```bash
pnpm install
```

## Local Development

Start Eleventy + CSS watch:

```bash
pnpm run dev
```

Refresh remote data when needed:

```bash
pnpm run fetch
```

Or fetch only Zenodo:

```bash
pnpm run fetch:zenodo
```

## Build Commands

Core build:

```bash
pnpm run build
```

Other build-related commands:

```bash
pnpm run index
pnpm run redirects:map
pnpm run smoke
pnpm run clean
```

## Tests

Run automated tests:

```bash
pnpm run test
```

Watch mode:

```bash
pnpm run test:watch
```

## Production Build Flow

Production deployment uses this order:

1. Fetch Zenodo metadata
2. Normalize metadata (inside fetch script)
3. Build search index
4. Generate Apache redirect map
5. Compile Tailwind
6. Run Eleventy
7. Run smoke tests

See: `.github/workflows/build-deploy.yml`

## Data Sources

- Reports: Zenodo community `clir`
- Legacy report migration model: `docs/legacy-reports.md`
- Redirect source of truth: `src/_data/redirects.json`
- Generated redirect map: `dist/assets/redirects.map` (do not edit manually)

## Legacy Reports

Historical reports that only exist as legacy HTML should be migrated as structured content packages, not as ad hoc HTML fragments or one-off JSON records.

Preferred shape:

```text
content/legacy-reports/<report-slug>/
  report.md
  manifest.json
  images/
  files/
```

This keeps source markdown, report-local assets, provenance, and optional PDFs together in a form that can be normalized into the same report schema used by Zenodo-backed content.

See: `docs/legacy-reports.md`

## Metadata Rules (Zenodo)

Required report metadata includes:
- title
- publication date
- description
- creators
- community (`CLIR`)
- DOI
- attached files
- controlled keywords

Keyword format examples:

```text
type:report
series:annual-report
topic:open-access
```

## Deployment

GitHub Actions workflow: `Build & Deploy`
- nightly scheduled rebuild
- manual rebuild via `workflow_dispatch`

## Troubleshooting

Missing report:
- verify Zenodo community membership
- verify keyword prefixes
- trigger rebuild

Build failure:
- check Zenodo API availability
- check schema/validation failures
- confirm required metadata fields are present

## Operations Reference

For full operational guidance, see `OPERATIONS.md`.

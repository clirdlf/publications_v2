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
- Legacy/manual exceptions: `src/_data/outliers.json`
- Redirect source of truth: `src/_data/redirects.json`
- Generated redirect map: `dist/assets/redirects.map` (do not edit manually)

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

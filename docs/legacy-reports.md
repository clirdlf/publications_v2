# Legacy Reports Migration Model

This project already treats Zenodo metadata as the primary report data source. Legacy HTML-only reports should fit that same shape as closely as possible instead of introducing a separate rendering model.

## Recommendation

For historical reports that are not yet represented in Zenodo:

1. Store a canonical source package per report.
2. Normalize each package into the same report fields used by current item pages.
3. Treat PDFs as an attached derivative or preservation copy, not as the only web representation.

The goal is to make the next migration mostly a data export problem, not a template archaeology problem.

## Canonical Package

Each legacy report should live in its own directory outside the rendered site source:

```text
content/legacy-reports/
  1999-report-slug/
    report.md
    manifest.json
    images/
      figure-01.jpg
      figure-02.png
    files/
      report.pdf
```

Why this shape:

- `report.md` is the editorial source.
- `manifest.json` holds stable metadata and migration notes.
- `images/` keeps content-local media with the report.
- `files/` holds downloadable derivatives such as PDFs.

Do not scatter report images into `src/assets/images` unless they are reused as sitewide assets.

## Required Metadata

Every legacy package should define these fields, even if some values are `null`:

```json
{
  "id": "legacy-1999-example-report",
  "source_type": "legacy",
  "type": "report",
  "title": "Example Report",
  "slug": "example-report",
  "published": "1999-06-01",
  "creators": ["First Author", "Second Author"],
  "description": "Short summary used in cards, search, and metadata.",
  "keywords": ["type:report", "series:legacy"],
  "canonical_url": "https://publications.clir.org/reports/example-report/",
  "legacy_urls": [
    "https://www.clir.org/pubs/reports/example.html"
  ],
  "doi": null,
  "thumbnail": "images/figure-01.jpg",
  "html_source": "Imported from legacy site HTML on 2026-03-17",
  "rights": {
    "text": "CLIR",
    "images": "CLIR"
  },
  "files": [
    {
      "label": "PDF",
      "path": "files/report.pdf",
      "mime": "application/pdf"
    }
  ]
}
```

## Markdown Conventions

Use front matter in `report.md` only for fields needed at render time. Keep migration notes and provenance in `manifest.json`.

Example:

```md
---
id: legacy-1999-example-report
title: Example Report
slug: example-report
published: 1999-06-01
creators:
  - First Author
  - Second Author
description: Short summary used in cards and search.
keywords:
  - type:report
  - series:legacy
thumbnail: ./images/figure-01.jpg
layout: reports/item.njk
---

Introductory paragraph.

![Figure caption](./images/figure-01.jpg)
```

Use relative image paths. Do not embed absolute production URLs in markdown.

## Rendering Strategy

Legacy reports should eventually be normalized into the same object shape as `src/_data/zenodo.json`, with a small source discriminator such as:

```json
{
  "kind": "legacy",
  "type": "report"
}
```

That keeps these existing patterns reusable:

- report listing pages
- item detail pages
- search indexing
- structured metadata / JSON-LD
- redirects

The site should prefer one merged reports collection over parallel "Zenodo reports" and "legacy reports" templates.

## Cleanliness Rules

To keep future migrations clean:

- Keep one stable `id` per report that never depends on the slug.
- Keep `legacy_urls` in metadata so redirects can be generated from source data.
- Record provenance for every imported text and image.
- Preserve markdown as the source; do not commit hand-edited rendered HTML.
- Convert inline-styled or malformed legacy HTML into semantic markdown where practical.
- Keep footnotes, captions, tables, and appendices explicit rather than relying on brittle HTML fragments.
- Keep report-local assets inside the report package.
- Avoid custom per-report template logic unless a report is truly exceptional.

## When a PDF Is Enough

A PDF-only migration is acceptable when:

- the report is primarily archival and low traffic
- the original HTML is too broken or expensive to normalize
- the layout is essential and markdown would materially degrade meaning

Even then, keep the package metadata and attach the PDF in `files/`. Do not make the PDF the only record of provenance or redirects.

## Preferred Repository Boundaries

Best case:

1. Zenodo or another repository stores the preservation package and authoritative file attachments.
2. This Eleventy site consumes normalized metadata and renders access pages.

Fallback:

1. Store the canonical package in this repo under `content/legacy-reports/`.
2. Generate normalized data into `src/_data/` during the build.

The fallback is acceptable, but the site repo should not become the only long-term archive if a repository-of-record is available.

## Proposed Next Step

When you are ready to migrate actual reports:

1. Add `content/legacy-reports/` with one package per report.
2. Build a small normalization script that reads each package and emits `src/_data/legacy-reports.json`.
3. Merge that data with Zenodo records into one reports collection.
4. Generate redirects from each package's `legacy_urls`.
5. Keep PDFs optional but supported as downloadable files.

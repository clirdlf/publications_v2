import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import * as cheerio from "cheerio";

const DEFAULT_MAX_PAGES = 100;
const DEFAULT_DELAY_MS = 500;
const USER_AGENT = "CLIR-publications-legacy-migrator/1.0 (+https://www.clir.org/)";

function usage() {
  return `Usage:
  pnpm crawl:legacy --url <publication-root> [options]
  pnpm crawl:legacy --file <url-list> [options]

Options:
  --file <path>          Crawl one publication root per line; blank lines and # comments are ignored
  --slug <slug>          Package directory name (defaults to the URL's last segment)
  --output <directory>   Package parent (default: content/legacy-reports)
  --max-pages <number>   Stop after this many HTML pages (default: ${DEFAULT_MAX_PAGES})
  --delay-ms <number>    Delay between requests (default: ${DEFAULT_DELAY_MS})
  --dry-run              Discover pages and assets without writing a package
  --help                 Show this help
`;
}

function parseArgs(argv) {
  const options = {
    output: "content/legacy-reports",
    maxPages: DEFAULT_MAX_PAGES,
    delayMs: DEFAULT_DELAY_MS,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") options.help = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--url") options.url = argv[++index];
    else if (arg === "--file") options.file = argv[++index];
    else if (arg === "--slug") options.slug = argv[++index];
    else if (arg === "--output") options.output = argv[++index];
    else if (arg === "--max-pages") options.maxPages = Number(argv[++index]);
    else if (arg === "--delay-ms") options.delayMs = Number(argv[++index]);
    else throw new Error(`Unknown option: ${arg}`);
  }

  if (options.help) return options;
  if (Boolean(options.url) === Boolean(options.file)) {
    throw new Error("Use exactly one of --url or --file");
  }
  if (options.file && options.slug) {
    throw new Error("--slug can only be used with --url");
  }
  if (!Number.isInteger(options.maxPages) || options.maxPages < 1) {
    throw new Error("--max-pages must be a positive integer");
  }
  if (!Number.isInteger(options.delayMs) || options.delayMs < 0) {
    throw new Error("--delay-ms must be a non-negative integer");
  }
  return options;
}

function normalizeRoot(value) {
  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol)) throw new Error("--url must use HTTP or HTTPS");
  url.hash = "";
  url.search = "";
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}

function safeSlug(value) {
  const slug = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new Error("Could not derive a safe package slug");
  return slug;
}

function canonicalUrl(value) {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  return url;
}

function isInScope(url, root) {
  return url.origin === root.origin && url.pathname.startsWith(root.pathname);
}

function looksLikePage(url) {
  const extension = path.posix.extname(url.pathname).toLowerCase();
  return !extension || extension === ".html" || extension === ".htm" || url.pathname.endsWith("/");
}

function isLinkedDocument(url) {
  return /\.(pdf|docx?|xlsx?|pptx?|rtf|txt|csv|zip)$/i.test(url.pathname);
}

function relativeUrlPath(url, root) {
  let relative = decodeURIComponent(url.pathname.slice(root.pathname.length));
  relative = relative.replace(/^\/+|\/+$/g, "");
  return relative;
}

function pageOutputPath(url, root) {
  const relative = relativeUrlPath(url, root);
  if (!relative) return "pages/index.html";
  if (/\.html?$/i.test(relative)) return `pages/${relative}`;
  return `pages/${relative}/index.html`;
}

function assetOutputPath(url, root) {
  const inRoot = isInScope(url, root);
  const relative = inRoot
    ? relativeUrlPath(url, root)
    : `${url.hostname}${decodeURIComponent(url.pathname)}`.replace(/^\/+/, "");
  const cleaned = relative
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, "-"))
    .join("/");
  return `assets/${cleaned || "asset"}`;
}

function extensionForContentType(contentType) {
  const mime = String(contentType || "").split(";", 1)[0].trim().toLowerCase();
  return new Map([
    ["image/gif", ".gif"],
    ["image/jpeg", ".jpg"],
    ["image/png", ".png"],
    ["image/svg+xml", ".svg"],
    ["image/webp", ".webp"],
    ["application/pdf", ".pdf"],
  ]).get(mime) || "";
}

function assetPathForResponse(url, root, contentType) {
  let outputPath = assetOutputPath(url, root).replace(/\/$/, "");
  if (!path.posix.extname(outputPath)) outputPath += extensionForContentType(contentType);
  return outputPath;
}

function localReference(fromPath, toPath) {
  const relative = path.posix.relative(path.posix.dirname(fromPath), toPath);
  return relative || path.posix.basename(toPath);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchResource(url, delayMs) {
  if (delayMs) await sleep(delayMs);
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html,image/*,application/pdf;q=0.8,*/*;q=0.1" },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response;
}

function resolveHttpUrl(value, base) {
  if (!value || /^(data:|mailto:|tel:|javascript:)/i.test(value)) return null;
  try {
    const url = new URL(value, base);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function discoverAndRewrite($, pageUrl, pagePath, root, enqueuePage, enqueueAsset) {
  $("a[href]").each((_index, element) => {
    const target = resolveHttpUrl($(element).attr("href"), pageUrl);
    if (!target) return;
    if (isInScope(target, root) && looksLikePage(target)) {
      const canonical = canonicalUrl(target);
      enqueuePage(canonical);
      $(element).attr("href", localReference(pagePath, pageOutputPath(canonical, root)));
    } else if (
      (isInScope(target, root) && !looksLikePage(target)) ||
      (target.origin === root.origin && isLinkedDocument(target))
    ) {
      const assetPath = assetOutputPath(target, root);
      enqueueAsset(target, assetPath);
      $(element).attr("href", localReference(pagePath, assetPath));
    }
  });

  for (const [selector, attribute] of [["img[src]", "src"], ["source[src]", "src"], ["object[data]", "data"]]) {
    $(selector).each((_index, element) => {
      const target = resolveHttpUrl($(element).attr(attribute), pageUrl);
      if (!target) return;
      const assetPath = assetOutputPath(target, root);
      enqueueAsset(target, assetPath);
      $(element).attr(attribute, localReference(pagePath, assetPath));
    });
  }

  $("img[srcset], source[srcset]").each((_index, element) => {
    const rewritten = String($(element).attr("srcset") || "")
      .split(",")
      .map((candidate) => {
        const [value, ...descriptor] = candidate.trim().split(/\s+/);
        const target = resolveHttpUrl(value, pageUrl);
        if (!target) return candidate.trim();
        const assetPath = assetOutputPath(target, root);
        enqueueAsset(target, assetPath);
        return [localReference(pagePath, assetPath), ...descriptor].join(" ");
      })
      .join(", ");
    $(element).attr("srcset", rewritten);
  });
}

async function crawlPublication(options, inputUrl) {
  const root = normalizeRoot(inputUrl);
  const inferredSlug = root.pathname.split("/").filter(Boolean).at(-1);
  const slug = safeSlug(options.slug || inferredSlug);
  const packageRoot = path.resolve(options.output, slug);
  const pageQueue = [root];
  const queuedPages = new Set([root.href]);
  const assets = new Map();
  const pages = [];
  const failures = [];
  const reclassifiedPages = new Map();

  const enqueuePage = (url) => {
    if (queuedPages.has(url.href) || queuedPages.size >= options.maxPages) return;
    queuedPages.add(url.href);
    pageQueue.push(url);
  };
  const enqueueAsset = (url, outputPath) => {
    if (/\/wp-accessibility\/imgs\/alt-missing\.png$/i.test(url.pathname)) return;
    if (!assets.has(url.href)) assets.set(url.href, { url, outputPath });
  };

  while (pageQueue.length && pages.length < options.maxPages) {
    const pageUrl = pageQueue.shift();
    const outputPath = pageOutputPath(pageUrl, root);
    process.stdout.write(`page  ${pageUrl.href}\n`);
    try {
      const response = await fetchResource(pageUrl, options.delayMs);
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) {
        const assetPath = assetPathForResponse(pageUrl, root, contentType);
        const bytes = Buffer.from(await response.arrayBuffer());
        assets.set(pageUrl.href, { url: pageUrl, outputPath: assetPath, contentType, bytes: bytes.length, capturedBytes: bytes });
        reclassifiedPages.set(pageUrl.href, { guessedPath: outputPath, assetPath });
        process.stdout.write(`asset ${pageUrl.href} (${contentType || "unknown content type"})\n`);
        continue;
      }
      const source = await response.text();
      const $ = cheerio.load(source);
      discoverAndRewrite($, pageUrl, outputPath, root, enqueuePage, enqueueAsset);
      pages.push({ url: pageUrl.href, outputPath, title: $("title").first().text().trim(), html: $.html() });
    } catch (error) {
      failures.push({ url: pageUrl.href, error: error.message });
      process.stderr.write(`failed ${pageUrl.href}: ${error.message}\n`);
    }
  }

  for (const asset of assets.values()) {
    process.stdout.write(`asset ${asset.url.href}\n`);
    if (options.dryRun) continue;
    try {
      let bytes = asset.capturedBytes;
      if (!bytes) {
        const response = await fetchResource(asset.url, options.delayMs);
        bytes = Buffer.from(await response.arrayBuffer());
        asset.contentType = response.headers.get("content-type") || null;
      }
      const destination = path.join(packageRoot, asset.outputPath);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, bytes);
      asset.bytes = bytes.length;
      delete asset.capturedBytes;
    } catch (error) {
      failures.push({ url: asset.url.href, error: error.message });
    }
  }

  const manifest = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    rootUrl: root.href,
    scope: { origin: root.origin, pathPrefix: root.pathname, maxPages: options.maxPages },
    pages: pages.map(({ html: _html, ...page }) => page),
    assets: [...assets.values()].map(({ url, capturedBytes: _capturedBytes, ...asset }) => ({ url: url.href, ...asset })),
    failures,
  };

  if (!options.dryRun) {
    await fs.mkdir(packageRoot, { recursive: true });
    for (const page of pages) {
      const $ = cheerio.load(page.html);
      for (const { guessedPath, assetPath } of reclassifiedPages.values()) {
        const oldReference = localReference(page.outputPath, guessedPath);
        const newReference = localReference(page.outputPath, assetPath);
        $(`a[href="${oldReference}"]`).attr("href", newReference);
      }
      page.html = $.html();
      const destination = path.join(packageRoot, page.outputPath);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, page.html, "utf8");
    }
    await fs.writeFile(path.join(packageRoot, "crawl-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  process.stdout.write(`\n${options.dryRun ? "Dry run" : "Captured"}: ${pages.length} pages, ${assets.size} assets, ${failures.length} failures\n`);
  if (!options.dryRun) process.stdout.write(`Package: ${packageRoot}\n`);
  return { rootUrl: root.href, slug, pages: pages.length, assets: assets.size, failures };
}

async function readUrlList(filename) {
  const source = await fs.readFile(filename, "utf8");
  const urls = source
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+#.*$/, "").trim())
    .filter((line) => line && !line.startsWith("#"));
  if (!urls.length) throw new Error(`No URLs found in ${filename}`);
  return urls;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  const inputs = options.file ? await readUrlList(options.file) : [options.url];
  const seenRoots = new Set();
  const seenSlugs = new Set();
  const results = [];

  for (const input of inputs) {
    const root = normalizeRoot(input);
    if (seenRoots.has(root.href)) {
      process.stderr.write(`Skipping duplicate URL: ${root.href}\n`);
      continue;
    }
    seenRoots.add(root.href);

    const inferredSlug = safeSlug(root.pathname.split("/").filter(Boolean).at(-1));
    if (seenSlugs.has(inferredSlug)) {
      results.push({ rootUrl: root.href, slug: inferredSlug, pages: 0, assets: 0, failures: [{ url: root.href, error: `Duplicate output slug: ${inferredSlug}` }] });
      process.stderr.write(`Skipping ${root.href}: duplicate output slug ${inferredSlug}\n`);
      continue;
    }
    seenSlugs.add(inferredSlug);

    process.stdout.write(`\n=== ${root.href} ===\n`);
    try {
      results.push(await crawlPublication(options, root.href));
    } catch (error) {
      results.push({ rootUrl: root.href, slug: inferredSlug, pages: 0, assets: 0, failures: [{ url: root.href, error: error.message }] });
      process.stderr.write(`Failed publication ${root.href}: ${error.message}\n`);
    }
  }

  if (options.file) {
    const failed = results.filter((result) => result.failures.length);
    const totalPages = results.reduce((sum, result) => sum + result.pages, 0);
    const totalAssets = results.reduce((sum, result) => sum + result.assets, 0);
    process.stdout.write(`\nBatch: ${results.length} publications, ${totalPages} pages, ${totalAssets} assets, ${failed.length} publications with failures\n`);
  }

  if (results.some((result) => result.failures.length)) process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n\n${usage()}`);
  process.exitCode = 1;
});

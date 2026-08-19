import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import * as cheerio from "cheerio";
import TurndownService from "turndown";

const CONTENT_ROOT = path.resolve("content/legacy-reports");

function usage() {
  return `Usage:
  pnpm convert:legacy --slug <report-slug> [--check]
  pnpm convert:legacy --all [--check]

Options:
  --slug <slug>   Process one package under content/legacy-reports
  --all           Process every package containing conversion.json
  --check         Validate and report what would be written without writing files
  --help          Show this help
`;
}

function parseArgs(argv) {
  const options = { check: false, all: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--slug") options.slug = argv[++index];
    else if (arg === "--all") options.all = true;
    else if (arg === "--check") options.check = true;
    else if (arg === "--help") options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!options.help && Boolean(options.slug) === options.all) {
    throw new Error("Use exactly one of --slug or --all");
  }
  return options;
}

function assertInside(parent, target, label) {
  const relative = path.relative(parent, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} escapes its allowed directory: ${target}`);
  }
}

function pageAnchor(relativePage) {
  const value = relativePage
    .replace(/^pages\//, "")
    .replace(/\/index\.html$/i, "")
    .replace(/\.html?$/i, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `legacy-page-${value || "index"}`.toLowerCase();
}

function createTurndown() {
  const service = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "_",
  });
  service.keep(["table"]);
  service.addRule("namedAnchor", {
    filter: (node) => node.nodeName === "A" && node.hasAttribute("id") && !node.hasAttribute("href"),
    replacement: (_content, node) => `\n\n<a id="${node.getAttribute("id")}"></a>\n\n`,
  });
  return service;
}

async function listSlugs(options) {
  if (options.slug) return [options.slug];
  const entries = await fs.readdir(CONTENT_ROOT, { withFileTypes: true });
  const slugs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      await fs.access(path.join(CONTENT_ROOT, entry.name, "conversion.json"));
      slugs.push(entry.name);
    } catch {
      // Not a conversion package.
    }
  }
  return slugs.sort();
}

async function convertPackage(slug, options) {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) throw new Error(`Invalid slug: ${slug}`);
  const packageRoot = path.join(CONTENT_ROOT, slug);
  assertInside(CONTENT_ROOT, packageRoot, "Package path");
  const recipePath = path.join(packageRoot, "conversion.json");
  const recipe = JSON.parse(await fs.readFile(recipePath, "utf8"));

  if (!recipe.title || !recipe.output || !recipe.contentSelector || !Array.isArray(recipe.pages)) {
    throw new Error(`${slug}: conversion.json is missing a required field`);
  }

  const outputPath = path.resolve(packageRoot, recipe.output);
  const imageOutput = path.resolve(recipe.imageOutput);
  assertInside(packageRoot, outputPath, "Markdown output");
  assertInside(path.resolve("src/images/legacy"), imageOutput, "Image output");

  const pageFiles = new Map();
  for (const relativePage of recipe.pages) {
    const filename = path.resolve(packageRoot, relativePage);
    assertInside(packageRoot, filename, "Page path");
    pageFiles.set(filename, { relativePage, anchor: pageAnchor(relativePage) });
  }

  const warnings = [];
  const images = new Map();
  const sections = [];

  for (const [filename, page] of pageFiles) {
    let source;
    try {
      source = await fs.readFile(filename, "utf8");
    } catch (error) {
      warnings.push(`${page.relativePage}: ${error.message}`);
      continue;
    }
    const $ = cheerio.load(source);
    const selected = $(recipe.contentSelector);
    if (!selected.length) {
      warnings.push(`${page.relativePage}: selector matched no content`);
      continue;
    }
    if (selected.length > 1) warnings.push(`${page.relativePage}: selector matched ${selected.length} elements`);

    const body = cheerio.load(`<div id="conversion-root">${selected.first().html() || ""}</div>`, null, false);
    body("script, style, form, button, .elementor-widget-post-navigation, .post-navigation").remove();
    body('img[src*="wp-accessibility/imgs/alt-missing.png"]').remove();
    body("[srcset]").removeAttr("srcset");
    body("#conversion-root").prepend(`<a id="${page.anchor}"></a>`);

    body("img[src]").each((_index, element) => {
      const value = body(element).attr("src");
      if (!value || /^(data:|https?:)/i.test(value)) {
        if (value && !value.startsWith("data:")) warnings.push(`${page.relativePage}: remote image remains: ${value}`);
        return;
      }
      const sourceImage = path.resolve(path.dirname(filename), value);
      let basename = path.basename(sourceImage);
      const prior = images.get(basename);
      if (prior && prior.sourceImage !== sourceImage) {
        const extension = path.extname(basename);
        const stem = path.basename(basename, extension);
        const suffix = crypto.createHash("sha256").update(sourceImage).digest("hex").slice(0, 8);
        basename = `${stem}-${suffix}${extension}`;
      }
      images.set(basename, { sourceImage, basename });
      body(element).attr("src", `${String(recipe.imagePublicPath).replace(/\/$/, "")}/${basename}`);
    });

    body("a[href]").each((_index, element) => {
      const value = body(element).attr("href");
      if (!value || /^(#|https?:|mailto:|tel:)/i.test(value)) return;
      const target = path.resolve(path.dirname(filename), value.split("#", 1)[0]);
      const targetPage = pageFiles.get(target);
      if (targetPage) body(element).attr("href", `#${targetPage.anchor}`);
    });

    const markdown = createTurndown().turndown(body("#conversion-root").html() || "").trim();
    sections.push(markdown);
  }

  for (const image of images.values()) {
    try {
      await fs.access(image.sourceImage);
    } catch {
      warnings.push(`Missing image: ${image.sourceImage}`);
    }
  }

  const frontMatter = [
    "---",
    `title: ${JSON.stringify(recipe.title)}`,
    `legacy_source: ${JSON.stringify(slug)}`,
    "---",
    "",
  ].join("\n");
  const markdown = `${frontMatter}${sections.filter(Boolean).join("\n\n---\n\n")}\n`;

  if (!options.check) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, markdown, "utf8");
    await fs.mkdir(imageOutput, { recursive: true });
    for (const image of images.values()) {
      try {
        await fs.copyFile(image.sourceImage, path.join(imageOutput, image.basename));
      } catch {
        // The missing file is already recorded as a warning.
      }
    }
  }

  return {
    slug,
    pages: recipe.pages.length,
    sections: sections.length,
    images: images.size,
    markdownBytes: Buffer.byteLength(markdown),
    warnings,
    outputPath,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  const results = [];
  for (const slug of await listSlugs(options)) {
    try {
      const result = await convertPackage(slug, options);
      results.push(result);
      process.stdout.write(`${slug}: ${result.sections}/${result.pages} pages, ${result.images} images, ${result.markdownBytes} Markdown bytes${options.check ? " (check only)" : ""}\n`);
      for (const warning of result.warnings) process.stderr.write(`  warning: ${warning}\n`);
    } catch (error) {
      results.push({ slug, warnings: [error.message], failed: true });
      process.stderr.write(`${slug}: ${error.message}\n`);
    }
  }

  if (results.some((result) => result.failed || result.warnings.length)) process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n\n${usage()}`);
  process.exitCode = 1;
});

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { BrewPackage } from "../src/lib/packages";

const API_BASE = "https://formulae.brew.sh/api";
const outputPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../.cache/packages.json",
);

const formulaSchema = z.object({
  name: z.string(),
  desc: z.string().nullable().optional(),
  homepage: z.string(),
  license: z.union([z.string(), z.record(z.string(), z.unknown())]).nullable().optional(),
  versions: z.object({ stable: z.string().nullable().optional() }),
  dependencies: z.array(z.string()).optional(),
  aliases: z.array(z.string()).optional(),
  analytics: z.object({
    install_on_request: z.record(z.string(), z.record(z.string(), z.number())).optional(),
  }).optional(),
});

const caskSchema = z.object({
  token: z.string(),
  name: z.array(z.string()).optional(),
  desc: z.string().nullable().optional(),
  homepage: z.string(),
  version: z.string().nullable().optional(),
  depends_on: z.object({ formula: z.array(z.string()).optional() }).optional(),
});

const formulaAnalyticsSchema = z.object({
  items: z.array(z.object({ formula: z.string(), count: z.string() })),
});

const caskAnalyticsSchema = z.object({
  items: z.array(z.object({ cask: z.string(), count: z.string() })),
});

async function fetchJson(path: string) {
  const response = await fetch(`${API_BASE}/${path}`, {
    headers: { "user-agent": "brewly-data-sync" },
  });
  if (!response.ok) throw new Error(`Homebrew API returned ${response.status} for ${path}`);
  return response.json();
}

function licenseLabel(value: unknown) {
  if (typeof value === "string") return value;
  return value ? "See source" : undefined;
}

function formulaInstalls30d(item: z.infer<typeof formulaSchema>) {
  return item.analytics?.install_on_request?.["30d"]?.[item.name];
}

function numericCount(count: string) {
  return Number.parseInt(count.replaceAll(",", ""), 10);
}

const [rawFormulae, rawCasks, rawFormulaAnalytics, rawCaskAnalytics] = await Promise.all([
  fetchJson("formula.json"),
  fetchJson("cask.json"),
  fetchJson("analytics/install-on-request/30d.json"),
  fetchJson("analytics/cask-install/30d.json"),
]);

const formulaPopularity = new Map(
  formulaAnalyticsSchema.parse(rawFormulaAnalytics).items.map((item) => [item.formula, numericCount(item.count)]),
);
const caskPopularity = new Map(
  caskAnalyticsSchema.parse(rawCaskAnalytics).items.map((item) => [item.cask, numericCount(item.count)]),
);

const formulae = z.array(formulaSchema).parse(rawFormulae).map<BrewPackage>((item) => ({
  slug: item.name,
  name: item.name,
  type: "formula",
  version: item.versions.stable ?? "unknown",
  description: item.desc ?? "Homebrew formula",
  homepage: item.homepage,
  license: licenseLabel(item.license),
  dependencies: item.dependencies ?? [],
  installs30d: formulaPopularity.get(item.name) ?? formulaInstalls30d(item),
  aliases: item.aliases,
}));

const casks = z.array(caskSchema).parse(rawCasks).map<BrewPackage>((item) => ({
  slug: item.token,
  name: item.name?.[0] ?? item.token,
  type: "cask",
  version: item.version ?? "unknown",
  description: item.desc ?? "Homebrew cask",
  homepage: item.homepage,
  dependencies: item.depends_on?.formula ?? [],
  installs30d: caskPopularity.get(item.token),
}));

const packages = [...formulae, ...casks].sort((a, b) => a.slug.localeCompare(b.slug));
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(packages)}\n`, "utf8");

console.log(`Synced ${formulae.length} formulae and ${casks.length} casks.`);

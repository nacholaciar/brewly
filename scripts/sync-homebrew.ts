import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { NewsItem } from "../src/lib/news";
import type { BrewPackage, PackageDownload, PackageStatus, PackageType } from "../src/lib/packages";

const API_BASE = "https://formulae.brew.sh/api";
const outputPath = resolve(dirname(fileURLToPath(import.meta.url)), "../.cache/packages.json");
const newsOutputPath = resolve(dirname(fileURLToPath(import.meta.url)), "../.cache/news.json");
const NEWS_WINDOW_DAYS = 14;

const formulaSchema = z.object({
  name: z.string(),
  desc: z.string().nullable().optional(),
  homepage: z.string(),
  license: z
    .union([z.string(), z.record(z.string(), z.unknown())])
    .nullable()
    .optional(),
  versions: z.object({ stable: z.string().nullable().optional() }),
  dependencies: z.array(z.string()).optional(),
  aliases: z.array(z.string()).optional(),
  oldnames: z.array(z.string()).optional(),
  tap: z.string().optional(),
  deprecated: z.boolean().optional(),
  deprecation_date: z.string().nullable().optional(),
  deprecation_reason: z.string().nullable().optional(),
  deprecation_replacement_formula: z.string().nullable().optional(),
  disabled: z.boolean().optional(),
  disable_date: z.string().nullable().optional(),
  disable_reason: z.string().nullable().optional(),
  disable_replacement_formula: z.string().nullable().optional(),
  caveats: z.string().nullable().optional(),
  conflicts_with: z.array(z.string()).optional(),
  tap_git_head: z.string().optional(),
  ruby_source_path: z.string().optional(),
  bottle: z
    .object({
      stable: z
        .object({
          files: z.record(z.string(), z.object({ url: z.string(), sha256: z.string().nullable().optional() })),
        })
        .nullable()
        .optional(),
    })
    .optional(),
  analytics: z
    .object({
      install_on_request: z.record(z.string(), z.record(z.string(), z.number())).optional(),
    })
    .optional(),
});

const caskSchema = z.object({
  token: z.string(),
  name: z.array(z.string()).optional(),
  desc: z.string().nullable().optional(),
  homepage: z.string(),
  version: z.string().nullable().optional(),
  url: z.string().optional(),
  sha256: z.string().nullable().optional(),
  depends_on: z
    .object({
      formula: z.array(z.string()).optional(),
      macos: z.record(z.string(), z.array(z.string())).optional(),
    })
    .optional(),
  old_tokens: z.array(z.string()).optional(),
  tap: z.string().optional(),
  auto_updates: z.boolean().nullable().optional(),
  deprecated: z.boolean().optional(),
  deprecation_date: z.string().nullable().optional(),
  deprecation_reason: z.string().nullable().optional(),
  deprecation_replacement_formula: z.string().nullable().optional(),
  deprecation_replacement_cask: z.string().nullable().optional(),
  disabled: z.boolean().optional(),
  disable_date: z.string().nullable().optional(),
  disable_reason: z.string().nullable().optional(),
  disable_replacement_formula: z.string().nullable().optional(),
  disable_replacement_cask: z.string().nullable().optional(),
  caveats: z.string().nullable().optional(),
  conflicts_with: z
    .object({
      cask: z.array(z.string()).optional(),
      formula: z.array(z.string()).optional(),
    })
    .nullable()
    .optional(),
  languages: z.array(z.string()).optional(),
  artifacts: z.array(z.record(z.string(), z.unknown())).optional(),
  container: z.record(z.string(), z.unknown()).nullable().optional(),
  tap_git_head: z.string().optional(),
  ruby_source_path: z.string().optional(),
  supported_platforms: z.array(z.string()).optional(),
  variations: z
    .record(
      z.string(),
      z.object({
        url: z.string().nullable().optional(),
        version: z.string().nullable().optional(),
        sha256: z.string().nullable().optional(),
      }),
    )
    .optional(),
});

const formulaAnalyticsSchema = z.object({
  items: z.array(z.object({ formula: z.string(), count: z.string() })),
});

const caskAnalyticsSchema = z.object({
  items: z.array(z.object({ cask: z.string(), count: z.string() })),
});

const githubCommitSearchSchema = z.object({
  items: z.array(
    z.object({
      sha: z.string(),
      html_url: z.url(),
      commit: z.object({
        message: z.string(),
        committer: z.object({ date: z.string() }),
      }),
    }),
  ),
});

async function fetchJson(path: string) {
  const response = await fetch(`${API_BASE}/${path}`, {
    headers: { "user-agent": "brewly-data-sync" },
  });
  if (!response.ok) throw new Error(`Homebrew API returned ${response.status} for ${path}`);
  return response.json();
}

async function fetchGithubCommits(repository: string, kind: "formula" | "cask") {
  const since = new Date(Date.now() - (NEWS_WINDOW_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
  const query = `repo:${repository} "new ${kind}" committer-date:>=${since}`;
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "brewly-data-sync",
    "x-github-api-version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const url = new URL("https://api.github.com/search/commits");
  url.searchParams.set("q", query);
  url.searchParams.set("sort", "committer-date");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", "100");

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status} for ${repository}`);
  }
  return githubCommitSearchSchema.parse(await response.json()).items;
}

function newPackageSlug(message: string, kind: "formula" | "cask") {
  const match = message.match(new RegExp(`^([^\\s]+)\\s+.+?\\s+\\(new ${kind}\\)`, "im"));
  return match?.[1];
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

function analyticsMap(raw: unknown, type: PackageType) {
  if (type === "formula") {
    return new Map(formulaAnalyticsSchema.parse(raw).items.map((item) => [item.formula, numericCount(item.count)]));
  }
  return new Map(caskAnalyticsSchema.parse(raw).items.map((item) => [item.cask, numericCount(item.count)]));
}

function packageStatus(
  active: boolean | undefined,
  date: string | null | undefined,
  reason: string | null | undefined,
  replacement: string | null | undefined,
): PackageStatus | undefined {
  return active
    ? {
        date: date ?? undefined,
        reason: reason ?? undefined,
        replacement: replacement ?? undefined,
      }
    : undefined;
}

function sourceUrl(type: PackageType, head?: string, path?: string) {
  if (!head || !path) return undefined;
  const repository = type === "cask" ? "homebrew-cask" : "homebrew-core";
  return `https://github.com/Homebrew/${repository}/blob/${head}/${path}`;
}

function platformName(value: string) {
  if (value.endsWith("_linux")) return "Linux";
  return value
    .replace(/^arm64_/, "")
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function platformArchitecture(value: string): PackageDownload["architecture"] {
  if (value === "arm64_linux") return "ARM64";
  if (value === "x86_64_linux") return "x86_64";
  return value.startsWith("arm64_") ? "Apple Silicon" : "Intel";
}

function nonEmpty<T>(values: T[] | undefined) {
  return values && values.length > 0 ? values : undefined;
}

function macosRequirement(requirement: Record<string, string[]> | undefined) {
  if (!requirement) return undefined;
  const constraints = Object.entries(requirement).flatMap(([operator, versions]) =>
    versions.map((version) => `${operator} ${version}`),
  );
  return constraints.length > 0 ? `macOS ${constraints.join(" or ")}` : undefined;
}

function groupDownloads(rows: PackageDownload[]) {
  const grouped = new Map<string, PackageDownload>();
  for (const row of rows) {
    const key = [row.architecture, row.url, row.version, row.sha256].join("\0");
    const current = grouped.get(key);
    if (current) current.platforms.push(...row.platforms);
    else grouped.set(key, { ...row, platforms: [...row.platforms] });
  }
  return [...grouped.values()];
}

function caskDownloads(item: z.infer<typeof caskSchema>): PackageDownload[] | undefined {
  if (!item.url) return undefined;
  const rows = (item.supported_platforms ?? []).map((platform) => {
    const variation = item.variations?.[platform];
    return {
      architecture: platformArchitecture(platform),
      platforms: [platformName(platform)],
      url: variation?.url ?? item.url ?? "",
      version: variation?.version ?? item.version ?? undefined,
      sha256: variation?.sha256 ?? item.sha256 ?? undefined,
    } satisfies PackageDownload;
  });
  return groupDownloads(
    rows.length > 0
      ? rows
      : [{ platforms: ["macOS"], url: item.url, version: item.version ?? undefined, sha256: item.sha256 ?? undefined }],
  );
}

function formulaDownloads(item: z.infer<typeof formulaSchema>): PackageDownload[] | undefined {
  const files = item.bottle?.stable?.files;
  if (!files) return undefined;
  return Object.entries(files).map(([platform, file]) => ({
    architecture: platformArchitecture(platform),
    platforms: [platformName(platform)],
    url: file.url,
    version: item.versions.stable ?? undefined,
    sha256: file.sha256 ?? undefined,
  }));
}

function artifactLabels(artifacts: Array<Record<string, unknown>> | undefined) {
  const labels = new Set<string>();
  for (const artifact of artifacts ?? []) {
    for (const key of ["app", "pkg", "binary"]) {
      const values = artifact[key];
      if (!Array.isArray(values)) continue;
      for (const value of values) {
        if (typeof value === "string") labels.add(value.replace(/^.*\//, ""));
      }
    }
  }
  return labels.size > 0 ? [...labels] : undefined;
}

function containerLabel(container: Record<string, unknown> | null | undefined) {
  if (!container) return undefined;
  if (typeof container.type === "string") return container.type;
  if (typeof container.nested === "string") return `nested: ${container.nested}`;
  return undefined;
}

const [rawFormulae, rawCasks, formula30d, formula90d, formula365d, cask30d, cask90d, cask365d] = await Promise.all([
  fetchJson("formula.json"),
  fetchJson("cask.json"),
  fetchJson("analytics/install-on-request/30d.json"),
  fetchJson("analytics/install-on-request/90d.json"),
  fetchJson("analytics/install-on-request/365d.json"),
  fetchJson("analytics/cask-install/30d.json"),
  fetchJson("analytics/cask-install/90d.json"),
  fetchJson("analytics/cask-install/365d.json"),
]);

const formulaPopularity30d = analyticsMap(formula30d, "formula");
const formulaPopularity90d = analyticsMap(formula90d, "formula");
const formulaPopularity365d = analyticsMap(formula365d, "formula");
const caskPopularity30d = analyticsMap(cask30d, "cask");
const caskPopularity90d = analyticsMap(cask90d, "cask");
const caskPopularity365d = analyticsMap(cask365d, "cask");

const formulae = z
  .array(formulaSchema)
  .parse(rawFormulae)
  .map<BrewPackage>((item) => ({
    slug: item.name,
    name: item.name,
    type: "formula",
    version: item.versions.stable ?? "unknown",
    description: item.desc ?? "Homebrew formula",
    homepage: item.homepage,
    license: licenseLabel(item.license),
    dependencies: item.dependencies ?? [],
    installs30d: formulaPopularity30d.get(item.name) ?? formulaInstalls30d(item),
    installs90d: formulaPopularity90d.get(item.name),
    installs365d: formulaPopularity365d.get(item.name),
    aliases: item.aliases,
    previousNames: nonEmpty(item.oldnames),
    tap: item.tap,
    sourceUrl: sourceUrl("formula", item.tap_git_head, item.ruby_source_path),
    downloads: formulaDownloads(item),
    deprecated: packageStatus(
      item.deprecated,
      item.deprecation_date,
      item.deprecation_reason,
      item.deprecation_replacement_formula,
    ),
    disabled: packageStatus(item.disabled, item.disable_date, item.disable_reason, item.disable_replacement_formula),
    caveats: item.caveats ?? undefined,
    conflicts: nonEmpty(item.conflicts_with),
  }));

const casks = z
  .array(caskSchema)
  .parse(rawCasks)
  .map<BrewPackage>((item) => ({
    slug: item.token,
    name: item.name?.[0] ?? item.token,
    type: "cask",
    version: item.version ?? "unknown",
    description: item.desc ?? "Homebrew cask",
    homepage: item.homepage,
    dependencies: item.depends_on?.formula ?? [],
    installs30d: caskPopularity30d.get(item.token),
    installs90d: caskPopularity90d.get(item.token),
    installs365d: caskPopularity365d.get(item.token),
    previousNames: nonEmpty(item.old_tokens),
    tap: item.tap,
    sourceUrl: sourceUrl("cask", item.tap_git_head, item.ruby_source_path),
    macosRequirement: macosRequirement(item.depends_on?.macos),
    downloads: caskDownloads(item),
    autoUpdates: item.auto_updates ?? undefined,
    deprecated: packageStatus(
      item.deprecated,
      item.deprecation_date,
      item.deprecation_reason,
      item.deprecation_replacement_cask ?? item.deprecation_replacement_formula,
    ),
    disabled: packageStatus(
      item.disabled,
      item.disable_date,
      item.disable_reason,
      item.disable_replacement_cask ?? item.disable_replacement_formula,
    ),
    caveats: item.caveats ?? undefined,
    conflicts: nonEmpty([...(item.conflicts_with?.cask ?? []), ...(item.conflicts_with?.formula ?? [])]),
    languages: nonEmpty(item.languages),
    artifacts: artifactLabels(item.artifacts),
    container: containerLabel(item.container),
  }));

const packages = [...formulae, ...casks].sort((a, b) => a.slug.localeCompare(b.slug));
const packageByKey = new Map(packages.map((item) => [`${item.type}:${item.slug}`, item]));

const [formulaCommits, caskCommits] = await Promise.all([
  fetchGithubCommits("Homebrew/homebrew-core", "formula"),
  fetchGithubCommits("Homebrew/homebrew-cask", "cask"),
]);

const newsByKey = new Map<string, NewsItem>();
const mergeCommitKeys = new Set<string>();
for (const [type, commits] of [
  ["formula", formulaCommits],
  ["cask", caskCommits],
] as const) {
  for (const commit of commits) {
    const slug = newPackageSlug(commit.commit.message, type);
    if (!slug) continue;
    const key = `${type}:${slug}`;
    const item = packageByKey.get(key);
    if (!item) continue;

    const candidate: NewsItem = {
      ...item,
      publishedAt: commit.commit.committer.date,
      commitUrl: commit.html_url,
    };
    const current = newsByKey.get(key);
    const candidateIsMerge = commit.commit.message.startsWith("Merge pull request");
    if (candidateIsMerge || (!mergeCommitKeys.has(key) && (!current || candidate.publishedAt > current.publishedAt))) {
      newsByKey.set(key, candidate);
    }
    if (candidateIsMerge) mergeCommitKeys.add(key);
  }
}

const news = [...newsByKey.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(packages)}\n`, "utf8");
await writeFile(newsOutputPath, `${JSON.stringify(news)}\n`, "utf8");

console.log(`Synced ${formulae.length} formulae and ${casks.length} casks.`);
console.log(`Synced ${news.length} new packages from the last ${NEWS_WINDOW_DAYS} days.`);

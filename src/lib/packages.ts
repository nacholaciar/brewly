export type PackageType = "formula" | "cask";

export type PackageDownload = {
  architecture?: "Apple Silicon" | "Intel" | "ARM64" | "x86_64";
  platforms: string[];
  url: string;
  version?: string;
  sha256?: string;
};

export type PackageStatus = {
  date?: string;
  reason?: string;
  replacement?: string;
};

export type BrewPackage = {
  slug: string;
  name: string;
  type: PackageType;
  version: string;
  description: string;
  homepage: string;
  license?: string;
  dependencies: string[];
  installs30d?: number;
  installs90d?: number;
  installs365d?: number;
  aliases?: string[];
  previousNames?: string[];
  tap?: string;
  sourceUrl?: string;
  macosRequirement?: string;
  downloads?: PackageDownload[];
  autoUpdates?: boolean;
  deprecated?: PackageStatus;
  disabled?: PackageStatus;
  caveats?: string;
  conflicts?: string[];
  languages?: string[];
  artifacts?: string[];
  container?: string;
};

export function packagePath(item: Pick<BrewPackage, "type" | "slug">) {
  return `/${item.type}/${item.slug}`;
}

export function installCommand(item: Pick<BrewPackage, "type" | "slug">) {
  return item.type === "cask" ? `brew install --cask ${item.slug}` : `brew install ${item.slug}`;
}

export function apiUrl(item: Pick<BrewPackage, "type" | "slug">) {
  return `https://formulae.brew.sh/api/${item.type}/${encodeURIComponent(item.slug)}.json`;
}

export function pullRequestsUrl(item: Pick<BrewPackage, "type" | "slug">) {
  const repository = item.type === "cask" ? "homebrew-cask" : "homebrew-core";
  const query = new URLSearchParams({ q: `sort:updated-desc is:pr ${item.slug} in:title` });
  return `https://github.com/Homebrew/${repository}/pulls?${query}`;
}

export function searchPackage(item: BrewPackage): BrewPackage {
  const searchable = { ...item };
  delete searchable.artifacts;
  delete searchable.caveats;
  delete searchable.conflicts;
  delete searchable.container;
  delete searchable.downloads;
  delete searchable.languages;
  delete searchable.sourceUrl;
  return searchable;
}

export type PackageType = "formula" | "cask";

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
  aliases?: string[];
};

export function packagePath(item: Pick<BrewPackage, "type" | "slug">) {
  return `/${item.type}/${item.slug}`;
}

export function installCommand(item: Pick<BrewPackage, "type" | "slug">) {
  return item.type === "cask" ? `brew install --cask ${item.slug}` : `brew install ${item.slug}`;
}

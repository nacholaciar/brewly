import type { BrewPackage, PackageType } from "./packages";

export type NewsItem = BrewPackage & {
  publishedAt: string;
  commitUrl: string;
};

export type NewsFilter = "all" | PackageType;

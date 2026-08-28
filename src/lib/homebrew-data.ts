import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { news as sampleNews } from "../data/news";
import { packages as samplePackages } from "../data/packages";
import type { NewsItem } from "./news";
import type { BrewPackage } from "./packages";

const generatedDataPath = resolve(process.cwd(), ".cache/packages.json");
const generatedNewsPath = resolve(process.cwd(), ".cache/news.json");

export function loadPackages(): BrewPackage[] {
  if (!existsSync(generatedDataPath)) return samplePackages;
  return JSON.parse(readFileSync(generatedDataPath, "utf8")) as BrewPackage[];
}

export function loadNews(): NewsItem[] {
  if (!existsSync(generatedNewsPath)) return sampleNews;
  return JSON.parse(readFileSync(generatedNewsPath, "utf8")) as NewsItem[];
}

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { packages as samplePackages } from "../data/packages";
import type { BrewPackage } from "./packages";

const generatedDataPath = resolve(process.cwd(), ".cache/packages.json");

export function loadPackages(): BrewPackage[] {
  if (!existsSync(generatedDataPath)) return samplePackages;
  return JSON.parse(readFileSync(generatedDataPath, "utf8")) as BrewPackage[];
}

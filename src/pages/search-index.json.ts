import type { APIRoute } from "astro";
import { loadPackages } from "../lib/homebrew-data";
import { searchPackage } from "../lib/packages";

export const prerender = true;

export const GET: APIRoute = () => {
  return new Response(JSON.stringify(loadPackages().map(searchPackage)), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
};

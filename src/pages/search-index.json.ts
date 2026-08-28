import type { APIRoute } from "astro";
import { loadPackages } from "../lib/homebrew-data";

export const prerender = true;

export const GET: APIRoute = () => {
  return new Response(JSON.stringify(loadPackages()), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
};

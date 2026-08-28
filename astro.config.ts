import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.SITE_URL,
  integrations: [react(), sitemap({ entryLimit: 5000 })],
  prefetch: true,
  vite: {
    plugins: [tailwindcss()],
  },
});

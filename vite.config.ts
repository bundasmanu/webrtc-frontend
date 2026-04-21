import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

/** Public base path. Set `VITE_BASE` only for subpath hosts (e.g. GitHub Pages project sites). Local dev: omit. */
function normalizeViteBase(raw: string | undefined): string {
  const t = raw?.trim();
  if (!t) return "/";
  const withLeading = t.startsWith("/") ? t : `/${t}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

export default defineConfig({
  base: normalizeViteBase(process.env.VITE_BASE),
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});

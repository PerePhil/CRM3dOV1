import { readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Read the global `/*` block of public/_headers (the file Cloudflare Pages serves) so
 * `vite preview`, and therefore the Playwright smoke test, runs under the same CSP and
 * security headers as production. One source of truth: edit _headers, not this.
 */
function pagesHeaders(): Record<string, string> {
  const text = readFileSync(new URL("./public/_headers", import.meta.url), "utf8");
  const headers: Record<string, string> = {};
  let inGlobalBlock = false;
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      inGlobalBlock = line.trim() === "/*";
      continue;
    }
    if (!inGlobalBlock) continue;
    const i = line.indexOf(":");
    if (i > 0) headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return headers;
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true },
  preview: { headers: pagesHeaders() },
  worker: { format: "es" },
  // No source maps: the public site must not ship readable source (the repo is private).
  build: {
    target: "es2022",
    sourcemap: false,
    // Emit fonts as files, never data: URIs, so the CSP can keep font-src 'self'.
    assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined),
  },
});

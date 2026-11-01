#!/usr/bin/env node
// dist-guard: run after building apps/web. Fails if the build would publish source maps
// (the repo is private; the public site must not ship readable source) or if the Cloudflare
// Pages _headers / robots.txt files are missing from the output.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const DIST = "apps/web/dist";
const REQUIRED = ["index.html", "_headers", "robots.txt"];

if (!existsSync(DIST)) {
  console.error(`dist-guard: ${DIST} not found. Build apps/web first.`);
  process.exit(1);
}

const maps = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith(".map")) maps.push(relative(".", p));
  }
};
walk(DIST);

const missing = REQUIRED.filter((f) => !existsSync(join(DIST, f)));

for (const m of maps) console.error(`dist-guard: source map in build output: ${m}`);
for (const f of missing) console.error(`dist-guard: missing from build output: ${DIST}/${f}`);
if (maps.length || missing.length) process.exit(1);
console.warn(`dist-guard: ok (no .map files; ${REQUIRED.join(", ")} present)`);

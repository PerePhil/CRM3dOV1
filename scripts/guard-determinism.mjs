#!/usr/bin/env node
// determinism-guard: fails if non-deterministic APIs appear in the engine packages.
// The sim and risk engines must produce identical output for identical (config, seed).
// See AGENTS.md §4.3 and SPEC §3.2.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["packages/core/src", "packages/sim/src", "packages/risk/src"];
const BANNED = [
  { re: /\bMath\.random\s*\(/, why: "use createRng(seed) from @ov1/core" },
  { re: /\bDate\.now\s*\(/, why: "sim time comes from the tick counter, not the wall clock" },
  { re: /\bnew\s+Date\s*\(/, why: "sim time comes from the tick counter, not the wall clock" },
  {
    re: /\bperformance\.now\s*\(/,
    why: "sim time comes from the tick counter, not the wall clock",
  },
  { re: /\bcrypto\.getRandomValues\s*\(/, why: "use createRng(seed) from @ov1/core" },
  { re: /\bcrypto\.randomUUID\s*\(/, why: "derive IDs from the seeded RNG or a counter" },
];
// Escape hatch for a deliberate, reviewed exception: put this on the same line.
const ALLOW = "determinism-guard: allow";

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) files.push(p);
  }
};
for (const r of ROOTS) {
  try {
    walk(r);
  } catch {
    /* package may not exist yet */
  }
}

const hits = [];
for (const f of files) {
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (line.includes(ALLOW)) return;
    const code = line.replace(/\/\/.*$/, ""); // ignore line comments
    for (const { re, why } of BANNED) {
      if (re.test(code)) hits.push(`${relative(".", f)}:${i + 1}  ${line.trim()}\n    → ${why}`);
    }
  });
}

if (hits.length) {
  console.error(`✖ determinism-guard: ${hits.length} violation(s)\n`);
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}
console.log(`✔ determinism-guard: ${files.length} files clean`);

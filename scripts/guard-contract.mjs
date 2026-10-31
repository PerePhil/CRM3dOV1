#!/usr/bin/env node
// contract-guard: if a frozen contract file changed vs. the base branch, SPEC.md must change too.
// Usage: node scripts/guard-contract.mjs [baseRef]   (default: origin/main)
// See AGENTS.md §4.2 and SPEC §9.
import { execFileSync } from "node:child_process";

const CONTRACTS = [
  "packages/catalog/src/schema.ts",
  "packages/sim/src/events.ts",
  "packages/core/src/rng.ts",
];
const base = process.argv[2] ?? "origin/main";

let changed;
try {
  changed = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
} catch (e) {
  console.error(`✖ contract-guard: could not diff against ${base}. Fetch it first.\n${e.message}`);
  process.exit(2);
}

const touched = CONTRACTS.filter((c) => changed.includes(c));
if (touched.length === 0) {
  console.log("✔ contract-guard: no contract files changed");
  process.exit(0);
}
if (!changed.includes("SPEC.md")) {
  console.error("✖ contract-guard: frozen contract file(s) changed without a SPEC.md update:");
  for (const t of touched) console.error(`    ${t}`);
  console.error("\n  Contract changes need a `contract`-labeled task and a matching SPEC.md edit in the same PR.");
  process.exit(1);
}
console.log(`✔ contract-guard: ${touched.join(", ")} changed with SPEC.md, so owner review is required`);

#!/usr/bin/env node
// Seed GitHub labels, milestones, and issues from tasks/backlog.yaml.
// Idempotent: existing labels are updated, existing milestones and issues (matched by title) are skipped.
//
//   pnpm tasks:seed --dry-run                 # print what would be created
//   pnpm tasks:seed                           # run against the current repo (needs `gh auth login`)
//   pnpm tasks:seed --repo owner/name         # run against a specific repo
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const repoIdx = args.indexOf("--repo");
const REPO = repoIdx >= 0 ? args[repoIdx + 1] : undefined;
const env = { ...process.env, ...(REPO ? { GH_REPO: REPO } : {}) };

const gh = (ghArgs, input) =>
  execFileSync("gh", ghArgs, { encoding: "utf8", env, input, stdio: ["pipe", "pipe", "inherit"] });

const LABELS = [
  ["task", "ededed", "Unit of work"],
  ["bug", "d73a4a", "Something is wrong"],
  ["in-progress", "fbca04", "Claimed: someone (or their agent) is working on it"],
  ["agent-ok", "0e8a16", "An agent can do this end to end; a human reviews"],
  ["human-only", "5319e7", "Needs human judgment, sourcing, or presentation work"],
  ["contract", "b60205", "Touches a frozen contract file; PR must update SPEC.md"],
  ["area:scene", "1d76db", "apps/web 3D scene + UI"],
  ["area:sim", "0052cc", "packages/sim"],
  ["area:risk", "006b75", "packages/risk + analysis"],
  ["area:catalog", "c5def5", "packages/catalog"],
  ["area:docs", "bfdadc", "docs/, ADRs, report"],
  ["area:infra", "666666", "CI, tooling, deploy"],
];

const { milestones, tasks } = parse(readFileSync(new URL("../tasks/backlog.yaml", import.meta.url), "utf8"));

// ---- validate backlog ----
const keys = new Set();
for (const t of tasks) {
  for (const f of ["key", "title", "milestone", "area", "who", "goal"]) {
    if (!t[f]) throw new Error(`backlog: task ${t.key ?? t.title} missing "${f}"`);
  }
  if (keys.has(t.key)) throw new Error(`backlog: duplicate key ${t.key}`);
  for (const d of t.depends ?? []) {
    if (!keys.has(d)) throw new Error(`backlog: ${t.key} depends on "${d}", which must appear earlier`);
  }
  if (!milestones[t.milestone]) throw new Error(`backlog: ${t.key} has unknown milestone ${t.milestone}`);
  keys.add(t.key);
}

const bullets = (xs) => (xs?.length ? xs.map((x) => `- ${x}`).join("\n") : "_none listed_");
const checks = (xs) => (xs?.length ? xs.map((x) => `- [ ] ${x}`).join("\n") : "- [ ] `pnpm verify` passes");

const body = (t, numberByKey) =>
  [
    `### Area\n${t.area}`,
    `### Who can do this\n${t.who}`,
    `### Goal\n${t.goal}`,
    `### Files in scope\n${bullets((t.in_scope ?? []).map((f) => `\`${f}\``))}`,
    `### Off-limits / out of scope\n${t.off_limits ?? "Anything not listed above. See AGENTS.md §4."}`,
    `### Acceptance criteria\n${checks([...(t.acceptance ?? []), "`pnpm verify` passes"])}`,
    `### Tests required\n${t.tests ?? (t.who === "agent-ok" ? "Unit tests for any sim/risk/catalog logic." : "n/a")}`,
    `### Depends on\n${(t.depends ?? []).map((d) => (numberByKey[d] ? `#${numberByKey[d]}` : d)).join(", ") || "none"}`,
    `\n<sub>seeded from tasks/backlog.yaml · key: \`${t.key}\`</sub>`,
  ].join("\n\n");

if (DRY) {
  console.log(`DRY RUN: ${LABELS.length} labels, ${Object.keys(milestones).length} milestones, ${tasks.length} issues\n`);
  for (const [k, m] of Object.entries(milestones)) {
    console.log(`\n${m.title} (due ${m.due})`);
    for (const t of tasks.filter((x) => x.milestone === k)) {
      console.log(`  [${t.who === "agent-ok" ? "agent" : "human"}] ${t.title}${t.depends ? `  ← ${t.depends.join(", ")}` : ""}`);
    }
  }
  process.exit(0);
}

// ---- labels ----
for (const [name, color, description] of LABELS) {
  gh(["label", "create", name, "--color", color, "--description", description, "--force"]);
}
console.log(`✔ ${LABELS.length} labels`);

// ---- milestones ----
const existingMs = JSON.parse(gh(["api", "repos/{owner}/{repo}/milestones?state=all&per_page=100"]));
for (const m of Object.values(milestones)) {
  if (existingMs.some((e) => e.title === m.title)) continue;
  gh([
    "api", "-X", "POST", "repos/{owner}/{repo}/milestones",
    "-f", `title=${m.title}`,
    "-f", `due_on=${m.due}T23:59:59Z`,
    "-f", `description=${m.description}`,
  ]);
  console.log(`  + milestone ${m.title}`);
}
console.log("✔ milestones");

// ---- issues ----
const existing = JSON.parse(gh(["issue", "list", "--state", "all", "--limit", "1000", "--json", "number,title"]));
const numberByKey = {};
for (const t of tasks) {
  const hit = existing.find((e) => e.title === t.title);
  if (hit) {
    numberByKey[t.key] = hit.number;
    continue;
  }
  const labels = ["task", t.who, `area:${t.area}`, ...(t.contract ? ["contract"] : [])];
  const url = gh(
    ["issue", "create", "--title", t.title, "--body-file", "-", "--label", labels.join(","), "--milestone", milestones[t.milestone].title],
    body(t, numberByKey),
  ).trim();
  numberByKey[t.key] = Number(url.split("/").pop());
  console.log(`  + #${numberByKey[t.key]} ${t.title}`);
}
console.log(`✔ ${tasks.length} tasks present as issues`);
console.log("\nNext: create a GitHub Project board (README → Shared to-do list) and add these issues to it.");

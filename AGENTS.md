# AGENTS.md: Rules for every coding agent in this repo

This is the **only** agent instruction file. `CLAUDE.md`, `.github/copilot-instructions.md`, and `.cursor/rules/project.mdc` all point here. Several people's agents (Claude Code, Codex, Cursor, Copilot, …) work in this repo at once. These rules exist so you don't break each other's work.

## 0. Before you write any code
1. Read **`SPEC.md`**. It is the source of truth. If your task conflicts with it, stop and comment on the issue. Do not "fix" the spec yourself.
2. Read the **GitHub issue** you were assigned. Its **Files in scope** list is a hard boundary.
3. Check that the issue has the `in-progress` label and an assignee. If someone else holds it, stop.

## 1. Project in one paragraph
A browser-based 3D **DoDAF OV-1** of a Boeing UAV mission in contested airspace. Users toggle link denial and spoofing, malware, and controls. A **deterministic simulation** shows what the UAV does, and **headless Monte Carlo** over that sim estimates FAIR *Vulnerability*, which feeds a **FAIR risk engine** (ALE, loss exceedance curves, ROSI). The look is an **OV-1 briefing graphic** (SPEC §8), not a game HUD and not a dark-mode dashboard.

## 2. Commands
| Command | What it does |
|---|---|
| `pnpm install` | Install everything (use `--frozen-lockfile` in CI) |
| `pnpm dev` | Run the web app at http://localhost:5173 |
| `pnpm verify` | **The gate.** Biome check, determinism guard, typecheck, unit tests, Python tests, build. **Must pass before you open a PR.** |
| `pnpm fix` | Auto-format and auto-fix lint |
| `pnpm test` / `pnpm test:py` / `pnpm test:e2e` | TS unit tests / Python tests / Playwright smoke |
| `pnpm golden` | Regenerate Python golden vectors in `fixtures/` (only if your task says to) |

Use **pnpm only**, never npm or yarn. Python runs through **uv** (`uv run --project analysis …`), never bare `pip`.

## 3. Repo map
```
apps/web            React + React Three Fiber OV-1 app (scene/, panels/, bridge/, theme/)
packages/core       seeded PRNG, units, shared helpers. No DOM.
packages/catalog    THE CONTRACT: zod schema + JSON data for nodes, links, threats, controls, scenarios
packages/sim        deterministic fixed-timestep simulation + event log. No DOM, no three.js.
packages/risk       FAIR Monte Carlo engine. No DOM.
analysis/           Python (uv): independent cross-checks, golden vectors, report figures
fixtures/           generated golden vectors. Don't hand-edit.
docs/               ADRs, threat model, FAIR parameter sources, design refs, report
tasks/backlog.yaml  seed for GitHub Issues (one-time; Issues are the live task list)
```

## 4. Hard rules
1. **Stay in scope.** Only modify files listed in your issue's *Files in scope*, plus their tests. If you need to touch something else, comment on the issue and stop. Don't widen scope silently.
2. **Contracts are frozen.** These files change only via a task labeled `contract`, and the same PR must update `SPEC.md`:
   - `packages/catalog/src/schema.ts`
   - `packages/sim/src/events.ts`
   - `packages/core/src/rng.ts`

   CI's `contract-guard` fails the PR otherwise.
3. **Determinism.** In `packages/core`, `packages/sim`, and `packages/risk`, never use `Math.random`, `Date.now`, `performance.now`, `new Date()`, or `crypto.getRandomValues`. Use `createRng(seed)` from `@ov1/core`. CI's `determinism-guard` enforces this.
4. **No DOM or three.js in `packages/*`.** Those packages run in Node and Web Workers.
5. **No hardcoded IDs or names.** Every node, link, threat, control, and scenario ID comes from `@ov1/catalog`. Don't write `"L-LOS"` in a component. Import it.
6. **Sim and risk code ship with tests.** Scene and visual code can be exploratory, but it must never contain sim or risk logic.
7. **No new dependencies** unless the issue allows it or you justify each one in the PR body. Never add a dependency just to save ten lines.
8. **Don't edit** `SPEC.md`, `AGENTS.md`, `.github/**`, `scripts/guard-*.mjs`, `biome.json`, or `tsconfig.base.json` unless that is the task.
9. **Never weaken a test or guard to make CI pass.** Fix the code, or stop and explain on the issue.
10. **Secrets and data:** never commit `.env`, tokens, or keys. Use **open-source information only**: no CUI, no ITAR/EAR technical data, no employer data. Every FAIR estimate needs a source in `docs/fair/`.

## 5. Code style
- TypeScript **strict**, no `any`, no non-null `!` without a comment saying why. Prefer pure functions and plain data.
- Units: SI internally (m, s, Hz, W/dBW). Name variables with units when ambiguous (`rangeM`, `freqHz`, `powerDbw`).
- Biome formats. Don't hand-format; run `pnpm fix`.
- Python: ruff-clean, type-hinted, tests in `analysis/tests/`.

## 6. Design rules (scene and UI). Full version in SPEC §8.
- OV-1 briefing look: light sky, flat outlined platforms, labeled lightning-bolt links, callout boxes, legend, title block, and the green `UNCLASSIFIED // NOTIONAL — ACADEMIC USE` banner.
- **Affiliation colors:** friendly blue, hostile red, neutral green, unknown yellow. **Link color = type** (never red). **Line pattern = state.** Red means adversary, and only adversary.
- All colors and fonts come from `apps/web/src/theme/tokens.css`. No inline hex values.
- Fonts: Arimo for UI. JetBrains Mono only for numeric telemetry and the event log.
- 3D assets: CC0/CC-BY or procedural only, credited in `apps/web/public/models/CREDITS.md`.

## 7. Branches, commits, PRs
- Branch: `agent/<issue#>-short-slug` (agent-written) or `<name>/<issue#>-short-slug` (human-written).
- Commits: Conventional Commits, e.g. `feat(sim): add FSPL link margin model (#12)`.
- PR: fill in the template completely. It must link the issue (`Closes #N`), state **which agent/model** wrote it, and leave reviewer assignment to the human owner. One task per PR, small diffs.
- Never push to `main` or force-push a shared branch.

## 8. When you're stuck
Comment on the issue with what you tried, what's blocking you, and the smallest decision a human needs to make. Then stop. A clear question beats a big wrong PR.

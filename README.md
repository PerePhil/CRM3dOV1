# CONTESTED // OV-1

**A 3D, interactive DoDAF OV-1 for cyber risk modeling of UAV operations in contested airspace.**
You can jam, spoof, or compromise each link and component of a notional Boeing MQ-25-class mission,
watch what the aircraft does, and see the result quantified with FAIR (ALE, loss exceedance, ROSI).

CMU Cyber Risk Modeling, Group Project, Scenario 3 · Jared Giesen · Phillip Steiger · Ella Park
Due 24 Nov 2026 · **[SPEC.md](SPEC.md) is the source of truth.**

> `UNCLASSIFIED // NOTIONAL — ACADEMIC USE`. Open-source information only. No CUI, no
> export-controlled technical data, no employer data. See SPEC §10.

**Public site:** <https://contested-ov1.pages.dev>. It updates automatically on every merge to `main`
(`.github/workflows/deploy.yml`). There are **no preview deploys** for PRs or branches. The GitHub repo
stays private, and production builds ship no source maps.

---

## Quickstart

```bash
corepack enable                 # gives you the pinned pnpm
pnpm install
uv sync --project analysis      # Python env for cross-checks (install uv: https://docs.astral.sh/uv/)
pnpm dev                        # http://localhost:5173
pnpm verify                     # the gate: run before every PR
```

Or open the repo in a **devcontainer** (VS Code / Codespaces), which installs everything above.

### Working in Claude Code cloud sessions (claude.ai/code)
- **Environment network:** limited / Trusted, with package managers on. Don't use full access.
- **Environment setup script:** leave it empty. It runs as root *outside* the repo before Claude starts, so it can't install project deps.
- **Project deps** install automatically through the SessionStart hook in `.claude/settings.json` → `scripts/cloud-setup.sh` (cloud only; no-op locally).
- **Viewing changes:** download the `ov1-slide-view` screenshot artifact from the PR's CI run, or ask Claude for a Playwright screenshot. See [CONTRIBUTING.md](CONTRIBUTING.md#reviewing-visual-changes).

> ⚠️ **Push with the git CLI, not GitHub's web uploader or Finder drag-and-drop.** Both silently drop dotfiles
> (`.github/`, `.gitignore`, `.claude/`, …), which removes CI, the guardrails, and the agent config.

---

## First-time setup (repo owner, once)

1. **Create an empty private GitHub repo** (no README or license, so the first push is clean).
2. **Generate the lockfiles and make the initial commit.** The lockfiles aren't in the zip; they have to be
   generated on a machine with registry access, and CI installs with `--frozen-lockfile` / `--locked`.
   ```bash
   cd contested-ov1
   pnpm install                    # → pnpm-lock.yaml
   (cd analysis && uv lock)        # → analysis/uv.lock
   pnpm fix                        # normalize formatting with the Biome version you just installed
   pnpm verify && pnpm test:e2e    # confirm everything is green on your machine
   git init -b main && git add -A && git commit -m "chore: initial scaffold"
   git remote add origin git@github.com:<you>/contested-ov1.git && git push -u origin main
   ```
3. **Fill in `.github/CODEOWNERS`.** Replace `@OWNER_PHILLIP`, `@OWNER_JARED`, `@OWNER_ELLA` with real usernames.
4. **Turn on branch protection** for `main` (settings listed in [CONTRIBUTING.md](CONTRIBUTING.md#repo-settings-owner-sets-these-once-they-arent-files)).
5. **Seed the shared to-do list:** `gh auth login`, then `pnpm tasks:seed --dry-run`, then `pnpm tasks:seed`.
6. **Create the Project board** (next section) and add the issues.
7. **Production deploys (Cloudflare Pages):** create the Pages project `contested-ov1` (production branch
   `main`). In GitHub, create a `production` **Environment** restricted to the `main` branch and add
   `CLOUDFLARE_API_TOKEN` (scoped to *Cloudflare Pages: Edit*) and `CLOUDFLARE_ACCOUNT_ID` as **environment
   secrets**. Never add them as repository secrets. Until they exist, the deploy workflow skips cleanly.
8. Add Jared and Ella as collaborators and send them this README.

---

## Shared to-do list

The to-do list is **GitHub Issues**, organized on a **GitHub Project board**. Issues are the one task
system that every person *and* every coding agent can read, claim, and close through a PR.

- **`tasks/backlog.yaml`** is the seed: 45 tasks across milestones M0–M3. Each task has an owner type
  (`agent-ok` / `human-only`), area, goal, **files in scope**, acceptance criteria, and dependencies.
- **`pnpm tasks:seed`** turns it into labels, dated milestones, and issues. It's idempotent, so re-running
  only adds what's new. After seeding, **Issues are the live list.** Don't track progress in the YAML.
- **Project board:** in GitHub, go to **Projects → New project → Board**, link it to the repo, and add all
  issues. Use the columns **Backlog → Ready → In progress → In review → Done**, group by *Milestone*, and
  filter by `label:agent-ok` or `label:human-only`. Or from the CLI:
  ```bash
  gh project create --owner <you> --title "CONTESTED // OV-1"
  gh issue list --limit 100 --json url -q '.[].url' | xargs -n1 gh project item-add <project#> --owner <you> --url
  ```
- **Claiming:** assign yourself and add the `in-progress` label. Agents are told (AGENTS.md §0) to stop
  if a task is already claimed.

| Milestone | Due | Exit criteria |
|---|---|---|
| M0: Foundations | Nov 8 | Repo live with guardrails, contracts seeded, static OV-1, ADRs, OV-1 refs |
| M1: Living OV-1 | Nov 15 | Sim engine; S1–S3 animate; link toggles, lost-link, event log + replay |
| M2: Quantified | Nov 22 | Monte Carlo → Vuln; FAIR engine; risk drawer with LEC + ROSI |
| M3: Ship | Nov 24 | Polish, demo links, report, deck + recorded backup, speaker map |

---

## How multiple agents share this repo safely

Three people, each running their own agents (Claude Code, Codex, Cursor, Copilot), in one repo. The
setup is built so a well-meaning agent can't quietly break someone else's work:

| Risk | What stops it |
|---|---|
| Agents get different instructions and drift | **One** rules file (`AGENTS.md`); every tool-specific file is a one-line pointer to it |
| Two agents edit the same files | Every issue declares **Files in scope**; claiming via `in-progress`; small one-issue PRs |
| An agent rewrites a shared interface | **Frozen contracts** + `contract-guard` CI + **CODEOWNERS** approval |
| "Works on my machine" toolchains | Pinned Node/pnpm/Python, lockfiles, devcontainer, **one gate command** (`pnpm verify`) used locally *and* in CI |
| Non-reproducible sim/risk numbers | Seeded PRNG + `determinism-guard` CI |
| Agent math silently drifts | Python **golden vectors** the TS must match |
| An agent loosens a test or CI rule to get green | Guardrail files are code-owned; AGENTS.md §4.9 forbids it |
| Secrets committed | `.gitignore`, Claude settings deny reading `.env`, TruffleHog in CI, GitHub push protection |
| Unclear authorship at grading time | PR template requires **which agent/model** wrote it and which human reviewed |

---

## What every file does

### Source of truth & rules
| File | Purpose |
|---|---|
| `SPEC.md` | **The source of truth:** scope, stack, domain model, math, design language, milestones. Code and agents defer to it. |
| `AGENTS.md` | **The only agent instruction file:** commands, repo map, hard rules, style, design rules, PR process. |
| `CLAUDE.md` | One line, `@AGENTS.md`, so Claude Code loads the same rules. |
| `.github/copilot-instructions.md` | Pointer to `AGENTS.md` for GitHub Copilot. |
| `.cursor/rules/project.mdc` | Pointer to `AGENTS.md` + `SPEC.md` for Cursor (always applied). |
| `CONTRIBUTING.md` | The human workflow: claim → branch → agent → verify → PR → review. Plus labels and repo settings. |
| `README.md` | This file. |

### Agent permissions & environment
| File | Purpose |
|---|---|
| `.claude/settings.json` | Shared Claude Code permissions. Registers the cloud **SessionStart hook**; allows pnpm/uv/git-read commands; **denies** reading `.env`/keys, force-push, pushing to main, `rm -rf`, and npm/yarn/pip. Personal overrides go in `.claude/settings.local.json` (gitignored). |
| `.devcontainer/devcontainer.json` | Identical environment for everyone and every cloud agent: Node 22, Python 3.13, uv, gh, Playwright Chromium, Biome/Ruff extensions. |
| `.node-version` | Pins Node 22 for nvm/fnm/volta, CI, and the deploy build. |
| `package.json` → `packageManager` | Pins the pnpm version via corepack. |

### Tooling & config
| File | Purpose |
|---|---|
| `package.json` | Root scripts (below) and shared dev tools (Biome, TypeScript, Vitest, yaml). |
| `pnpm-workspace.yaml` | Declares the monorepo: `apps/*`, `packages/*`. |
| `tsconfig.base.json` | Strict TypeScript settings every package extends. |
| `biome.json` | Formatter + linter (one tool, fast). Bans `any`, unused code, stray `console.log`. |
| `.editorconfig` | Indentation and line endings for any editor. |
| `.gitignore` | Keeps out deps, build output, secrets, and personal agent settings. |
| `.gitattributes` | Forces LF everywhere; marks lockfiles and fixtures as generated so diffs stay readable. |

### CI, review & coordination (`.github/`)
| File | Purpose |
|---|---|
| `workflows/ci.yml` | On every PR: **verify** (`pnpm verify` + `pnpm guard:dist`), **e2e** (Playwright smoke under the production CSP, plus the `ov1-slide-view` screenshot and report artifacts), **contract-guard**, **secrets-scan** (TruffleHog). |
| `workflows/deploy.yml` | On push to `main` only: builds `apps/web`, runs the dist guard, and deploys to Cloudflare Pages production (<https://contested-ov1.pages.dev>) from the `production` environment. Serialized with `concurrency`; skips cleanly if the secrets are missing. No PR or branch deploys. |
| `CODEOWNERS` | Who must approve what. Contracts, agent rules, and CI guardrails need the contract steward. |
| `ISSUE_TEMPLATE/agent-task.yml` | Task form with required **Files in scope**, acceptance criteria, tests, and dependencies. This is what makes agent tasks precise. |
| `ISSUE_TEMPLATE/bug.yml` | Bug form; asks for scenario + seed so bugs reproduce deterministically. |
| `ISSUE_TEMPLATE/config.yml` | Disables blank issues so everything uses a template. |
| `pull_request_template.md` | PR checklist + **authorship disclosure** (agent/model + human reviewer). |

### Scripts & tasks
| File | Purpose |
|---|---|
| `scripts/guard-determinism.mjs` | Fails if `Math.random`, `Date.now`, `new Date()`, `performance.now`, or `crypto.getRandomValues` appear in `packages/{core,sim,risk}`. |
| `scripts/guard-contract.mjs` | Fails if a frozen contract file changed without a `SPEC.md` change in the same PR. |
| `scripts/guard-dist.mjs` | Fails if the `apps/web/dist` build contains any `.map` file, or is missing `_headers` / `robots.txt`. |
| `scripts/cloud-setup.sh` | Installs pnpm + uv deps at the start of every Claude Code cloud session (via the SessionStart hook). No-op elsewhere. |
| `scripts/seed-tasks.mjs` | Creates labels, milestones, and issues from the backlog (`--dry-run` to preview). |
| `tasks/backlog.yaml` | The shared to-do list seed: 45 scoped tasks across M0–M3. |

### Code
| Path | Purpose |
|---|---|
| `packages/core/` | `rng.ts`: **frozen** seeded PRNG (xoshiro128\*\*) with order-independent `fork()` for parallel Monte Carlo. `units.ts`: dB/SI helpers. |
| `packages/catalog/` | **The contract.** `src/schema.ts` (**frozen** zod schemas with referential-integrity checks) + `data/*.json` (11 nodes, 7 links, 4 threats, 8 controls, 2 adversaries, S1–S3). `stix/` holds the STIX 2.1 bundle. |
| `packages/sim/` | `events.ts`: **frozen** event-log contract. `log.ts`: append-only, immutable log. Link, nav, kinematics, and lost-link models arrive via M1 tasks. |
| `packages/risk/` | Beta-PERT / Gamma / Beta / lognormal samplers, summaries, loss exceedance, ROSI. FAIR pipeline arrives via M2 tasks. |
| `apps/web/` | Vite + React Three Fiber OV-1. `theme/tokens.css` is the only place colors and fonts live. `scene/` has the diorama layout, lightning-bolt links, platform icons, and callouts. `components/` has the banner, title block, legend, caption overlay, and panels. `anim/` is the animation layer: Timeline format, pure interpreter, playback clock, R3F bindings, sim → timeline adapter, and the registered timelines (idle holding orbit by default). `panels/` has the scenario picker, playback controls, and live link table. `e2e/` has the Playwright smoke test. `public/_headers` sets the CSP and security headers on Cloudflare Pages (and on `vite preview`, so e2e runs under the same CSP); `public/robots.txt` blocks crawlers until the class reveal. |
| `analysis/` | Python (uv): `golden.py` generates reference vectors from scipy; pytest proves the committed fixture isn't stale. |
| `fixtures/risk/pert_golden.json` | Generated golden vectors; the TS PERT tests must match them. |

### Docs
| Path | Purpose |
|---|---|
| `docs/adr/` | Architecture Decision Records. `0000-template.md`, plus `0001` (R3F over Cesium, accepted). 0002–0005 are backlog tasks. `0006` (animation timelines, accepted). |
| `docs/animation/` | How the OV-1 animates: architecture (`README.md`), adding a scenario animation (`authoring.md`), and wiring new scene elements or the sim into playback (`extending.md`). |
| `docs/fair/` | Where every FAIR estimate's source lives (`_template.md` per scenario). No unsourced numbers. |
| `docs/design/ov1-refs/` | The OV-1 visual reference set agents build against. |
| `docs/threat-model/` | STRIDE tables and attack trees, generated from the catalog (backlog task). |
| `docs/report/` | Final report, presentation plan, speaker map. |

---

## Commands

| Command | Does |
|---|---|
| `pnpm dev` | Run the app |
| `pnpm verify` | **Gate:** Biome check, determinism guard, typecheck, TS tests, Python tests, build |
| `pnpm fix` | Auto-format + safe lint fixes |
| `pnpm test` · `pnpm test:py` · `pnpm test:e2e` | TS unit · Python · Playwright |
| `pnpm golden` | Regenerate golden vectors from Python |
| `pnpm guard:contract` | Run the contract guard locally against `origin/main` |
| `pnpm guard:dist` | After a build: fail on source maps or missing `_headers` / `robots.txt` in `apps/web/dist` |
| `pnpm tasks:seed [--dry-run]` | Seed the to-do list into GitHub Issues |

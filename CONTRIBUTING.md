# Contributing (humans)

Agents follow [`AGENTS.md`](AGENTS.md). This page is for the three of us: how work moves from the
to-do list to `main`.

## The loop
1. **Pick** an issue from the Project board's *Ready* column. Check its *Depends on* items are closed.
2. **Claim** it: assign yourself and add the `in-progress` label. If it's already claimed, pick another.
3. **Branch** from fresh `main`: `git switch -c <name>/<issue#>-slug`, or `agent/<issue#>-slug` if an agent writes it.
4. **Point your agent at the issue**, e.g. *"Do issue #14. Read AGENTS.md and SPEC.md first. Stay in scope."*
5. **Gate** locally: `pnpm verify` (plus `pnpm test:e2e` for UI work).
6. **PR** with the template filled in, including **which agent/model** wrote it. `Closes #N` links it.
7. **Review**: one teammate approves; contract/guardrail paths need the code owner. CI must be green.
8. **Squash-merge**, delete the branch, and move on. The issue closes itself.

## Rules of thumb
- **Small PRs.** One issue, one PR. If an agent's diff sprawls, close it and split the issue.
- **Reviewing agent PRs:** check scope first (did it touch files outside the list?), then tests, then
  logic. For anything visual, check the screenshot (below), and pull the branch and run it if in doubt.
- **Lockfile conflicts:** never hand-merge. `git checkout origin/main -- pnpm-lock.yaml && pnpm install`,
  then commit.
- **Contract changes** (`schema.ts`, `events.ts`, `rng.ts`): open a `contract`-labeled issue first,
  agree on it as a group, update `SPEC.md` in the same PR. Everyone rebases after it merges.
- **Need a new task?** Open an issue with the *Task* template. Precise **Files in scope** and
  **Acceptance criteria** are what make an agent succeed.
- **Stuck agent?** Don't let it widen scope. Comment the blocker on the issue and ask the group.

## Reviewing visual changes
There are no preview deploys. Every PR's CI run produces the evidence instead:
1. Open the PR's **Checks** tab → the **CI** workflow run → **Artifacts**.
2. Download **`ov1-slide-view`**: a PNG of the OV-1 slide view, taken by the Playwright smoke test
   against a production build served with the production CSP.
3. If something looks off, pull the branch and run `pnpm dev` (or `pnpm --filter @ov1/web build &&
   pnpm --filter @ov1/web preview` to see it exactly as it will ship). `playwright-report` has traces
   when e2e fails.

## Public site & deploys
- **URL:** <https://contested-ov1.pages.dev> (Cloudflare Pages project `contested-ov1`).
- **When it updates:** on every merge to `main`, via `.github/workflows/deploy.yml`. Nothing else
  deploys: no PR deploys, no branch deploys. Merging to `main` *is* publishing, so review accordingly.
- **Secrets:** `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` live only in the `production` GitHub
  Environment (restricted to `main`). Never add them as repository secrets; that would expose them to
  every workflow on every branch.
- **No source on the public site:** production builds have no source maps, and CI's `guard:dist` step
  fails if any `.map` file appears in `apps/web/dist`.
- **Headers:** `apps/web/public/_headers` sets a strict CSP (no `unsafe-eval`, no `unsafe-inline`) and
  the other security headers. `vite preview` serves the same file, so the e2e smoke test fails on any
  CSP violation. If a new feature needs a CSP change, change `_headers` in the PR and say why.
- **Search engines:** `X-Robots-Tag: noindex` and `robots.txt` keep the site unindexed until the class
  reveal. Remove both then.

## Labels
| Label | Meaning |
|---|---|
| `task` / `bug` | Kind of issue |
| `in-progress` | Claimed. Hands off. |
| `agent-ok` | An agent can do it end to end; a human reviews |
| `human-only` | Judgment, sourcing, writing, or presenting |
| `contract` | Touches a frozen contract file |
| `area:scene` `area:sim` `area:risk` `area:catalog` `area:docs` `area:infra` | Which part of the repo |

## Repo settings (owner sets these once; they aren't files)
- **Branch protection on `main`:** require a PR, 1 approval, review from Code Owners, status checks
  `verify`, `e2e`, `contract-guard`, `secrets-scan`; dismiss stale approvals; block force-push and deletion.
- **Merge button:** squash only; auto-delete head branches.
- **Secret scanning + push protection:** on (Settings → Code security).
- **`production` Environment** (Settings → Environments): deployment branches limited to `main`; holds
  the `CLOUDFLARE_API_TOKEN` (Pages: Edit only) and `CLOUDFLARE_ACCOUNT_ID` secrets. No Cloudflare
  repository secrets.
- **Collaborators:** Jared, Ella with *Write*.

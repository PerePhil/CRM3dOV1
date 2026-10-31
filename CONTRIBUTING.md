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
  logic. Pull the branch and run it for anything visual.
- **Lockfile conflicts:** never hand-merge. `git checkout origin/main -- pnpm-lock.yaml && pnpm install`,
  then commit.
- **Contract changes** (`schema.ts`, `events.ts`, `rng.ts`): open a `contract`-labeled issue first,
  agree on it as a group, update `SPEC.md` in the same PR. Everyone rebases after it merges.
- **Need a new task?** Open an issue with the *Task* template. Precise **Files in scope** and
  **Acceptance criteria** are what make an agent succeed.
- **Stuck agent?** Don't let it widen scope. Comment the blocker on the issue and ask the group.

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
- **Collaborators:** Jared, Ella with *Write*.

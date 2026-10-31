#!/usr/bin/env bash
# Install project dependencies in Claude Code cloud sessions.
# Runs automatically via the SessionStart hook in .claude/settings.json.
# Safe to run by hand too: `bash scripts/cloud-setup.sh`
# Local machines and Codespaces skip this (they use the devcontainer / README quickstart).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ] && [ "${1:-}" != "--force" ]; then
  exit 0
fi

# Find the repo root even if CLAUDE_PROJECT_DIR is unset or points at the checkout's parent.
ROOT="${CLAUDE_PROJECT_DIR:-}"
if [ ! -f "$ROOT/pnpm-workspace.yaml" ]; then
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi
cd "$ROOT"

# Use the pnpm version pinned in package.json#packageManager (not whatever is global).
corepack enable >/dev/null 2>&1 || true
PNPM="pnpm"
command -v pnpm >/dev/null 2>&1 || PNPM="corepack pnpm"

if [ -f pnpm-lock.yaml ]; then
  $PNPM install --frozen-lockfile
else
  echo "cloud-setup: no pnpm-lock.yaml yet; running a normal install (commit the lockfile it creates)"
  $PNPM install
fi

if command -v uv >/dev/null 2>&1; then
  if [ -f analysis/uv.lock ]; then
    uv sync --project analysis --locked
  else
    echo "cloud-setup: no analysis/uv.lock yet; running uv lock + sync (commit the lockfile it creates)"
    uv lock --project analysis && uv sync --project analysis
  fi
else
  echo "cloud-setup: uv not found; Python checks (pnpm test:py) will fail until it is installed" >&2
fi

echo "cloud-setup: done"

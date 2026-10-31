## What & why

Closes #

<!-- One or two sentences. Link the SPEC.md section if relevant. -->

## Authorship
- **Written by:** <!-- human name, or agent + model, e.g. "Claude Code (Opus 5.5) driven by Phillip" -->
- **Human reviewer:** <!-- leave for the owner to assign -->

## Checklist
- [ ] Linked issue, and I stayed inside its **Files in scope**
- [ ] `pnpm verify` passes locally
- [ ] Tests added or updated for any sim / risk / catalog logic
- [ ] No new dependencies, **or** each one is justified below
- [ ] No hardcoded node/link/threat/control IDs (imported from `@ov1/catalog`)
- [ ] If a contract file changed (`schema.ts`, `events.ts`, `rng.ts`), `SPEC.md` is updated in this PR
- [ ] New FAIR numbers have a source in `docs/fair/`
- [ ] Visual changes follow SPEC §8 (screenshot below)
- [ ] No secrets, CUI, or non-public data

## New dependencies (if any)
<!-- package — why it's needed — why not hand-roll -->

## Screenshots / preview
<!-- Cloudflare preview link is auto-commented once secrets are configured -->

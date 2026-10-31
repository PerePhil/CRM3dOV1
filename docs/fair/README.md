# FAIR parameter sources

**Rule (SPEC §6.4): every min / most-likely / max in the model has a source or a written rationale
here.** No unsourced numbers reach the catalog or the report.

- One file per scenario: `S1.md` … `S6.md`, copied from `_template.md`.
- When an estimate lands in `packages/catalog/data/*.json`, set its `source` field to the file and
  section, e.g. `"docs/fair/S1.md#tef"`.
- Use public sources only (SPEC §10): CRS, GAO, NIST, SEC filings, Boeing public material, and
  peer-reviewed or reputable industry reports (e.g. IBM/Ponemon cost-of-breach).
- Strategic or geopolitical impact goes on the **Mission Impact 1–5** scale (`mission-impact.md`),
  never as an invented dollar figure.

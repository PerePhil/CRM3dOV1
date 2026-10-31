# STIX 2.1 adversary bundle

`bundle.json` holds the project's adversary profiles as **STIX 2.1** objects (SPEC §5.5):
`threat-actor`, `intrusion-set`, `attack-pattern`, `course-of-action`, and the `relationship`
objects linking them.

- One `threat-actor` per catalog adversary (`ADV-1`…`ADV-3`). Put its STIX id in that adversary's `stixId` field in `../data/adversaries.json`.
- One `attack-pattern` per catalog threat (`T-*`), with `external_references` for the ATT&CK for ICS / EMB3D / SPARTA mappings, but **only once `verified: true`**.
- One `course-of-action` per catalog control (`C-*`), with `mitigates` relationships.
- Actors are **notional composites**. Don't attribute operations to named real-world groups beyond what's publicly reported, and cite that reporting in `external_references`.

Validate with the OASIS STIX validator (`stix2-validator`) from `analysis/` once the bundle has objects. That's a backlog task.

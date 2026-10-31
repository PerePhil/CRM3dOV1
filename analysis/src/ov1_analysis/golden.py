"""Generate golden vectors that the TypeScript risk engine must match (SPEC §3.4).

Run from the repo root:  pnpm golden
This is deliberately an INDEPENDENT implementation (scipy.stats.beta), not a port of the TS.
"""

from __future__ import annotations

import json

from scipy import stats

from ov1_analysis import FIXTURES

GAMMA = 4.0

# Cases span skew directions and magnitudes seen in FAIR inputs (frequencies, $ losses).
CASES: list[dict] = [
    {"name": "symmetric", "params": {"min": 0.0, "ml": 5.0, "max": 10.0}},
    {"name": "right-skew TEF", "params": {"min": 0.1, "ml": 0.5, "max": 4.0}},
    {"name": "left-skew vuln", "params": {"min": 0.2, "ml": 0.85, "max": 0.95}},
    {"name": "airframe-scale $", "params": {"min": 5e6, "ml": 6e7, "max": 2.5e8}},
]


def pert_moments(lo: float, ml: float, hi: float, gamma: float = GAMMA) -> tuple[float, float]:
    """Mean and variance of Beta-PERT via scipy's beta distribution, scaled to [lo, hi]."""
    a = 1 + gamma * (ml - lo) / (hi - lo)
    b = 1 + gamma * (hi - ml) / (hi - lo)
    dist = stats.beta(a, b, loc=lo, scale=hi - lo)
    return float(dist.mean()), float(dist.var())


def build() -> dict:
    cases = []
    for c in CASES:
        p = c["params"]
        mean, var = pert_moments(p["min"], p["ml"], p["max"])
        cases.append({**c, "mean": mean, "variance": var})
    return {
        "_generated_by": "ov1_analysis/golden.py (do not hand-edit; run `pnpm golden`)",
        "gamma": GAMMA,
        "cases": cases,
    }


def main() -> None:
    out = FIXTURES / "risk" / "pert_golden.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(build(), indent=2) + "\n")
    print(f"wrote {out.relative_to(FIXTURES.parent)}")


if __name__ == "__main__":
    main()

"""The committed fixture must equal what the generator produces, so it can't silently drift."""

import json

import pytest

from ov1_analysis import FIXTURES
from ov1_analysis.golden import GAMMA, build, pert_moments


def test_committed_fixture_matches_generator() -> None:
    committed = json.loads((FIXTURES / "risk" / "pert_golden.json").read_text())
    assert committed == build(), (
        "fixtures/risk/pert_golden.json is stale; run `pnpm golden` and commit the result"
    )


@pytest.mark.parametrize(
    ("lo", "ml", "hi"),
    [(0.0, 5.0, 10.0), (0.1, 0.5, 4.0), (5e6, 6e7, 2.5e8)],
)
def test_scipy_matches_closed_form(lo: float, ml: float, hi: float) -> None:
    mean, var = pert_moments(lo, ml, hi)
    closed_mean = (lo + GAMMA * ml + hi) / (GAMMA + 2)
    closed_var = (closed_mean - lo) * (hi - closed_mean) / (GAMMA + 3)
    assert mean == pytest.approx(closed_mean, rel=1e-12)
    assert var == pytest.approx(closed_var, rel=1e-12)

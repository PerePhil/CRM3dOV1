import { createRng } from "@ov1/core";
import { describe, expect, it } from "vitest";
import golden from "../../../fixtures/risk/pert_golden.json";
import { pertMean, pertVariance, samplePert } from "./distributions";
import { rosi } from "./index";
import { summarize } from "./summary";

// Golden vectors come from analysis/src/ov1_analysis/golden.py (scipy), an independent
// implementation. If these fail, the TS math drifted from the reference. Fix the TS.
describe("Beta-PERT vs Python golden vectors", () => {
  for (const c of golden.cases) {
    it(`analytic moments match scipy: ${c.name}`, () => {
      expect(pertMean(c.params, golden.gamma)).toBeCloseTo(c.mean, 6);
      expect(pertVariance(c.params, golden.gamma)).toBeCloseTo(c.variance, 4);
    });

    it(`sampled moments converge: ${c.name}`, () => {
      const rng = createRng(1234);
      const n = 200_000;
      const xs = Array.from({ length: n }, () => samplePert(rng, c.params, golden.gamma));
      const mean = xs.reduce((s, x) => s + x, 0) / n;
      const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1);
      expect(Math.abs(mean - c.mean) / c.mean).toBeLessThan(0.005);
      expect(Math.abs(variance - c.variance) / c.variance).toBeLessThan(0.02);
      // reduce, not Math.min(...xs): spreading 200k args overflows the call stack
      expect(xs.reduce((m, x) => Math.min(m, x), Infinity)).toBeGreaterThanOrEqual(c.params.min);
      expect(xs.reduce((m, x) => Math.max(m, x), -Infinity)).toBeLessThanOrEqual(c.params.max);
    });
  }
});

describe("samplePert", () => {
  it("is deterministic for a seed", () => {
    const p = { min: 1, ml: 2, max: 10 };
    const a = createRng(5);
    const b = createRng(5);
    expect(samplePert(a, p)).toBe(samplePert(b, p));
  });

  it("handles a degenerate range", () => {
    expect(samplePert(createRng(1), { min: 3, ml: 3, max: 3 })).toBe(3);
  });

  it("rejects ml outside [min, max]", () => {
    expect(() => samplePert(createRng(1), { min: 1, ml: 20, max: 10 })).toThrow();
  });
});

describe("summary + rosi", () => {
  it("summarize percentiles", () => {
    const s = summarize(Array.from({ length: 101 }, (_, i) => i));
    expect(s.p50).toBe(50);
    expect(s.p90).toBe(90);
  });

  it("rosi matches SPEC §6.5", () => {
    expect(rosi(10_000_000, 4_000_000, 4_000_000)).toBeCloseTo(0.5);
  });
});

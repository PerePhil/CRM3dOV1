import { describe, expect, it } from "vitest";
import { createRng } from "./rng";

const take = (seed: number, n: number) => {
  const r = createRng(seed);
  return Array.from({ length: n }, () => r.nextUint32());
};

describe("createRng", () => {
  it("is deterministic for a given seed", () => {
    expect(take(42, 100)).toEqual(take(42, 100));
  });

  it("produces different streams for different seeds", () => {
    expect(take(1, 10)).not.toEqual(take(2, 10));
  });

  it("matches the frozen known-answer vector (guards accidental algorithm changes)", () => {
    // If this fails, someone changed rng.ts. That is a contract change: see AGENTS.md §4.2.
    expect(take(42, 5)).toEqual([660444221, 3652823732, 77672526, 910233633, 2297337756]);
  });

  it("next() stays in [0, 1) with mean ≈ 0.5", () => {
    const r = createRng(7);
    let sum = 0;
    const n = 100_000;
    for (let i = 0; i < n; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      sum += x;
    }
    expect(sum / n).toBeCloseTo(0.5, 2);
  });

  it("int() is inclusive and in range", () => {
    const r = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(r.int(1, 6));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("fork() is order-independent of parent draws", () => {
    const a = createRng(99);
    const b = createRng(99);
    for (let i = 0; i < 50; i++) b.next();
    expect(a.fork(5).next()).toBe(b.fork(5).next());
    expect(a.fork(5).next()).not.toBe(a.fork(6).next());
  });
});

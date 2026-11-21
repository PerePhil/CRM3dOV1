import { describe, expect, it } from "vitest";
import { createDeltaSmoother } from "./react";

describe("createDeltaSmoother", () => {
  it("passes the first delta through and averages wobble", () => {
    const s = createDeltaSmoother(0.2);
    expect(s(1 / 60)).toBeCloseTo(1 / 60);
    const out = [0.012, 0.021, 0.013, 0.02].map(s);
    for (const v of out) expect(Math.abs(v - 1 / 60)).toBeLessThan(0.002);
  });

  it("converges to the true frame time, so playback speed stays exact", () => {
    const s = createDeltaSmoother(0.2);
    let v = 0;
    for (let i = 0; i < 200; i++) v = s(i % 2 ? 0.014 : 0.019);
    expect(v).toBeCloseTo(0.0165, 3);
  });

  it("resets on a hitch instead of smearing it over many frames", () => {
    const s = createDeltaSmoother(0.2);
    s(1 / 60);
    expect(s(0.1)).toBe(0.1);
    expect(s(1 / 60)).toBe(1 / 60);
  });
});

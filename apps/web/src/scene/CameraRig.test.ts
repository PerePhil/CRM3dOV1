import { describe, expect, it } from "vitest";
import { ORBIT_RATE_RAD_S, orbitStepRad } from "./CameraRig";

describe("orbitStepRad", () => {
  it("turns with forward playback, scaled by elapsed playback time", () => {
    expect(orbitStepRad(10, 10.1)).toBeCloseTo(ORBIT_RATE_RAD_S * 0.1);
    // At 1.5× a tick advances playback 1.5× as far, so the orbit turns 1.5× as far.
    expect(orbitStepRad(10, 10.15)).toBeCloseTo(ORBIT_RATE_RAD_S * 0.15);
  });

  it("freezes when paused or ended, and ignores seeks, loads, and loop wraps", () => {
    expect(orbitStepRad(10, 10)).toBe(0);
    expect(orbitStepRad(10, 40)).toBe(0);
    expect(orbitStepRad(40, 10)).toBe(0);
    expect(orbitStepRad(126, 0.02)).toBe(0);
    expect(orbitStepRad(Number.NaN, 5)).toBe(0);
  });
});

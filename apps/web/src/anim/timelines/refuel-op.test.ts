import { describe, expect, it } from "vitest";
import { compileTimeline } from "../compile";
import { evaluate } from "../evaluate";
import { nodeIdOfKind } from "../roles";
import type { Vec3 } from "../types";
import { distance } from "../vec";
import { REFUEL_OP_TIMES as T, refuelOpTimeline as tl } from "./refuel-op";

const TANKER = nodeIdOfKind("uav");
const RECEIVER = nodeIdOfKind("receiver");
const ct = compileTimeline(tl);
const pos = (id: string, t: number): Vec3 => {
  const p = evaluate(ct, t).actors.get(id)?.position;
  if (!p) throw new Error(`no pose for ${id} at ${t}`);
  return p;
};

describe("refuel-op timeline", () => {
  it("carries the 18-step procedure in order, each with parameters to watch", () => {
    const steps = tl.steps ?? [];
    expect(steps.map((s) => s.n)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(steps.every((s) => (s.watch?.length ?? 0) > 0)).toBe(true);
    expect(steps.find((s) => s.n === 16)?.watch).toContain("Carrier Recovery Interface");
  });

  it("the active step follows playback time", () => {
    expect(evaluate(ct, 0).stepIndex).toBe(0);
    const mid = evaluate(ct, (T.xfer + T.separation) / 2);
    expect(tl.steps?.[mid.stepIndex]?.title).toBe("Fuel Transfer");
    expect(evaluate(ct, tl.durationS).stepIndex).toBe(17);
  });

  it("the tanker launches from and recovers to the same deck spot", () => {
    const deck = pos(TANKER, 0);
    expect(pos(TANKER, T.launch - 0.1)).toEqual(deck);
    expect(distance(pos(TANKER, tl.durationS), deck)).toBeLessThan(1e-6);
    expect(pos(TANKER, T.areaEntry)[1]).toBeGreaterThan(deck[1] + 3);
  });

  it("the receiver is far away until it is identified", () => {
    for (let t = 0; t < T.rcvrId; t += 1) {
      expect(distance(pos(TANKER, t), pos(RECEIVER, t))).toBeGreaterThan(4);
    }
  });

  it("in contact, the receiver holds astern and below the tanker for the whole transfer", () => {
    const gaps: number[] = [];
    for (let t = T.xfer; t <= T.separation; t += 0.5) {
      const tk = pos(TANKER, t);
      const rc = pos(RECEIVER, t);
      gaps.push(distance(tk, rc));
      expect(rc[1]).toBeLessThan(tk[1]);
    }
    expect(Math.max(...gaps)).toBeLessThan(1.4);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(1e-6);
  });

  it("the receiver closes from pre-contact to contact during refueling prep", () => {
    const gap = (t: number) => distance(pos(TANKER, t), pos(RECEIVER, t));
    expect(gap(T.xferPrep)).toBeGreaterThan(gap(T.xfer) + 0.8);
  });
});

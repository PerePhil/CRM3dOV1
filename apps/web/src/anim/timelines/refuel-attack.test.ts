import { catalog } from "@ov1/catalog";
import { describe, expect, it } from "vitest";
import { SCENERY } from "../../scene/layout";
import { compileTimeline } from "../compile";
import { evaluate } from "../evaluate";
import { hostileNodeIds, nodeIdOfKind } from "../roles";
import type { MotionSegment, Timeline, Vec3 } from "../types";
import { distance } from "../vec";
import { clipCues, fitSegments } from "./refuel-attack";
import { REFUEL_OP, refuelOpTimeline } from "./refuel-op";
import { S2_TIMES, s2Spoofing } from "./s2-spoofing";
import { S3_TIMES, s3FalseTelemetry } from "./s3-false-telemetry";
import { S4_TIMES, s4Malware } from "./s4-malware";

const TANKER = nodeIdOfKind("uav");
const RECEIVER = nodeIdOfKind("receiver");
const nominal = compileTimeline(refuelOpTimeline);
const posIn = (tl: Timeline) => {
  const ct = compileTimeline(tl);
  return (id: string, t: number): Vec3 => {
    const p = evaluate(ct, t).actors.get(id)?.position;
    if (!p) throw new Error(`no pose for ${id} at ${t}`);
    return p;
  };
};
const nominalPos = posIn(refuelOpTimeline);
/** Parameter-table rows ("Effected Activities") mapped to a procedure step number. */
const watchedAt = (n: number | undefined) =>
  new Set(REFUEL_OP.steps.find((s) => s.n === n)?.watch ?? []);

const cases = [
  {
    tl: s3FalseTelemetry,
    attackAt: S3_TIMES.INJECT,
    after: 7,
    next: 8,
    reveal: nodeIdOfKind("adversary-cyber"),
  },
  {
    tl: s4Malware,
    attackAt: S4_TIMES.TRIGGER,
    after: 14,
    next: undefined,
    reveal: nodeIdOfKind("adversary-cyber"),
  },
  {
    tl: s2Spoofing,
    attackAt: S2_TIMES.SPOOF,
    after: 15,
    next: 16,
    reveal: nodeIdOfKind("adversary-spoofer"),
  },
] as const;

describe.each(cases)("$tl.id", ({ tl, attackAt, after, next, reveal }) => {
  const ct = compileTimeline(tl);
  const pos = posIn(tl);

  it("injects exactly one red attack step into the nominal procedure", () => {
    const steps = tl.steps ?? [];
    const attacks = steps.filter((s) => s.kind === "attack");
    expect(attacks).toHaveLength(1);
    const i = steps.findIndex((s) => s.kind === "attack");
    expect(steps[i]?.tS).toBe(attackAt);
    expect(steps[i]?.n).toBe(after);
    expect(steps[i - 1]?.n).toBe(after);
    expect(steps[i + 1]?.n).toBe(next);
    expect(steps.slice(0, i).map((s) => s.n)).toEqual(
      Array.from({ length: after }, (_, k) => k + 1),
    );
    expect(tl.label).toMatch(/\(storyboard\)/);
  });

  it("watches only parameters the mission table maps to the step it interrupts or leads into", () => {
    const attack = (tl.steps ?? []).find((s) => s.kind === "attack");
    const mapped = new Set([...watchedAt(after), ...watchedAt(next)]);
    expect(attack?.watch?.length ?? 0).toBeGreaterThan(0);
    for (const w of attack?.watch ?? []) expect(mapped.has(w), w).toBe(true);
  });

  it("flies the nominal mission until the attack", () => {
    for (let t = 0; t < attackAt; t += 0.5) {
      expect(distance(pos(TANKER, t), nominalPos(TANKER, t))).toBeLessThan(1e-6);
      expect(distance(pos(RECEIVER, t), nominalPos(RECEIVER, t))).toBeLessThan(1e-6);
      expect(evaluate(ct, t).stepIndex).toBe(evaluate(nominal, t).stepIndex);
    }
  });

  it("keeps every adversary hidden until its attack is used, then shows only that one", () => {
    for (let t = 0; t <= tl.durationS; t += 0.5) {
      const { hidden, activeThreats } = evaluate(ct, t);
      for (const id of hostileNodeIds()) {
        expect(hidden.has(id)).toBe(id === reveal ? t < attackAt : true);
      }
      expect(activeThreats.size > 0).toBe(t >= attackAt);
    }
  });

  it("activates exactly the scenario's threats", () => {
    const scenario = catalog.scenarios.find((s) => s.id === tl.scenarioId);
    expect([...evaluate(ct, tl.durationS).activeThreats]).toEqual(scenario?.threats);
  });
});

describe("S3 false telemetry: cold cat shot into the ocean", () => {
  const pos = posIn(s3FalseTelemetry);
  const deck = REFUEL_OP.geometry.DECK_SPOT;

  it("holds on deck through the injection, then never climbs after the launch", () => {
    expect(distance(pos(TANKER, S3_TIMES.LAUNCH - 0.01), deck)).toBeLessThan(1e-6);
    for (let t = S3_TIMES.LAUNCH; t <= S3_TIMES.END; t += 0.25) {
      expect(pos(TANKER, t)[1]).toBeLessThanOrEqual(deck[1] + 1e-6);
    }
  });

  it("ends in the water just off the bow", () => {
    const end = pos(TANKER, S3_TIMES.END);
    expect(end[1]).toBeLessThan(0);
    expect(end[0]).toBeGreaterThan(SCENERY.carrier.position[0] + SCENERY.carrier.size[0] / 2);
    expect(distance(end, deck)).toBeLessThan(6);
  });
});

describe("S4 malware: tanker flies into the receiver", () => {
  const pos = posIn(s4Malware);

  it("the tanker reaches the receiver at the collision time", () => {
    const gap = (t: number) => distance(pos(TANKER, t), pos(RECEIVER, t));
    expect(gap(S4_TIMES.TRIGGER)).toBeGreaterThan(0.8);
    expect(gap(S4_TIMES.COLLIDE)).toBeLessThan(1e-6);
  });

  it("both airframes end in the water", () => {
    expect(pos(TANKER, S4_TIMES.END)[1]).toBeLessThan(0);
    expect(pos(RECEIVER, S4_TIMES.END)[1]).toBeLessThan(0);
  });
});

describe("S2 spoofing: lands in hostile territory", () => {
  const pos = posIn(s2Spoofing);
  const { position: c, size } = SCENERY.hostileLand;

  it("ends stopped on the hostile land mass, not the carrier", () => {
    const end = pos(TANKER, S2_TIMES.END);
    expect(Math.abs(end[0] - c[0])).toBeLessThan(size[0] / 2);
    expect(Math.abs(end[2] - c[2])).toBeLessThan(size[2] / 2);
    expect(end[1]).toBeLessThan(0.5);
    expect(distance(pos(TANKER, S2_TIMES.STOPPED), end)).toBeLessThan(1e-6);
  });

  it("completes the fuel transfer before the attack", () => {
    const steps = s2Spoofing.steps ?? [];
    expect(steps.some((s) => s.title === "Transfer Completion and Separation")).toBe(true);
  });
});

describe("fitSegments / clipCues", () => {
  const segs: MotionSegment[] = [
    { kind: "hold", durationS: 4 },
    { kind: "flyTo", durationS: 3, to: [1, 0, 0] },
    { kind: "orbit", durationS: 10, center: [0, 0, 0], radius: 1, periodS: 10 },
  ];
  const total = (xs: MotionSegment[]) =>
    xs.reduce((a, s) => a + (s.kind === "samples" ? 0 : s.durationS), 0);

  it("shortens a hold or orbit at the cut, and keeps boundary cuts exact", () => {
    expect(total(fitSegments(segs, 2))).toBe(2);
    expect(fitSegments(segs, 7)).toHaveLength(2);
    expect(total(fitSegments(segs, 12))).toBe(12);
  });

  it("refuses to cut a curve, and stretches a trailing orbit", () => {
    expect(() => fitSegments(segs, 5)).toThrow(/cannot cut a flyTo/);
    expect(total(fitSegments(segs, 30))).toBe(30);
  });

  it("drops cues at or after the cut and ends the rest at it", () => {
    const clipped = clipCues(
      [
        { kind: "caption", tS: 1, text: "a" },
        { kind: "caption", tS: 2, durationS: 1, text: "b" },
        { kind: "caption", tS: 5, text: "c" },
      ],
      5,
    );
    expect(clipped.map((c) => [c.text, c.durationS])).toEqual([
      ["a", 4],
      ["b", 1],
    ]);
  });
});

import { catalog } from "@ov1/catalog";
import { describe, expect, it } from "vitest";
import { compileTimeline, compileTrack } from "./compile";
import { evaluate, localTime, poseAt, positionAt } from "./evaluate";
import { nodeIdOfKind } from "./roles";
import { homePosition, linkStateOf, livePosition } from "./space";
import type { Timeline, Vec3 } from "./types";
import { arcLengthSampler, distance, ease, headingOf, headingVector, wrapAngle } from "./vec";

const UAV = nodeIdOfKind("uav");
const GCS = nodeIdOfKind("gcs");
const close = (a: Vec3, b: Vec3, tol = 1e-6) => expect(distance(a, b)).toBeLessThan(tol);

describe("vec helpers", () => {
  it("heading convention: 0 = +x, +π/2 = -z (left, seen from above)", () => {
    close(headingVector(0), [1, 0, 0]);
    close(headingVector(Math.PI / 2), [0, 0, -1]);
    expect(headingOf([0, 0, -1])).toBeCloseTo(Math.PI / 2);
  });

  it("wrapAngle stays in (-π, π]", () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(0.5)).toBeCloseTo(0.5);
  });

  it("easings hit both endpoints", () => {
    for (const e of ["linear", "in", "out", "inOut"] as const) {
      expect(ease(e, 0)).toBe(0);
      expect(ease(e, 1)).toBe(1);
    }
  });

  it("arc-length sampling is constant speed on uneven points", () => {
    const at = arcLengthSampler([
      [0, 0, 0],
      [1, 0, 0],
      [10, 0, 0],
    ]);
    close(at(0.5), [5, 0, 0]);
  });
});

describe("motion primitives", () => {
  it("a track with no segments sits at its start", () => {
    const tr = compileTrack(UAV, { segments: [] });
    close(positionAt(tr, 5), homePosition(UAV));
  });

  it("hold keeps position; hold.at teleports", () => {
    const tr = compileTrack(UAV, { segments: [{ kind: "hold", durationS: 2, at: [1, 2, 3] }] });
    close(positionAt(tr, 1), [1, 2, 3]);
  });

  it("orbit stays on its circle and completes one lap per period", () => {
    const center: Vec3 = [0, 5, 0];
    const tr = compileTrack(UAV, {
      start: [3, 5, 0],
      segments: [{ kind: "orbit", durationS: 20, center, radius: 3, periodS: 20 }],
    });
    for (const t of [0, 3.3, 7, 12.5, 19.9])
      expect(distance(positionAt(tr, t), center)).toBeCloseTo(3);
    close(positionAt(tr, 20), [3, 5, 0], 1e-9);
    // Quarter lap ccw from +x goes to -z.
    close(positionAt(tr, 5), [0, 5, -3]);
  });

  it("orbit direction: cw goes the other way", () => {
    const tr = compileTrack(UAV, {
      start: [3, 5, 0],
      segments: [
        {
          kind: "orbit",
          durationS: 20,
          center: [0, 5, 0],
          radius: 3,
          periodS: 20,
          direction: "cw",
        },
      ],
    });
    close(positionAt(tr, 5), [0, 5, 3]);
  });

  it("orbit entry far from the actor is reported as a jump", () => {
    const issues: string[] = [];
    compileTrack(
      UAV,
      {
        start: [0, 5, 0],
        segments: [{ kind: "orbit", durationS: 5, center: [0, 5, 0], radius: 3, periodS: 10 }],
      },
      (m) => issues.push(m),
    );
    expect(issues.join()).toMatch(/flyTo first/);
  });

  it("flyTo starts where the actor is and ends exactly on target", () => {
    const tr = compileTrack(UAV, {
      start: [0, 0, 0],
      segments: [{ kind: "flyTo", durationS: 4, to: [10, 2, 0] }],
    });
    close(positionAt(tr, 0), [0, 0, 0]);
    close(positionAt(tr, 4), [10, 2, 0]);
    close(positionAt(tr, 99), [10, 2, 0]);
  });

  it("flyTo honors the arrival heading", () => {
    const tr = compileTrack(UAV, {
      start: [0, 0, 0],
      segments: [{ kind: "flyTo", durationS: 4, to: [10, 0, 0], arriveHeadingRad: Math.PI / 2 }],
    });
    expect(wrapAngle(poseAt(tr, 3.99).headingRad - Math.PI / 2)).toBeCloseTo(0, 1);
  });

  it("path passes through every waypoint and ends on the last", () => {
    const via: Vec3[] = [
      [5, 0, 0],
      [5, 0, -5],
    ];
    const tr = compileTrack(UAV, {
      start: [0, 0, 0],
      segments: [{ kind: "path", durationS: 10, through: via }],
    });
    close(positionAt(tr, 10), [5, 0, -5]);
    const near = Math.min(
      ...Array.from({ length: 101 }, (_, i) => distance(positionAt(tr, i / 10), [5, 0, 0])),
    );
    expect(near).toBeLessThan(0.1);
  });

  it("samples interpolate linearly in time", () => {
    const tr = compileTrack(UAV, {
      start: [0, 0, 0],
      segments: [
        {
          kind: "samples",
          samples: [
            { tS: 0, position: [0, 0, 0] },
            { tS: 2, position: [4, 0, 0] },
          ],
        },
      ],
    });
    close(positionAt(tr, 1), [2, 0, 0]);
    expect(tr.durationS).toBe(2);
  });

  it("segments chain: each starts where the previous ended", () => {
    const tr = compileTrack(UAV, {
      start: [0, 0, 0],
      segments: [
        { kind: "flyTo", durationS: 2, to: [4, 0, 0] },
        { kind: "hold", durationS: 1 },
        { kind: "flyTo", durationS: 2, to: { node: GCS } },
      ],
    });
    close(positionAt(tr, 2.5), [4, 0, 0]);
    close(positionAt(tr, 5), homePosition(GCS));
    expect(tr.durationS).toBe(5);
  });
});

describe("derived orientation", () => {
  const orbit = (direction: "ccw" | "cw") =>
    compileTrack(UAV, {
      start: [3, 5, 0],
      segments: [
        { kind: "orbit", durationS: 20, center: [0, 5, 0], radius: 3, periodS: 20, direction },
      ],
    });

  it("heading follows the velocity (tangent to an orbit)", () => {
    // At angle 0 on a ccw orbit the actor moves toward -z, i.e. heading +π/2.
    expect(poseAt(orbit("ccw"), 0.5).headingRad).toBeCloseTo(Math.PI / 2 + Math.PI / 20, 2);
  });

  it("banks into the turn: left turn = negative, right turn = positive", () => {
    expect(poseAt(orbit("ccw"), 5).bankRad).toBeLessThan(0);
    expect(poseAt(orbit("cw"), 5).bankRad).toBeGreaterThan(0);
  });

  it("level straight flight has no bank or pitch; climbing pitches up", () => {
    const level = compileTrack(UAV, {
      start: [0, 0, 0],
      segments: [{ kind: "flyTo", durationS: 4, to: [8, 0, 0] }],
    });
    const p = poseAt(level, 2);
    expect(Math.abs(p.bankRad)).toBeLessThan(1e-6);
    expect(Math.abs(p.pitchRad)).toBeLessThan(1e-6);
    const climb = compileTrack(UAV, {
      start: [0, 0, 0],
      segments: [
        {
          kind: "samples",
          samples: [
            { tS: 0, position: [0, 0, 0] },
            { tS: 4, position: [8, 2, 0] },
          ],
        },
      ],
    });
    expect(poseAt(climb, 2).pitchRad).toBeGreaterThan(0);
  });

  it("holding keeps the last heading instead of snapping to 0", () => {
    const tr = compileTrack(UAV, {
      start: [0, 0, 0],
      segments: [
        { kind: "flyTo", durationS: 2, to: [0, 0, -4] },
        { kind: "hold", durationS: 2 },
      ],
    });
    expect(poseAt(tr, 3).headingRad).toBeCloseTo(Math.PI / 2);
  });
});

describe("evaluate(): channels", () => {
  const link = catalog.links[0];
  const threat = catalog.threats[0];
  if (!link || !threat) throw new Error("catalog needs at least one link and threat");

  const tl: Timeline = {
    id: "test",
    label: "test",
    durationS: 10,
    loop: false,
    links: { [link.id]: [{ tS: 2, state: link.states.at(-1) ?? link.defaultState }] },
    threats: {
      [threat.id]: [
        { tS: 1, active: true },
        { tS: 6, active: false },
      ],
    },
    cues: [
      { kind: "caption", tS: 1, durationS: 2, text: "first" },
      { kind: "caption", tS: 2, text: "second" },
      { kind: "status", tS: 0, node: UAV, text: "A" },
      { kind: "status", tS: 5, node: UAV, text: "B" },
    ],
    steps: [
      { tS: 1, n: 1, title: "one" },
      { tS: 4, n: 2, title: "two" },
    ],
  };
  const ct = compileTimeline(tl);

  it("link state: catalog default before the first key, then the key", () => {
    expect(linkStateOf(evaluate(ct, 1), link)).toBe(link.defaultState);
    expect(linkStateOf(evaluate(ct, 2), link)).toBe(link.states.at(-1));
  });

  it("threat toggles on and off", () => {
    expect(evaluate(ct, 0.5).activeThreats.has(threat.id)).toBe(false);
    expect(evaluate(ct, 3).activeThreats.has(threat.id)).toBe(true);
    expect(evaluate(ct, 7).activeThreats.has(threat.id)).toBe(false);
  });

  it("captions respect durations; open-ended cues last to the end", () => {
    expect(evaluate(ct, 2.5).captions).toEqual(["first", "second"]);
    expect(evaluate(ct, 3).captions).toEqual(["second"]);
    expect(evaluate(ct, 10).captions).toEqual(["second"]);
  });

  it("latest status cue wins", () => {
    expect(evaluate(ct, 4).status.get(UAV)).toBe("A");
    expect(evaluate(ct, 5).status.get(UAV)).toBe("B");
  });

  it("step index: -1 before the first step, then the latest step started", () => {
    expect(evaluate(ct, 0.5).stepIndex).toBe(-1);
    expect(evaluate(ct, 1).stepIndex).toBe(0);
    expect(evaluate(ct, 3.9).stepIndex).toBe(0);
    expect(evaluate(ct, 10).stepIndex).toBe(1);
    expect(evaluate(compileTimeline({ ...tl, steps: undefined }), 5).stepIndex).toBe(-1);
  });

  it("visibility: shown before the first key, then the latest key wins", () => {
    const vis = compileTimeline({
      ...tl,
      visibility: {
        [GCS]: [
          { tS: 0, visible: false },
          { tS: 4, visible: true },
        ],
        [UAV]: [{ tS: 2, visible: false }],
      },
    });
    expect(evaluate(vis, 0).hidden.has(GCS)).toBe(true);
    expect(evaluate(vis, 1).hidden.has(UAV)).toBe(false);
    expect(evaluate(vis, 3).hidden).toEqual(new Set([GCS, UAV]));
    expect(evaluate(vis, 4).hidden).toEqual(new Set([UAV]));
    expect(evaluate(ct, 3).hidden.size).toBe(0);
  });

  it("untracked nodes are at home", () => {
    expect(livePosition(evaluate(ct, 3), GCS)).toEqual(homePosition(GCS));
  });

  it("is pure: same t → same frame, in any order", () => {
    const a = evaluate(ct, 4.2);
    evaluate(ct, 9);
    expect(evaluate(ct, 4.2)).toEqual(a);
  });
});

describe("localTime", () => {
  it("wraps when looping, clamps otherwise", () => {
    expect(localTime({ durationS: 10, loop: true }, 23)).toBeCloseTo(3);
    expect(localTime({ durationS: 10, loop: true }, -1)).toBeCloseTo(9);
    expect(localTime({ durationS: 10, loop: false }, 23)).toBe(10);
    expect(localTime({ durationS: 10, loop: false }, -1)).toBe(0);
  });
});

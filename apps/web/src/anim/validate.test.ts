import { catalog } from "@ov1/catalog";
import { describe, expect, it } from "vitest";
import { nodeIdOfKind } from "./roles";
import type { Timeline } from "./types";
import { validateTimeline } from "./validate";

const UAV = nodeIdOfKind("uav");
const base: Timeline = { id: "ok", label: "ok", durationS: 10, loop: false };
const firstLink = catalog.links[0];
if (!firstLink) throw new Error("catalog has no links");

const errorsFor = (patch: Partial<Timeline>) => validateTimeline({ ...base, ...patch }).join("\n");

describe("validateTimeline", () => {
  it("checks mission steps: in range, strictly increasing, non-empty", () => {
    const step = (tS: number, n: number, title = "x") => ({ tS, n, title });
    expect(validateTimeline({ ...base, steps: [step(0, 1), step(5, 2)] })).toEqual([]);
    expect(errorsFor({ steps: [step(11, 1)] })).toMatch(/tS outside timeline/);
    expect(errorsFor({ steps: [step(5, 1), step(5, 2)] })).toMatch(/strictly increasing/);
    expect(errorsFor({ steps: [step(0, 1, " ")] })).toMatch(/empty title/);
  });

  it("accepts a minimal timeline", () => {
    expect(validateTimeline(base)).toEqual([]);
  });

  it("rejects bad ids, empty labels, and non-positive durations", () => {
    expect(errorsFor({ id: "Not Kebab" })).toMatch(/kebab-case/);
    expect(errorsFor({ label: " " })).toMatch(/label/);
    expect(errorsFor({ durationS: 0 })).toMatch(/durationS/);
  });

  it("rejects IDs that aren't in the catalog", () => {
    expect(errorsFor({ scenarioId: "S99" })).toMatch(/unknown scenarioId/);
    expect(errorsFor({ actors: { "N-NOPE": { segments: [] } } })).toMatch(/not a catalog node/);
    expect(errorsFor({ links: { "L-NOPE": [] } })).toMatch(/unknown link/);
    expect(errorsFor({ threats: { "T-NOPE": [] } })).toMatch(/unknown threat/);
    expect(errorsFor({ cues: [{ kind: "status", tS: 0, node: "N-NOPE", text: "x" }] })).toMatch(
      /unknown node/,
    );
    expect(
      errorsFor({
        actors: { [UAV]: { segments: [{ kind: "flyTo", durationS: 1, to: { node: "N-NOPE" } }] } },
      }),
    ).toMatch(/unknown node/);
  });

  it("rejects link states the link can't take", () => {
    const impossible = catalog.links.find((l) => !l.states.includes("compromised"));
    if (!impossible) throw new Error("expected a link without a compromised state");
    expect(errorsFor({ links: { [impossible.id]: [{ tS: 1, state: "compromised" }] } })).toMatch(
      /cannot be "compromised"/,
    );
  });

  it("rejects unsorted or out-of-range keys", () => {
    const s = firstLink.defaultState;
    expect(
      errorsFor({
        links: {
          [firstLink.id]: [
            { tS: 5, state: s },
            { tS: 2, state: s },
          ],
        },
      }),
    ).toMatch(/sorted/);
    expect(errorsFor({ links: { [firstLink.id]: [{ tS: 11, state: s }] } })).toMatch(/outside/);
  });

  it("rejects tracks longer than the timeline", () => {
    expect(
      errorsFor({ actors: { [UAV]: { segments: [{ kind: "hold", durationS: 11 }] } } }),
    ).toMatch(/past the 10s timeline/);
  });

  it("rejects loops that visibly jump", () => {
    expect(
      errorsFor({
        loop: true,
        actors: {
          [UAV]: { start: [0, 0, 0], segments: [{ kind: "flyTo", durationS: 10, to: [5, 0, 0] }] },
        },
      }),
    ).toMatch(/loop jumps/);
  });

  it("reports orbit entry jumps", () => {
    expect(
      errorsFor({
        actors: {
          [UAV]: {
            start: [0, 5, 0],
            segments: [{ kind: "orbit", durationS: 5, center: [0, 5, 0], radius: 3, periodS: 10 }],
          },
        },
      }),
    ).toMatch(/flyTo first/);
  });

  it("rejects non-increasing samples", () => {
    expect(
      errorsFor({
        actors: {
          [UAV]: {
            segments: [
              {
                kind: "samples",
                samples: [
                  { tS: 1, position: [0, 0, 0] },
                  { tS: 1, position: [1, 0, 0] },
                ],
              },
            ],
          },
        },
      }),
    ).toMatch(/strictly increase/);
  });
});

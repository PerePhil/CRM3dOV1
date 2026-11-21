import { catalog } from "@ov1/catalog";
import { describe, expect, it } from "vitest";
import { timelineFocus } from "./focus";
import { scenarioTargets } from "./roles";
import { IDLE_TIMELINE, MISSION_TIMELINES, SCENARIO_TIMELINES } from "./timelines/registry";

describe("timelineFocus", () => {
  it("is null (everything in focus) for timelines without a scenario", () => {
    expect(timelineFocus(IDLE_TIMELINE)).toBeNull();
    for (const tl of MISSION_TIMELINES) expect(timelineFocus(tl)).toBeNull();
  });

  for (const [scenarioId, tls] of Object.entries(SCENARIO_TIMELINES)) {
    for (const tl of tls) {
      it(`${tl.id}: covers the scenario's targets and is a strict subset of the catalog`, () => {
        const f = timelineFocus(tl);
        expect(f).not.toBeNull();
        if (!f) return;
        const t = scenarioTargets(scenarioId);
        for (const id of t.links) expect(f.links.has(id)).toBe(true);
        for (const id of t.nodes) expect(f.nodes.has(id)).toBe(true);
        for (const id of Object.keys(tl.actors ?? {})) expect(f.nodes.has(id)).toBe(true);
        expect(f.links.size + f.nodes.size).toBeLessThan(
          catalog.links.length + catalog.nodes.length,
        );
      });

      it(`${tl.id}: every focused link's endpoints are focused`, () => {
        const f = timelineFocus(tl);
        if (!f) return;
        for (const l of catalog.links) {
          if (!f.links.has(l.id)) continue;
          for (const id of [l.from, ...l.via, l.to]) expect(f.nodes.has(id)).toBe(true);
        }
      });
    }
  }
});

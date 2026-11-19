import { catalog } from "@ov1/catalog";
import { describe, expect, it } from "vitest";
import { compileTimeline } from "../compile";
import { evaluate } from "../evaluate";
import { validateTimeline } from "../validate";
import { availableTimelines, IDLE_TIMELINE, SCENARIO_TIMELINES } from "./registry";

describe("timeline registry", () => {
  const all = availableTimelines(true);

  it.each(all.map((t) => [t.id, t] as const))("%s validates against the catalog", (_, tl) => {
    expect(validateTimeline(tl)).toEqual([]);
  });

  it.each(all.map((t) => [t.id, t] as const))("%s evaluates finite poses everywhere", (_, tl) => {
    const ct = compileTimeline(tl);
    for (let t = 0; t <= tl.durationS; t += 0.25) {
      for (const pose of evaluate(ct, t).actors.values()) {
        expect(
          [...pose.position, pose.headingRad, pose.pitchRad, pose.bankRad].every(Number.isFinite),
        ).toBe(true);
      }
    }
  });

  it("timeline ids are unique", () => {
    const ids = all.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("scenario timelines are keyed by their own catalog scenario ID", () => {
    const scenarioIds = new Set(catalog.scenarios.map((s) => s.id));
    for (const [key, tls] of Object.entries(SCENARIO_TIMELINES)) {
      expect(scenarioIds.has(key)).toBe(true);
      expect(tls.length).toBeGreaterThan(0);
      for (const tl of tls) expect(tl.scenarioId).toBe(key);
    }
  });

  it("a scenario with several animations names each variant distinctly", () => {
    for (const tls of Object.values(SCENARIO_TIMELINES)) {
      if (tls.length < 2) continue;
      const names = tls.map((t) => t.variant ?? "");
      expect(names.every((n) => n.trim().length > 0)).toBe(true);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("idle loops forever and moves the UAV", () => {
    expect(IDLE_TIMELINE.loop).toBe(true);
    const ct = compileTimeline(IDLE_TIMELINE);
    const uav = catalog.nodes.find((n) => n.kind === "uav")?.id ?? "";
    const a = evaluate(ct, 0).actors.get(uav)?.position;
    const b = evaluate(ct, 5).actors.get(uav)?.position;
    expect(a).toBeDefined();
    expect(b).not.toEqual(a);
  });
});

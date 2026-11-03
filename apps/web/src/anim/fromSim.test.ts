import { catalog } from "@ov1/catalog";
import { createEventLog } from "@ov1/sim";
import { describe, expect, it } from "vitest";
import { compileTimeline } from "./compile";
import { evaluate } from "./evaluate";
import { timelineFromSim } from "./fromSim";
import { nodeIdOfKind } from "./roles";
import { validateTimeline } from "./validate";

const UAV = nodeIdOfKind("uav");
const scenario = catalog.scenarios[0];
const threatId = scenario?.threats[0];
const link = catalog.links.find((l) => l.states.includes("denied"));
if (!scenario || !threatId || !link) throw new Error("catalog fixture assumptions broken");

/** A tiny fake run built with the real (frozen) event log. */
function fakeRun() {
  const log = createEventLog(20);
  log.emit(0, "run.start", "sim", {
    scenarioId: scenario?.id ?? "",
    seed: 1,
    tickHz: 20,
    lostLink: "rtb",
    controls: [],
  });
  log.emit(20, "threat.start", "sim", { threatId: threatId ?? "" });
  log.emit(40, "link.state", link?.id ?? "", {
    linkId: link?.id ?? "",
    from: "nominal",
    to: "denied",
    jsDb: 12,
  });
  log.emit(40, "uav.mode", UAV, { from: "mission", to: "lost-link", reason: "C2 denied" });
  log.emit(80, "uav.mode", UAV, { from: "lost-link", to: "rtb", reason: "timer" });
  log.emit(100, "detection", "sim", { threatId: threatId ?? "", by: "operator", latencyS: 3 });
  log.emit(200, "run.end", "sim", { outcome: "mission-aborted", lossEvent: true });
  return log.events;
}

describe("timelineFromSim", () => {
  const tl = timelineFromSim({
    id: "sim-run",
    label: "sim run",
    scenarioId: scenario.id,
    events: fakeRun(),
    tracks: {
      [UAV]: [
        { tS: 0, position: [0, 5, 0] },
        { tS: 10, position: [10, 5, 0] },
      ],
    },
  });
  const ct = compileTimeline(tl);

  it("produces a valid timeline ending at run.end", () => {
    expect(validateTimeline(tl)).toEqual([]);
    expect(tl.durationS).toBe(10);
    expect(tl.loop).toBe(false);
  });

  it("maps link.state and threat events onto channels", () => {
    expect(evaluate(ct, 1.9).links.get(link.id)).toBeUndefined();
    expect(evaluate(ct, 2).links.get(link.id)).toBe("denied");
    expect(evaluate(ct, 0.5).activeThreats.has(threatId)).toBe(false);
    expect(evaluate(ct, 1).activeThreats.has(threatId)).toBe(true);
  });

  it("maps uav.mode to the node's status line, each lasting until the next", () => {
    expect(evaluate(ct, 3).status.get(UAV)).toBe("MODE: LOST-LINK");
    expect(evaluate(ct, 4.5).status.get(UAV)).toBe("MODE: RTB");
  });

  it("captions detections and link losses", () => {
    expect(evaluate(ct, 5.5).captions.some((c) => c.startsWith("DETECTED"))).toBe(true);
    expect(evaluate(ct, 2.5).captions.some((c) => c.includes("DENIED"))).toBe(true);
  });

  it("plays position samples back", () => {
    expect(evaluate(ct, 5).actors.get(UAV)?.position[0]).toBeCloseTo(5);
  });
});

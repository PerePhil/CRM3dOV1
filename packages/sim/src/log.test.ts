import { describe, expect, it } from "vitest";
import { createEventLog } from "./log";

describe("event log", () => {
  it("assigns monotonic seq and derives t from tick (never wall clock)", () => {
    const log = createEventLog(20);
    log.emit(0, "threat.start", "T-JAM-C2", { threatId: "T-JAM-C2" });
    log.emit(40, "link.state", "L-LOS", {
      linkId: "L-LOS",
      from: "nominal",
      to: "denied",
      jsDb: 12,
    });
    expect(log.events.map((e) => e.seq)).toEqual([0, 1]);
    expect(log.events[1]?.t).toBe(2);
  });

  it("rejects ticks that go backwards", () => {
    const log = createEventLog(20);
    log.emit(10, "note", "sim", { text: "a" });
    expect(() => log.emit(5, "note", "sim", { text: "b" })).toThrow(/non-decreasing/);
  });

  it("events are immutable", () => {
    const log = createEventLog(20);
    log.emit(0, "note", "sim", { text: "a" });
    expect(Object.isFrozen(log.events[0])).toBe(true);
  });

  it("filters by type with narrowed payloads", () => {
    const log = createEventLog(20);
    log.emit(0, "note", "sim", { text: "a" });
    log.emit(1, "uav.mode", "N-UAV", { from: "mission", to: "lost-link", reason: "C2 denied" });
    const modes = log.ofType("uav.mode");
    expect(modes).toHaveLength(1);
    expect(modes[0]?.payload.to).toBe("lost-link");
  });
});

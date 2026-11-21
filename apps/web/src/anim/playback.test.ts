import { describe, expect, it, vi } from "vitest";
import { createPlayback, MAX_TICK_S, RATES } from "./playback";
import { nodeIdOfKind } from "./roles";
import type { Timeline } from "./types";

const UAV = nodeIdOfKind("uav");

const once: Timeline = {
  id: "once",
  label: "once",
  durationS: 2,
  loop: false,
  actors: {
    [UAV]: { start: [0, 0, 0], segments: [{ kind: "flyTo", durationS: 2, to: [4, 0, 0] }] },
  },
  cues: [{ kind: "caption", tS: 1, text: "half" }],
};
const looping: Timeline = { ...once, id: "loop", label: "loop", loop: true, actors: {} };

/** Tick in small steps like a 60 fps frame loop. */
const run = (p: ReturnType<typeof createPlayback>, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) p.tick(1 / 60);
};

describe("playback controller", () => {
  it("advances with wall-clock deltas while playing", () => {
    const p = createPlayback(once);
    run(p, 1);
    expect(p.frame.tS).toBeCloseTo(1, 5);
    expect(p.frame.actors.get(UAV)?.position[0]).toBeGreaterThan(0);
  });

  it("does nothing while paused", () => {
    const p = createPlayback(once, { autoplay: false });
    run(p, 1);
    expect(p.frame.tS).toBe(0);
  });

  it("rate scales time", () => {
    const p = createPlayback({ ...once, durationS: 100 });
    p.setRate(2);
    run(p, 1);
    expect(p.frame.tS).toBeCloseTo(2, 5);
    expect(() => p.setRate(0)).toThrow();
  });

  it("clamps big deltas (background tab) to MAX_TICK_S", () => {
    const p = createPlayback({ ...once, durationS: 100 });
    p.tick(30);
    expect(p.frame.tS).toBeCloseTo(MAX_TICK_S);
  });

  it("non-looping timelines stop at the end; play() replays", () => {
    const p = createPlayback(once);
    run(p, 5);
    expect(p.frame.tS).toBe(2);
    expect(p.getSnapshot().playing).toBe(false);
    expect(p.getSnapshot().ended).toBe(true);
    p.play();
    expect(p.frame.tS).toBe(0);
  });

  it("looping timelines wrap", () => {
    const p = createPlayback(looping);
    run(p, 2.5);
    expect(p.frame.tS).toBeCloseTo(0.5, 5);
    expect(p.getSnapshot().playing).toBe(true);
  });

  it("seek evaluates immediately, even when paused", () => {
    const p = createPlayback(once, { autoplay: false });
    p.seek(1.5);
    expect(p.frame.tS).toBe(1.5);
    expect(p.getSnapshot().discrete.captions).toEqual(["half"]);
  });

  it("load resets time and swaps the timeline", () => {
    const p = createPlayback(once);
    run(p, 1);
    p.load(looping, { autoplay: false });
    expect(p.getSnapshot().timelineId).toBe("loop");
    expect(p.frame.tS).toBe(0);
    expect(p.getSnapshot().playing).toBe(false);
  });

  it("notifies React at ~10 Hz for time, not every frame", () => {
    const p = createPlayback({ ...once, durationS: 100, cues: [] });
    const listener = vi.fn();
    p.subscribe(listener);
    run(p, 1);
    expect(listener.mock.calls.length).toBeGreaterThanOrEqual(9);
    expect(listener.mock.calls.length).toBeLessThanOrEqual(11);
  });

  it("keeps the discrete object stable until a discrete channel changes", () => {
    const p = createPlayback(once);
    const before = p.getSnapshot().discrete;
    run(p, 0.5);
    expect(p.getSnapshot().discrete).toBe(before);
    run(p, 0.6);
    expect(p.getSnapshot().discrete).not.toBe(before);
    expect(p.getSnapshot().discrete.captions).toEqual(["half"]);
  });

  it("publishes a new discrete state when the active step changes", () => {
    const p = createPlayback({ ...once, cues: [], steps: [{ tS: 1, n: 1, title: "go" }] });
    const before = p.getSnapshot().discrete;
    expect(before.stepIndex).toBe(-1);
    p.seek(1.5);
    expect(p.getSnapshot().discrete).not.toBe(before);
    expect(p.getSnapshot().discrete.stepIndex).toBe(0);
  });

  it("unsubscribe stops notifications", () => {
    const p = createPlayback(once);
    const listener = vi.fn();
    const off = p.subscribe(listener);
    off();
    p.pause();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("RATES", () => {
  it("offers 1.5× between 1× and 2×, ascending", () => {
    expect(RATES).toContain(1.5);
    expect([...RATES]).toEqual([...RATES].sort((a, b) => a - b));
  });

  it("advances 1.5 s of timeline per wall-clock second at 1.5×", () => {
    const pb = createPlayback({ id: "t", label: "t", durationS: 10, loop: false });
    pb.setRate(1.5);
    for (let i = 0; i < 10; i++) pb.tick(0.1);
    expect(pb.frame.tS).toBeCloseTo(1.5);
  });
});

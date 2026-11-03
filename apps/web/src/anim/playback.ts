/**
 * Playback controller: owns the loaded timeline and the playback clock (play / pause / seek /
 * rate / loop). Framework-free, so it works from React, from the R3F frame loop, from a future
 * zustand app store, and in Node tests.
 *
 * Two read paths, on purpose:
 *   - `frame`: full-precision Frame, refreshed every tick. Read it inside useFrame for anything
 *     that moves. Never put it in React state.
 *   - `getSnapshot()/subscribe()`: a React-friendly snapshot that only changes on control
 *     changes, discrete channel changes (link states, threats, text), or ~10 Hz time updates.
 *     Use it for panels and DOM overlays.
 *
 * The clock is driven by wall-clock deltas (AnimationDriver.tsx). That's fine here: playback
 * time is presentation state, not sim state. Determinism lives in evaluate(), which is a pure
 * function of playback time.
 */
import type { LinkState } from "@ov1/catalog";
import { type CompiledTimeline, compileTimeline } from "./compile";
import { evaluate, localTime } from "./evaluate";
import type { Frame, Timeline } from "./types";

/** Longest wall-clock step a single tick may advance (avoids leaps after a background tab). */
export const MAX_TICK_S = 0.1;
/** Snapshot time resolution: how often time-only changes reach React. */
export const SNAPSHOT_RESOLUTION_S = 0.1;
export const RATES = [0.25, 0.5, 1, 2, 4] as const;

export interface DiscreteState {
  links: ReadonlyMap<string, LinkState>;
  activeThreats: ReadonlySet<string>;
  captions: readonly string[];
  status: ReadonlyMap<string, string>;
}

export interface PlaybackSnapshot {
  timelineId: string;
  label: string;
  scenarioId: string | undefined;
  durationS: number;
  loop: boolean;
  playing: boolean;
  rate: number;
  /** Timeline-local time, quantized to SNAPSHOT_RESOLUTION_S. */
  tS: number;
  /** A non-looping timeline reached its end. */
  ended: boolean;
  /** Same object until a discrete channel changes, so selectors can return it directly. */
  discrete: DiscreteState;
}

export interface Playback {
  /** Latest full-precision frame. Read in useFrame; don't copy into React state. */
  readonly frame: Frame;
  readonly timeline: Timeline;
  getSnapshot(): PlaybackSnapshot;
  subscribe(listener: () => void): () => void;
  load(tl: Timeline, opts?: { autoplay?: boolean }): void;
  play(): void;
  pause(): void;
  toggle(): void;
  /** Jump to timeline-local time (clamped, or wrapped when looping). */
  seek(tS: number): void;
  restart(): void;
  setRate(rate: number): void;
  /** Advance by a wall-clock delta. Called once per rendered frame by AnimationDriver. */
  tick(dtS: number): void;
}

function discreteKey(f: Frame): string {
  const links = [...f.links].map(([k, v]) => `${k}=${v}`).join(",");
  const threats = [...f.activeThreats].join(",");
  const status = [...f.status].map(([k, v]) => `${k}=${v}`).join("\u0001");
  return `${links}|${threats}|${f.captions.join("\u0001")}|${status}`;
}

export function createPlayback(initial: Timeline, opts: { autoplay?: boolean } = {}): Playback {
  let tl = initial;
  let ct: CompiledTimeline = compileTimeline(initial);
  let t = 0;
  let playing = opts.autoplay ?? true;
  let rate = 1;
  let frame: Frame = evaluate(ct, 0);
  let discrete: DiscreteState = frame;
  let discreteSig = discreteKey(frame);
  let snapshot: PlaybackSnapshot = build();
  const listeners = new Set<() => void>();

  function ended(): boolean {
    return !ct.loop && t >= ct.durationS;
  }

  function build(): PlaybackSnapshot {
    const q = Math.floor(frame.tS / SNAPSHOT_RESOLUTION_S + 1e-9) * SNAPSHOT_RESOLUTION_S;
    return {
      timelineId: tl.id,
      label: tl.label,
      scenarioId: tl.scenarioId,
      durationS: ct.durationS,
      loop: ct.loop,
      playing,
      rate,
      tS: Math.round(q * 1000) / 1000,
      ended: ended(),
      discrete,
    };
  }

  /** Re-evaluate at the current time and publish a new snapshot if anything visible changed. */
  function refresh(force: boolean): void {
    frame = evaluate(ct, t);
    const sig = discreteKey(frame);
    if (sig !== discreteSig) {
      discreteSig = sig;
      discrete = {
        links: frame.links,
        activeThreats: frame.activeThreats,
        captions: frame.captions,
        status: frame.status,
      };
    }
    const next = build();
    const changed =
      force ||
      next.tS !== snapshot.tS ||
      next.discrete !== snapshot.discrete ||
      next.playing !== snapshot.playing ||
      next.ended !== snapshot.ended;
    if (!changed) return;
    snapshot = next;
    for (const l of listeners) l();
  }

  return {
    get frame() {
      return frame;
    },
    get timeline() {
      return tl;
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    load(next, o = {}) {
      tl = next;
      ct = compileTimeline(next);
      t = 0;
      playing = o.autoplay ?? true;
      refresh(true);
    },
    play() {
      if (ended()) t = 0;
      playing = true;
      refresh(true);
    },
    pause() {
      playing = false;
      refresh(true);
    },
    toggle() {
      if (playing) this.pause();
      else this.play();
    },
    seek(tS) {
      t = localTime(ct, tS);
      refresh(true);
    },
    restart() {
      t = 0;
      playing = true;
      refresh(true);
    },
    setRate(r) {
      if (!(r > 0) || !Number.isFinite(r)) throw new Error(`playback: rate must be > 0, got ${r}`);
      rate = r;
      refresh(true);
    },
    tick(dtS) {
      if (!playing) return;
      const dt = Math.min(Math.max(dtS, 0), MAX_TICK_S) * rate;
      t += dt;
      if (ct.loop) {
        t = localTime(ct, t);
      } else if (t >= ct.durationS) {
        t = ct.durationS;
        playing = false;
      }
      refresh(false);
    },
  };
}

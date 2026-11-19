/**
 * Timeline compiler: resolves places, chains motion segments end-to-start, and precomputes
 * curves so evaluate() is cheap enough to run every frame. Pure and deterministic.
 */
import { resolvePlace } from "./space";
import type {
  ActorTrack,
  Cue,
  LinkKey,
  MissionStep,
  MotionSegment,
  ThreatKey,
  Timeline,
  Vec3,
  VisibilityKey,
} from "./types";
import {
  add,
  arcLengthSampler,
  bezier,
  catmullRom,
  distance,
  ease,
  headingOf,
  headingVector,
  lerp3,
  scale,
  sub,
} from "./vec";

/** Points per curve span when densifying flyTo / path curves for arc-length lookup. */
const CURVE_SAMPLES = 48;
const SPAN_SAMPLES = 16;
/** An orbit or path that starts further than this from the actor's position visibly jumps. */
export const JUMP_TOLERANCE = 0.25;

export interface CompiledSegment {
  kind: MotionSegment["kind"];
  /** Track-local start/end time. */
  t0: number;
  t1: number;
  /** Position at segment-local time (0 … t1 − t0). */
  at(localS: number): Vec3;
  /** Heading to use while the actor isn't moving. */
  restHeadingRad: number;
}

export interface CompiledTrack {
  nodeId: string;
  start: Vec3;
  startHeadingRad: number;
  segments: CompiledSegment[];
  durationS: number;
}

export interface CompiledTimeline {
  source: Timeline;
  durationS: number;
  loop: boolean;
  tracks: CompiledTrack[];
  links: [string, readonly LinkKey[]][];
  threats: [string, readonly ThreatKey[]][];
  visibility: [string, readonly VisibilityKey[]][];
  /** Sorted by tS (stable). */
  cues: Cue[];
  /** As authored (validate.ts checks the order). */
  steps: readonly MissionStep[];
  /** Continuity problems found while chaining segments (validate.ts reports these). */
  issues: string[];
}

interface ChainState {
  position: Vec3;
  headingRad: number;
}

function horizontal(v: Vec3): Vec3 {
  return [v[0], 0, v[2]];
}

function headingBetween(a: Vec3, b: Vec3, fallback: number): number {
  const d = horizontal(sub(b, a));
  return Math.hypot(d[0], d[2]) > 1e-6 ? headingOf(d) : fallback;
}

function compileSegment(
  seg: MotionSegment,
  t0: number,
  from: ChainState,
  issue: (msg: string) => void,
): { compiled: CompiledSegment; end: ChainState } {
  switch (seg.kind) {
    case "hold": {
      const p = seg.at ? resolvePlace(seg.at) : from.position;
      const h = seg.headingRad ?? from.headingRad;
      return {
        compiled: { kind: seg.kind, t0, t1: t0 + seg.durationS, at: () => p, restHeadingRad: h },
        end: { position: p, headingRad: h },
      };
    }

    case "flyTo": {
      const p0 = from.position;
      const p1 = resolvePlace(seg.to);
      const d = distance(p0, p1);
      const arrive = seg.arriveHeadingRad ?? headingBetween(p0, p1, from.headingRad);
      if (d < 1e-6) {
        return {
          compiled: {
            kind: seg.kind,
            t0,
            t1: t0 + seg.durationS,
            at: () => p1,
            restHeadingRad: arrive,
          },
          end: { position: p1, headingRad: arrive },
        };
      }
      // Tangents along the current and arrival headings: the actor curves out of its present
      // direction instead of snapping to face the target.
      const c0 = add(p0, scale(headingVector(from.headingRad), d / 3));
      const c1 = sub(p1, scale(headingVector(arrive), d / 3));
      const pts: Vec3[] = [];
      for (let i = 0; i <= CURVE_SAMPLES; i++) pts.push(bezier(p0, c0, c1, p1, i / CURVE_SAMPLES));
      const along = arcLengthSampler(pts);
      return {
        compiled: {
          kind: seg.kind,
          t0,
          t1: t0 + seg.durationS,
          at: (s) => along(ease(seg.ease, s / seg.durationS)),
          restHeadingRad: arrive,
        },
        end: { position: p1, headingRad: arrive },
      };
    }

    case "orbit": {
      const c = resolvePlace(seg.center);
      const rel = horizontal(sub(from.position, c));
      const a0 = seg.startAngleRad ?? (Math.hypot(rel[0], rel[2]) > 1e-6 ? headingOf(rel) : 0);
      const sign = (seg.direction ?? "ccw") === "ccw" ? 1 : -1;
      const omega = (sign * 2 * Math.PI) / seg.periodS;
      const at = (s: number): Vec3 => {
        const a = a0 + omega * s;
        return [c[0] + seg.radius * Math.cos(a), c[1], c[2] - seg.radius * Math.sin(a)];
      };
      const entry = at(0);
      const gap = distance(entry, from.position);
      if (gap > JUMP_TOLERANCE) {
        issue(`orbit at t=${t0}s starts ${gap.toFixed(2)}u from the actor; add a flyTo first`);
      }
      const tangent = (s: number) => a0 + omega * s + (sign * Math.PI) / 2;
      return {
        compiled: { kind: seg.kind, t0, t1: t0 + seg.durationS, at, restHeadingRad: tangent(0) },
        end: { position: at(seg.durationS), headingRad: tangent(seg.durationS) },
      };
    }

    case "path": {
      const ctrl: Vec3[] = [from.position, ...seg.through.map(resolvePlace)];
      const pts: Vec3[] = [];
      // Phantom point behind the start, along the current heading, so the spline leaves in
      // roughly the direction the actor is already flying instead of kinking.
      const lead = ctrl[1] ? distance(from.position, ctrl[1]) : 0;
      const behind = sub(from.position, scale(headingVector(from.headingRad), lead));
      for (let i = 0; i < ctrl.length - 1; i++) {
        const p0 = i === 0 ? behind : (ctrl[i - 1] as Vec3);
        const p1 = ctrl[i] as Vec3;
        const p2 = ctrl[i + 1] as Vec3;
        const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)] as Vec3;
        for (let k = i === 0 ? 0 : 1; k <= SPAN_SAMPLES; k++) {
          pts.push(catmullRom(p0, p1, p2, p3, k / SPAN_SAMPLES));
        }
      }
      if (pts.length < 2) pts.push(from.position, from.position);
      const along = arcLengthSampler(pts);
      const last = pts[pts.length - 1] as Vec3;
      const prev = pts[pts.length - 2] as Vec3;
      return {
        compiled: {
          kind: seg.kind,
          t0,
          t1: t0 + seg.durationS,
          at: (s) => along(ease(seg.ease, s / seg.durationS)),
          restHeadingRad: from.headingRad,
        },
        end: { position: last, headingRad: headingBetween(prev, last, from.headingRad) },
      };
    }

    case "samples": {
      const xs = seg.samples;
      const first = xs[0];
      const last = xs[xs.length - 1];
      if (!first || !last) {
        return {
          compiled: {
            kind: seg.kind,
            t0,
            t1: t0,
            at: () => from.position,
            restHeadingRad: from.headingRad,
          },
          end: from,
        };
      }
      const at = (s: number): Vec3 => {
        if (s <= first.tS) return first.position;
        if (s >= last.tS) return last.position;
        let lo = 0;
        let hi = xs.length - 1;
        while (hi - lo > 1) {
          const mid = (lo + hi) >> 1;
          if ((xs[mid] as (typeof xs)[number]).tS <= s) lo = mid;
          else hi = mid;
        }
        const a = xs[lo] as (typeof xs)[number];
        const b = xs[hi] as (typeof xs)[number];
        return lerp3(a.position, b.position, (s - a.tS) / (b.tS - a.tS));
      };
      const beforeLast = xs[xs.length - 2] ?? first;
      return {
        compiled: { kind: seg.kind, t0, t1: t0 + last.tS, at, restHeadingRad: from.headingRad },
        end: {
          position: last.position,
          headingRad: headingBetween(beforeLast.position, last.position, from.headingRad),
        },
      };
    }
  }
}

export function compileTrack(
  nodeId: string,
  track: ActorTrack,
  issue: (msg: string) => void = () => {},
): CompiledTrack {
  const start = resolvePlace(track.start ?? { node: nodeId });
  const startHeadingRad = track.startHeadingRad ?? 0;
  let state: ChainState = { position: start, headingRad: startHeadingRad };
  let t = 0;
  const segments: CompiledSegment[] = [];
  for (const seg of track.segments) {
    const { compiled, end } = compileSegment(seg, t, state, (m) => issue(`${nodeId}: ${m}`));
    segments.push(compiled);
    state = end;
    t = compiled.t1;
  }
  return { nodeId, start, startHeadingRad, segments, durationS: t };
}

export function compileTimeline(tl: Timeline): CompiledTimeline {
  const issues: string[] = [];
  const tracks = Object.entries(tl.actors ?? {}).map(([id, track]) =>
    compileTrack(id, track, (m) => issues.push(m)),
  );
  const cues = (tl.cues ?? [])
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.tS - b.c.tS || a.i - b.i)
    .map(({ c }) => c);
  return {
    source: tl,
    durationS: tl.durationS,
    loop: tl.loop,
    tracks,
    links: Object.entries(tl.links ?? {}),
    threats: Object.entries(tl.threats ?? {}),
    visibility: Object.entries(tl.visibility ?? {}),
    cues,
    steps: tl.steps ?? [],
    issues,
  };
}

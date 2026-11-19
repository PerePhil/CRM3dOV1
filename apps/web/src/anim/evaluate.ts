/**
 * The interpreter's hot path: CompiledTimeline × time → Frame. Pure, so any time can be
 * evaluated in any order (seek, scrub, replay, screenshot at an exact t).
 *
 * Orientation is derived, never authored: heading follows the velocity, bank follows the turn
 * rate, and pitch follows the climb rate. Authors only describe where things go.
 */
import type { LinkState } from "@ov1/catalog";
import type { CompiledSegment, CompiledTimeline, CompiledTrack } from "./compile";
import type { Frame, Pose, Vec3 } from "./types";
import { headingOf, wrapAngle } from "./vec";

/** Finite-difference step for velocity / turn rate, seconds. */
const H = 1 / 60;
/** Below this horizontal speed (units/s) the actor counts as stationary. */
const MIN_SPEED = 1e-3;
/**
 * Visual "gravity" for bank angles, in diorama units/s². bank = atan(v·ω / G_VIS). The diorama
 * is compressed, so real g would give invisible banks; this is tuned so a slow OV-1 orbit leans
 * about 20°. Not physics: the sim owns physics.
 */
export const G_VIS = 0.35;
export const MAX_BANK_RAD = (35 * Math.PI) / 180;
export const MAX_PITCH_RAD = (25 * Math.PI) / 180;

const clampAbs = (x: number, m: number) => Math.min(m, Math.max(-m, x));

function segmentAt(track: CompiledTrack, tau: number): CompiledSegment | undefined {
  const segs = track.segments;
  for (const s of segs) if (tau < s.t1) return s;
  return segs[segs.length - 1];
}

/** Track position at track-local time; holds the final position after the last segment. */
export function positionAt(track: CompiledTrack, tau: number): Vec3 {
  const seg = segmentAt(track, tau);
  if (!seg) return track.start;
  const local = Math.min(Math.max(tau - seg.t0, 0), seg.t1 - seg.t0);
  return seg.at(local);
}

function velocityAt(track: CompiledTrack, tau: number): Vec3 {
  const a = Math.max(0, tau - H);
  const b = Math.min(track.durationS, tau + H);
  if (b - a < 1e-9) return [0, 0, 0];
  const pa = positionAt(track, a);
  const pb = positionAt(track, b);
  const dt = b - a;
  return [(pb[0] - pa[0]) / dt, (pb[1] - pa[1]) / dt, (pb[2] - pa[2]) / dt];
}

const horizSpeed = (v: Vec3) => Math.hypot(v[0], v[2]);

function headingAt(track: CompiledTrack, tau: number, v: Vec3): number {
  if (horizSpeed(v) > MIN_SPEED) return headingOf(v);
  return segmentAt(track, tau)?.restHeadingRad ?? track.startHeadingRad;
}

export function poseAt(track: CompiledTrack, tau: number): Pose {
  const position = positionAt(track, tau);
  const v = velocityAt(track, tau);
  const speed = horizSpeed(v);
  const headingRad = headingAt(track, tau, v);

  let bankRad = 0;
  if (speed > MIN_SPEED) {
    const ta = Math.max(0, tau - H);
    const tb = Math.min(track.durationS, tau + H);
    const va = velocityAt(track, ta);
    const vb = velocityAt(track, tb);
    if (tb - ta > 1e-9 && horizSpeed(va) > MIN_SPEED && horizSpeed(vb) > MIN_SPEED) {
      const omega = wrapAngle(headingOf(vb) - headingOf(va)) / (tb - ta);
      // Left turn (ω > 0) rolls left wing down, which is negative bank.
      bankRad = -clampAbs(Math.atan((speed * omega) / G_VIS), MAX_BANK_RAD);
    }
  }
  const pitchRad = speed > MIN_SPEED ? clampAbs(Math.atan2(v[1], speed), MAX_PITCH_RAD) : 0;
  return { position, headingRad, pitchRad, bankRad };
}

/** Map playback time to timeline-local time: wrap when looping, clamp otherwise. */
export function localTime(ct: Pick<CompiledTimeline, "durationS" | "loop">, tS: number): number {
  const d = ct.durationS;
  if (!(d > 0)) return 0;
  if (ct.loop) return ((tS % d) + d) % d;
  return Math.min(Math.max(tS, 0), d);
}

/** Last key at or before t, or undefined before the first key. Keys are sorted by tS. */
function keyAt<K extends { tS: number }>(keys: readonly K[], t: number): K | undefined {
  let hit: K | undefined;
  for (const k of keys) {
    if (k.tS <= t) hit = k;
    else break;
  }
  return hit;
}

export function evaluate(ct: CompiledTimeline, tS: number): Frame {
  const t = localTime(ct, tS);

  const actors = new Map<string, Pose>();
  for (const track of ct.tracks) actors.set(track.nodeId, poseAt(track, t));

  const links = new Map<string, LinkState>();
  for (const [id, keys] of ct.links) {
    const k = keyAt(keys, t);
    if (k) links.set(id, k.state);
  }

  const activeThreats = new Set<string>();
  for (const [id, keys] of ct.threats) {
    if (keyAt(keys, t)?.active) activeThreats.add(id);
  }

  const hidden = new Set<string>();
  for (const [id, keys] of ct.visibility) {
    const k = keyAt(keys, t);
    if (k && !k.visible) hidden.add(id);
  }

  const captions: string[] = [];
  const status = new Map<string, string>();
  for (const cue of ct.cues) {
    if (cue.tS > t) break;
    if (cue.durationS !== undefined && t >= cue.tS + cue.durationS) continue;
    if (cue.kind === "caption") captions.push(cue.text);
    else status.set(cue.node, cue.text);
  }

  let stepIndex = -1;
  ct.steps.forEach((s, i) => {
    if (s.tS <= t) stepIndex = i;
  });

  return { tS: t, actors, links, activeThreats, hidden, captions, status, stepIndex };
}

import type { Vec3 } from "./layout";

/**
 * OV-1 "lightning bolt" RF link geometry (SPEC §8.2). Pure and deterministic:
 * same inputs → same points, so screenshots are stable.
 */
export function zigzag(a: Vec3, b: Vec3, segments = 8, amplitude = 0.35): Vec3[] {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  if (len === 0 || segments < 2) return [a, b];
  const dir: Vec3 = [d[0] / len, d[1] / len, d[2] / len];
  // perpendicular = dir × up, falling back to dir × x̂ for near-vertical links
  let p: Vec3 = [-dir[2], 0, dir[0]];
  if (Math.hypot(...p) < 1e-3) p = [0, dir[2], -dir[1]];
  const pl = Math.hypot(...p);
  p = [p[0] / pl, p[1] / pl, p[2] / pl];

  const pts: Vec3[] = [a];
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const s = (i % 2 === 0 ? -1 : 1) * amplitude;
    pts.push([a[0] + d[0] * t + p[0] * s, a[1] + d[1] * t + p[1] * s, a[2] + d[2] * t + p[2] * s]);
  }
  pts.push(b);
  return pts;
}

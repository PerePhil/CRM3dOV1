/** Small allocation-light vector + easing helpers for the animation interpreter. Pure. */
import type { Ease, Vec3 } from "./types";

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const distance = (a: Vec3, b: Vec3): number => length(sub(a, b));
export const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;
export const lerp3 = (a: Vec3, b: Vec3, u: number): Vec3 => [
  lerp(a[0], b[0], u),
  lerp(a[1], b[1], u),
  lerp(a[2], b[2], u),
];
export const clamp01 = (u: number): number => Math.min(1, Math.max(0, u));

/** Wrap an angle into (-π, π]. */
export function wrapAngle(rad: number): number {
  const twoPi = 2 * Math.PI;
  let a = rad % twoPi;
  if (a <= -Math.PI) a += twoPi;
  if (a > Math.PI) a -= twoPi;
  return a;
}

/** Unit vector along a heading in the horizontal plane (scene convention: 0 = +x, ccw → -z). */
export const headingVector = (rad: number): Vec3 => [Math.cos(rad), 0, -Math.sin(rad)];

/** Heading of a horizontal direction, inverse of headingVector. */
export const headingOf = (v: Vec3): number => Math.atan2(-v[2], v[0]);

export function ease(kind: Ease | undefined, u: number): number {
  const x = clamp01(u);
  switch (kind ?? "linear") {
    case "in":
      return x * x;
    case "out":
      return 1 - (1 - x) * (1 - x);
    case "inOut":
      return x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x);
    default:
      return x;
  }
}

/** Cubic Bézier point. */
export function bezier(p0: Vec3, c0: Vec3, c1: Vec3, p1: Vec3, u: number): Vec3 {
  const v = 1 - u;
  const a = v * v * v;
  const b = 3 * v * v * u;
  const c = 3 * v * u * u;
  const d = u * u * u;
  return [
    a * p0[0] + b * c0[0] + c * c1[0] + d * p1[0],
    a * p0[1] + b * c0[1] + c * c1[1] + d * p1[1],
    a * p0[2] + b * c0[2] + c * c1[2] + d * p1[2],
  ];
}

/** Uniform Catmull-Rom point on the span p1 → p2. */
export function catmullRom(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, u: number): Vec3 {
  const u2 = u * u;
  const u3 = u2 * u;
  const out: Vec3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const a = p0[i] as number;
    const b = p1[i] as number;
    const c = p2[i] as number;
    const d = p3[i] as number;
    out[i] =
      0.5 *
      (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
  }
  return out;
}

/**
 * Arc-length lookup for a polyline: maps a 0..1 fraction of total length to a point, so motion
 * along a path is constant-speed regardless of how unevenly the points are spaced.
 */
export function arcLengthSampler(points: readonly Vec3[]): (u: number) => Vec3 {
  const first = points[0];
  if (!first) throw new Error("arcLengthSampler: need at least one point");
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push((cum[i - 1] as number) + distance(points[i - 1] as Vec3, points[i] as Vec3));
  }
  const total = cum[cum.length - 1] as number;
  if (total === 0) return () => [...first];
  return (u) => {
    const target = clamp01(u) * total;
    // Binary search for the segment containing `target`.
    let lo = 0;
    let hi = cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if ((cum[mid] as number) <= target) lo = mid;
      else hi = mid;
    }
    const segLen = (cum[hi] as number) - (cum[lo] as number);
    const f = segLen === 0 ? 0 : (target - (cum[lo] as number)) / segLen;
    return lerp3(points[lo] as Vec3, points[hi] as Vec3, f);
  };
}

import type { Link } from "@ov1/catalog";
import type { Vec3 } from "./layout";
import { zigzag } from "./zigzag";

/** Zig-zag segments per RF hop. Fixed, so a link's point count never changes while animating. */
export const RF_SEGMENTS = 10;
export const RF_AMPLITUDE = 0.3;

/**
 * OV-1 link polyline (SPEC §8.2) through `from → via… → to`, given where each node is right now.
 * rf = lightning bolt, wired / logical = straight hops. Pure; the point count depends only on
 * the link, never on positions, so line buffers can be rewritten in place every frame.
 */
export function linkPoints(
  link: Pick<Link, "from" | "to" | "via" | "medium">,
  positionOf: (nodeId: string) => Vec3,
): Vec3[] {
  const hops = [link.from, ...link.via, link.to].map(positionOf);
  const points: Vec3[] = [];
  for (let i = 0; i < hops.length - 1; i++) {
    const a = hops[i] as Vec3;
    const b = hops[i + 1] as Vec3;
    const seg = link.medium === "rf" ? zigzag(a, b, RF_SEGMENTS, RF_AMPLITUDE) : [a, b];
    points.push(...(i === 0 ? seg : seg.slice(1)));
  }
  return points;
}

/** A writable numeric array (Float32Array, number[], three.js attribute arrays). */
type Numbers = { length: number; [i: number]: number };

/**
 * Write a polyline into a Line2 `instanceStart/End` buffer: 6 floats per segment
 * (x0 y0 z0 x1 y1 z1). Returns false if the buffer doesn't match the point count.
 */
export function writeSegmentPositions(out: Numbers, points: readonly Vec3[]): boolean {
  if (out.length !== Math.max(0, points.length - 1) * 6) return false;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i] as Vec3;
    const b = points[i + 1] as Vec3;
    const o = i * 6;
    out[o] = a[0];
    out[o + 1] = a[1];
    out[o + 2] = a[2];
    out[o + 3] = b[0];
    out[o + 4] = b[1];
    out[o + 5] = b[2];
  }
  return true;
}

/** Write cumulative dash distances (d0 d1 per segment), as Line2.computeLineDistances does. */
export function writeSegmentDistances(out: Numbers, points: readonly Vec3[]): boolean {
  if (out.length !== Math.max(0, points.length - 1) * 2) return false;
  let d = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i] as Vec3;
    const b = points[i + 1] as Vec3;
    out[i * 2] = d;
    d += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    out[i * 2 + 1] = d;
  }
  return true;
}

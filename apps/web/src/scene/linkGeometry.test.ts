import { catalog } from "@ov1/catalog";
import { describe, expect, it } from "vitest";
import { homePosition } from "../anim/space";
import type { Vec3 } from "./layout";
import { linkPoints, writeSegmentDistances, writeSegmentPositions } from "./linkGeometry";

describe("linkPoints", () => {
  it("point count depends only on the link, not on positions (buffers rewrite in place)", () => {
    for (const l of catalog.links) {
      const a = linkPoints(l, homePosition);
      const b = linkPoints(l, (id) => {
        const p = homePosition(id);
        return [p[0] + 3, p[1] - 1, p[2] + 2];
      });
      expect(b.length).toBe(a.length);
    }
  });

  it("starts and ends on the endpoints", () => {
    for (const l of catalog.links) {
      const pts = linkPoints(l, homePosition);
      expect(pts[0]).toEqual(homePosition(l.from));
      expect(pts.at(-1)).toEqual(homePosition(l.to));
    }
  });
});

describe("in-place line buffer writers", () => {
  const pts: Vec3[] = [
    [0, 0, 0],
    [3, 4, 0],
    [3, 4, 12],
  ];

  it("writes segment pairs", () => {
    const out = new Float32Array(12);
    expect(writeSegmentPositions(out, pts)).toBe(true);
    expect([...out]).toEqual([0, 0, 0, 3, 4, 0, 3, 4, 0, 3, 4, 12]);
  });

  it("writes cumulative dash distances", () => {
    const out = new Float32Array(4);
    expect(writeSegmentDistances(out, pts)).toBe(true);
    expect([...out]).toEqual([0, 5, 5, 17]);
  });

  it("refuses mismatched buffers instead of writing garbage", () => {
    expect(writeSegmentPositions(new Float32Array(6), pts)).toBe(false);
    expect(writeSegmentDistances(new Float32Array(2), pts)).toBe(false);
  });
});

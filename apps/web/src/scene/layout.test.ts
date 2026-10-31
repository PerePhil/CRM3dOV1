import { catalog } from "@ov1/catalog";
import { describe, expect, it } from "vitest";
import { NODE_LAYOUT } from "./layout";
import { zigzag } from "./zigzag";

describe("OV-1 layout", () => {
  it("has a diorama position for every catalog node", () => {
    const missing = catalog.nodes.filter((n) => !(n.id in NODE_LAYOUT)).map((n) => n.id);
    expect(missing).toEqual([]);
  });

  it("has no positions for nodes that aren't in the catalog", () => {
    const ids = new Set(catalog.nodes.map((n) => n.id));
    expect(Object.keys(NODE_LAYOUT).filter((k) => !ids.has(k))).toEqual([]);
  });
});

describe("zigzag", () => {
  it("starts and ends exactly at the endpoints", () => {
    const pts = zigzag([0, 0, 0], [10, 2, 0], 6);
    expect(pts[0]).toEqual([0, 0, 0]);
    expect(pts.at(-1)).toEqual([10, 2, 0]);
    expect(pts).toHaveLength(7);
  });

  it("handles vertical links", () => {
    const pts = zigzag([0, 0, 0], [0, 10, 0], 4);
    expect(pts.every((p) => p.every(Number.isFinite))).toBe(true);
  });
});

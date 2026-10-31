import { catalog } from "@ov1/catalog";
import { describe, expect, it } from "vitest";
import { labelFraction } from "./linkLabels";

const link = (id: string, from: string, to: string) => ({ id, from, to });

describe("labelFraction", () => {
  it("puts a link with unique endpoints at the midpoint", () => {
    const a = link("a", "X", "Y");
    expect(labelFraction(a, [a, link("b", "X", "Z")])).toBe(0.5);
  });

  it("spreads links that share endpoints in the same direction", () => {
    const a = link("a", "X", "Y");
    const b = link("b", "X", "Y");
    expect(labelFraction(a, [a, b])).toBeCloseTo(1 / 3);
    expect(labelFraction(b, [a, b])).toBeCloseTo(2 / 3);
  });

  it("keeps reversed links apart (A→B and B→A must not land on the same spot)", () => {
    const up = link("up", "X", "Y");
    const down = link("down", "Y", "X");
    const fUp = labelFraction(up, [up, down]);
    const fDown = labelFraction(down, [up, down]);
    // Same point in space means fDown === 1 - fUp, because `down` runs the other way.
    expect(fDown).not.toBeCloseTo(1 - fUp);
  });

  it("gives every catalog link with shared endpoints a distinct label position", () => {
    const fromStart = catalog.links.map((l) => {
      const f = labelFraction(l, catalog.links);
      const [a, b] = [l.from, l.to].sort();
      return { pair: `${a}|${b}`, pos: l.from === a ? f : 1 - f };
    });
    const seen = new Set<string>();
    for (const { pair, pos } of fromStart) {
      const k = `${pair}@${pos.toFixed(3)}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });
});

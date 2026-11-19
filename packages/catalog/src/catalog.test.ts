import { describe, expect, it } from "vitest";
import { Catalog, catalog, getLink, getScenario, getThreat } from "./index";

describe("catalog", () => {
  it("parses and passes referential integrity", () => {
    expect(() => Catalog.parse(catalog)).not.toThrow();
  });

  it("ships the three SPEC §5.3 scenarios (mission analysis doc)", () => {
    expect(catalog.scenarios.map((s) => s.id)).toEqual(["S1", "S2", "S3"]);
  });

  it("follows the mission analysis doc: S1 GPS spoofing, S2 malware / FDI, S3 C2 jamming", () => {
    const shape = catalog.scenarios.map((s) => [s.id, s.threats.map((t) => getThreat(t).stride)]);
    expect(shape).toEqual([
      ["S1", [["S", "T"]]],
      [
        "S2",
        [
          ["T", "E"],
          ["S", "T"],
        ],
      ],
      ["S3", [["D"]]],
    ]);
  });

  it("every scenario resolves to at least one threat with a STRIDE category", () => {
    for (const s of catalog.scenarios) {
      expect(getScenario(s.id).threats.length).toBeGreaterThan(0);
    }
  });

  it("rejects a dangling reference", () => {
    const bad: typeof catalog = JSON.parse(JSON.stringify(catalog));
    bad.links.push({ ...getLink("L-LOS"), id: "L-BOGUS", to: "N-NOPE" });
    expect(Catalog.safeParse(bad).success).toBe(false);
  });

  it("only hostile nodes are adversary kinds", () => {
    for (const n of catalog.nodes) {
      expect(n.kind.startsWith("adversary-")).toBe(n.affiliation === "hostile");
    }
  });

  it("throws on unknown IDs instead of returning undefined", () => {
    expect(() => getLink("L-NOPE")).toThrow(/unknown link/);
  });
});

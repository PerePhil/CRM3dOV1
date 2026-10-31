import { describe, expect, it } from "vitest";
import { Catalog, catalog, getLink, getScenario } from "./index";

describe("catalog", () => {
  it("parses and passes referential integrity", () => {
    expect(() => Catalog.parse(catalog)).not.toThrow();
  });

  it("ships the six SPEC §5.3 scenarios", () => {
    expect(catalog.scenarios.map((s) => s.id)).toEqual(["S1", "S2", "S3", "S4", "S5", "S6"]);
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

/**
 * The catalog: single source of truth for every ID in the project (SPEC §4).
 * Data lives in ../data/*.json and is validated against ./schema.ts at import time,
 * so a bad edit fails loudly in tests, dev, and build.
 */
import adversariesJson from "../data/adversaries.json";
import controlsJson from "../data/controls.json";
import linksJson from "../data/links.json";
import nodesJson from "../data/nodes.json";
import scenariosJson from "../data/scenarios.json";
import threatsJson from "../data/threats.json";
import { Catalog, type Catalog as CatalogT } from "./schema";

export * from "./schema";

export const catalog: CatalogT = Catalog.parse({
  nodes: nodesJson,
  links: linksJson,
  threats: threatsJson,
  controls: controlsJson,
  adversaries: adversariesJson,
  scenarios: scenariosJson,
});

function indexById<T extends { id: string }>(items: readonly T[], kind: string) {
  const map = new Map(items.map((x) => [x.id, x]));
  return (id: string): T => {
    const hit = map.get(id);
    if (!hit) throw new Error(`catalog: unknown ${kind} id "${id}"`);
    return hit;
  };
}

export const getNode = indexById(catalog.nodes, "node");
export const getLink = indexById(catalog.links, "link");
export const getThreat = indexById(catalog.threats, "threat");
export const getControl = indexById(catalog.controls, "control");
export const getAdversary = indexById(catalog.adversaries, "adversary");
export const getScenario = indexById(catalog.scenarios, "scenario");

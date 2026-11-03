/**
 * Catalog lookups for timeline authors, so scripts never hardcode node/link/threat IDs
 * (AGENTS.md §4.5). Derive IDs from roles (node kind) or from catalog relationships
 * (scenario → threats → targeted links).
 */
import { catalog, getScenario, getThreat, type Node, type Scenario } from "@ov1/catalog";

/** The single catalog node of a kind. Throws if there are zero or several. */
export function nodeIdOfKind(kind: Node["kind"]): string {
  const hits = catalog.nodes.filter((n) => n.kind === kind);
  if (hits.length !== 1) {
    throw new Error(`anim: expected exactly one node of kind "${kind}", found ${hits.length}`);
  }
  return (hits[0] as Node).id;
}

/** IDs of links that connect to a node (as from, to, or a relay hop). */
export function linkIdsTouching(nodeId: string): string[] {
  return catalog.links
    .filter((l) => l.from === nodeId || l.to === nodeId || l.via.includes(nodeId))
    .map((l) => l.id);
}

/** Every link and node a scenario's threats target, de-duplicated, in catalog order. */
export function scenarioTargets(scenarioOrId: Scenario | string): {
  threats: string[];
  links: string[];
  nodes: string[];
} {
  const s = typeof scenarioOrId === "string" ? getScenario(scenarioOrId) : scenarioOrId;
  const threats = s.threats.map(getThreat);
  const links = new Set(threats.flatMap((t) => t.targets.links));
  const nodes = new Set(threats.flatMap((t) => t.targets.nodes));
  return {
    threats: s.threats,
    links: catalog.links.filter((l) => links.has(l.id)).map((l) => l.id),
    nodes: catalog.nodes.filter((n) => nodes.has(n.id)).map((n) => n.id),
  };
}

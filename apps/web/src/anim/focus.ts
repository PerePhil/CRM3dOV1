/**
 * Which nodes and links a timeline is "about", so the scene can de-emphasize the rest on a
 * projector (SPEC §8.4: callouts should stay legible; bystanders shouldn't compete with them).
 * Pure function of timeline data plus catalog relationships. No IDs hardcoded.
 */
import { catalog } from "@ov1/catalog";
import { scenarioTargets } from "./roles";
import type { Timeline } from "./types";

export interface Focus {
  nodes: ReadonlySet<string>;
  links: ReadonlySet<string>;
}

/**
 * The focus set of a timeline, or `null` when everything is in focus (idle, the baseline
 * mission, dev timelines: anything without a scenario).
 *
 * In focus for a scenario timeline:
 *   - links its threats target, and links whose state the timeline changes from the default;
 *   - nodes its threats target, nodes it moves, labels with status, or reveals;
 *   - both endpoints (and relay hops) of every focused link, so a highlighted link never
 *     points at a faded node.
 */
export function timelineFocus(tl: Timeline): Focus | null {
  if (!tl.scenarioId) return null;
  const targets = scenarioTargets(tl.scenarioId);
  const links = new Set(targets.links);
  for (const l of catalog.links) {
    if ((tl.links?.[l.id] ?? []).some((k) => k.state !== l.defaultState)) links.add(l.id);
  }
  const nodes = new Set(targets.nodes);
  for (const id of Object.keys(tl.actors ?? {})) nodes.add(id);
  for (const [id, keys] of Object.entries(tl.visibility ?? {})) {
    if (keys.some((k) => k.visible)) nodes.add(id);
  }
  for (const c of tl.cues ?? []) if (c.kind === "status") nodes.add(c.node);
  for (const l of catalog.links) {
    if (!links.has(l.id)) continue;
    for (const id of [l.from, ...l.via, l.to]) nodes.add(id);
  }
  return { nodes, links };
}

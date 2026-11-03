/** Resolving places and reading live positions/states out of a Frame. Pure. */
import type { Link, LinkState } from "@ov1/catalog";
import { NODE_LAYOUT } from "../scene/layout";
import type { Frame, Place, Vec3 } from "./types";
import { add } from "./vec";

/** A node's static diorama position (scene/layout.ts). Throws on unknown IDs. */
export function homePosition(nodeId: string): Vec3 {
  const p = NODE_LAYOUT[nodeId];
  if (!p) throw new Error(`anim: no layout position for node "${nodeId}"`);
  return p;
}

export function resolvePlace(place: Place): Vec3 {
  if (Array.isArray(place)) return [place[0], place[1], place[2]];
  return add(homePosition(place.node), place.offset ?? [0, 0, 0]);
}

/** Where a node is drawn this frame: its animated pose, or home if it has no track. */
export function livePosition(frame: Frame, nodeId: string): Vec3 {
  return frame.actors.get(nodeId)?.position ?? homePosition(nodeId);
}

/** A link's state this frame: the timeline's latest key, or the catalog default. */
export function linkStateOf(frame: Frame, link: Pick<Link, "id" | "defaultState">): LinkState {
  return frame.links.get(link.id) ?? link.defaultState;
}

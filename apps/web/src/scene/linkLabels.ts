import type { Link } from "@ov1/catalog";

type LinkEnds = Pick<Link, "id" | "from" | "to">;

/**
 * Where along a link's polyline its label sits, as a fraction (0 = `from`, 1 = `to`).
 *
 * A link with unique endpoints gets the midpoint. Links that share both endpoints (e.g. an
 * uplink and a downlink between the same two nodes) would put their labels on top of each
 * other, so they're spread evenly instead: 1/3 and 2/3 for a pair. Fractions are assigned
 * in one canonical direction, so a reversed link (B→A next to A→B) doesn't land back on
 * its partner's spot.
 */
export function labelFraction(link: LinkEnds, links: readonly LinkEnds[]): number {
  const key = (l: LinkEnds) => [l.from, l.to].sort().join("|");
  const group = links.filter((l) => key(l) === key(link));
  const rank = group.findIndex((l) => l.id === link.id);
  if (group.length < 2 || rank < 0) return 0.5;
  const canonical = (rank + 1) / (group.length + 1);
  return link.from <= link.to ? canonical : 1 - canonical;
}

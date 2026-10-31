import { catalog, type Link } from "@ov1/catalog";
import { Html, Line } from "@react-three/drei";
import { color, linkColorToken } from "../theme/tokens";
import { NODE_LAYOUT, type Vec3 } from "./layout";
import { labelFraction } from "./linkLabels";
import { zigzag } from "./zigzag";

const pos = (id: string): Vec3 => {
  const p = NODE_LAYOUT[id];
  if (!p) throw new Error(`layout: no position for ${id}`);
  return p;
};

/**
 * OV-1 link (SPEC §8.2). v0 draws the default state only: rf = lightning bolt,
 * wired = straight, logical = dashed. State patterns (degraded/denied/spoofed) are a backlog task.
 */
export function LinkLine({ link }: { link: Link }) {
  const hops = [link.from, ...link.via, link.to].map(pos);
  const points: Vec3[] = [];
  for (let i = 0; i < hops.length - 1; i++) {
    const a = hops[i] as Vec3;
    const b = hops[i + 1] as Vec3;
    const seg = link.medium === "rf" ? zigzag(a, b, 10, 0.3) : [a, b];
    points.push(...(i === 0 ? seg : seg.slice(1)));
  }
  // Midpoint for most links; spread out when links share endpoints (e.g. LOS C2 and TLM).
  const f = labelFraction(link, catalog.links);
  const mid = points[Math.round(f * (points.length - 1))] as Vec3;
  const token = linkColorToken(link);

  return (
    <group>
      <Line
        points={points as [number, number, number][]}
        color={color(token)}
        lineWidth={link.medium === "wired" ? 3 : 2.5}
        dashed={link.medium === "logical"}
        dashSize={0.4}
        gapSize={0.25}
      />
      <Html position={mid} center zIndexRange={[9, 0]} style={{ pointerEvents: "none" }}>
        <div
          className="whitespace-nowrap bg-paper/90 px-1 text-[9px] font-bold"
          style={{ color: `var(--color-${token})`, border: `1px solid var(--color-${token})` }}
        >
          {link.label}
        </div>
      </Html>
    </group>
  );
}

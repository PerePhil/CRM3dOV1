import { catalog, type Link } from "@ov1/catalog";
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type ComponentRef, useMemo, useRef } from "react";
import { type Group, InterleavedBufferAttribute, type Mesh } from "three";
import { homePosition, livePosition, playback } from "../anim";
import { color, linkColorToken } from "../theme/tokens";
import type { Vec3 } from "./layout";
import { linkPoints, writeSegmentDistances, writeSegmentPositions } from "./linkGeometry";
import { labelFraction } from "./linkLabels";

/** Rewrite a drei <Line>'s buffers in place (no per-frame allocation or GPU buffer churn). */
function writeLine(mesh: Mesh, points: readonly Vec3[]): void {
  const geom = mesh.geometry;
  const start = geom.getAttribute("instanceStart");
  if (
    start instanceof InterleavedBufferAttribute &&
    writeSegmentPositions(start.data.array, points)
  ) {
    start.data.needsUpdate = true;
  }
  const dist = geom.getAttribute("instanceDistanceStart");
  if (
    dist instanceof InterleavedBufferAttribute &&
    writeSegmentDistances(dist.data.array, points)
  ) {
    dist.data.needsUpdate = true;
  }
}

/**
 * OV-1 link (SPEC §8.2): rf = lightning bolt, wired = straight, logical = dashed. Endpoints
 * follow animated actors (anim/). State patterns (degraded / denied / spoofed) are the
 * link-state-render task: read the state with linkStateOf(playback.frame, link) or
 * usePlayback(s => s.discrete.links).
 */
export function LinkLine({ link }: { link: Link }) {
  const hops = useMemo(() => [link.from, ...link.via, link.to], [link]);
  // Static geometry for the first render; useFrame rewrites it while endpoints move.
  const initial = useMemo(() => linkPoints(link, homePosition), [link]);
  // Midpoint for most links; spread out when links share endpoints (e.g. LOS C2 and TLM).
  const labelIndex = Math.round(labelFraction(link, catalog.links) * (initial.length - 1));
  const mid = initial[labelIndex] as Vec3;
  const token = linkColorToken(link);

  const line = useRef<ComponentRef<typeof Line>>(null);
  const label = useRef<Group>(null);
  const wasMoving = useRef(false);

  useFrame(() => {
    const frame = playback.frame;
    const moving = hops.some((id) => frame.actors.has(id));
    // One extra write after motion stops, so lines settle back on the home positions.
    if (!moving && !wasMoving.current) return;
    wasMoving.current = moving;
    const pts = linkPoints(link, (id) => livePosition(frame, id));
    if (line.current) writeLine(line.current, pts);
    const p = pts[labelIndex];
    if (p) label.current?.position.set(p[0], p[1], p[2]);
  });

  return (
    <group>
      <Line
        ref={line}
        points={initial as [number, number, number][]}
        color={color(token)}
        lineWidth={link.medium === "wired" ? 3 : 2.5}
        dashed={link.medium === "logical"}
        dashSize={0.4}
        gapSize={0.25}
        // Buffers change every frame; the cached bounding sphere would cull a moved line.
        frustumCulled={false}
      />
      <group ref={label} position={mid}>
        <Html center zIndexRange={[9, 0]} style={{ pointerEvents: "none" }}>
          <div
            className="whitespace-nowrap bg-paper/90 px-1 text-[9px] font-bold"
            style={{ color: `var(--color-${token})`, border: `1px solid var(--color-${token})` }}
          >
            {link.label}
          </div>
        </Html>
      </group>
    </group>
  );
}

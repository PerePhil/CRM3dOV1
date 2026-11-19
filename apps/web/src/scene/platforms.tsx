import type { Node } from "@ov1/catalog";
import { Edges, Html } from "@react-three/drei";
import { useActorTransform, usePlayback } from "../anim";
import { color } from "../theme/tokens";
import { useHtmlPortal } from "./htmlPortal";
import type { Vec3 } from "./layout";

/**
 * v0 procedural platform "icons" (SPEC §8.1): flat-shaded primitives with dark outlines, in the
 * spirit of OV-1 clip art. Backlog task replaces these with CC0/CC-BY low-poly models.
 */
function Solid(props: { size: Vec3; position?: Vec3; fill: string; rotation?: Vec3 }) {
  return (
    <mesh position={props.position ?? [0, 0, 0]} rotation={props.rotation ?? [0, 0, 0]}>
      <boxGeometry args={props.size} />
      <meshStandardMaterial color={props.fill} flatShading />
      <Edges color={color("outline")} />
    </mesh>
  );
}

function Shape({ node, fill }: { node: Node; fill: string }) {
  switch (node.kind) {
    case "uav":
      return (
        <group>
          <Solid size={[2.4, 0.35, 0.5]} fill={fill} />
          <Solid size={[0.7, 0.08, 3.4]} position={[0.1, 0.05, 0]} fill={fill} />
          <Solid size={[0.4, 0.5, 0.06]} position={[-1.05, 0.3, 0]} fill={fill} />
        </group>
      );
    case "receiver":
      // Distinct from the tanker silhouette: shorter body, wider mid-mounted wing, twin canted
      // tails, so the two read as different aircraft when they fly in formation.
      return (
        <group>
          <Solid size={[1.9, 0.3, 0.42]} fill={fill} />
          <Solid size={[0.9, 0.07, 2.8]} position={[-0.15, 0, 0]} fill={fill} />
          <Solid
            size={[0.35, 0.45, 0.05]}
            position={[-0.8, 0.25, 0.22]}
            rotation={[0.35, 0, 0]}
            fill={fill}
          />
          <Solid
            size={[0.35, 0.45, 0.05]}
            position={[-0.8, 0.25, -0.22]}
            rotation={[-0.35, 0, 0]}
            fill={fill}
          />
        </group>
      );
    case "satcom":
      return (
        <group>
          <Solid size={[0.8, 0.8, 0.8]} fill={fill} />
          <Solid size={[3.2, 0.05, 0.9]} fill={fill} />
        </group>
      );
    case "gnss":
      return (
        <mesh>
          <octahedronGeometry args={[0.7]} />
          <meshStandardMaterial color={fill} flatShading />
          <Edges color={color("outline")} />
        </mesh>
      );
    case "c2":
      return <Solid size={[1.6, 2.4, 1.6]} position={[0, 0.2, 0]} fill={fill} />;
    case "adversary-jammer":
    case "adversary-spoofer":
      return (
        <group>
          <Solid size={[2.2, 0.6, 0.9]} fill={fill} />
          <mesh position={[0, 1.0, 0]}>
            <coneGeometry args={[0.25, 1.4, 6]} />
            <meshStandardMaterial color={fill} flatShading />
            <Edges color={color("outline")} />
          </mesh>
        </group>
      );
    default:
      return <Solid size={[1.1, 0.8, 1.1]} fill={fill} />;
  }
}

/**
 * Callout height above the platform. The receiver flies in formation just below and astern of
 * the tanker, so its callout goes underneath to keep both legible.
 */
const CALLOUT_Y: Partial<Record<Node["kind"], number>> = { receiver: -1.1 };

/**
 * One OV-1 node: platform icon + callout box (SPEC §8.4). Position and attitude come from the
 * animation layer (anim/), so any node with a track in the playing timeline moves; the rest sit
 * at their home position. The callout lives on the position-only group so it never rolls.
 * A node the timeline hides (visibility channel) draws nothing, callout included.
 */
export function Platform({ node, position }: { node: Node; position: Vec3 }) {
  const fill = color(node.affiliation);
  const { root, attitude } = useActorTransform(node.id);
  const status = usePlayback((s) => s.discrete.status.get(node.id));
  const hidden = usePlayback((s) => s.discrete.hidden.has(node.id));
  const portal = useHtmlPortal();
  return (
    <group ref={root} position={position} visible={!hidden}>
      <group ref={attitude}>
        <Shape node={node} fill={fill} />
      </group>
      {hidden ? null : (
        <Html
          portal={portal}
          position={[0, CALLOUT_Y[node.kind] ?? 1.6, 0]}
          center
          zIndexRange={[10, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            data-testid={`callout-${node.id}`}
            className="whitespace-nowrap border border-rule bg-paper px-1.5 py-0.5 text-[10px] font-bold leading-tight shadow-sm"
            style={{ borderLeft: `4px solid var(--color-${node.affiliation}-strong)` }}
          >
            {node.label}
            {status ? (
              <div
                data-testid={`callout-status-${node.id}`}
                className="text-[8px] font-normal uppercase tracking-wide text-ink-muted"
              >
                {status}
              </div>
            ) : null}
          </div>
        </Html>
      )}
    </group>
  );
}

import type { Node } from "@ov1/catalog";
import { Edges, Html } from "@react-three/drei";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { ExtrudeGeometry, Shape as ThreeShape } from "three";
import { useActorTransform, usePlayback } from "../anim";
import { color } from "../theme/tokens";
import { useHtmlPortal } from "./htmlPortal";
import type { Vec3 } from "./layout";
import { DIM_LABEL_OPACITY, DIM_SOLID_OPACITY, useFocus } from "./useFocus";

/**
 * Procedural platform "icons" (SPEC §8.1): flat-shaded low-poly primitives with dark outlines, in
 * the spirit of OV-1 clip art. Aircraft point nose +x, wings along z. Ground platforms sit with
 * their base at local y ≈ -0.8 … -1.0 so they rest on the deck or terrain under their layout
 * position. A backlog task may swap these for CC0/CC-BY models.
 */

/** True inside a de-emphasized node: parts render translucent. */
const Dim = createContext(false);

function Part(props: {
  children: ReactNode;
  fill: string;
  position?: Vec3;
  rotation?: Vec3;
  /** Edges crease angle, degrees. Raise it on round parts so only rims are outlined. */
  crease?: number;
}) {
  const dim = useContext(Dim);
  return (
    <mesh position={props.position ?? [0, 0, 0]} rotation={props.rotation ?? [0, 0, 0]}>
      {props.children}
      <meshStandardMaterial
        color={props.fill}
        flatShading
        transparent={dim}
        opacity={dim ? DIM_SOLID_OPACITY : 1}
        depthWrite={!dim}
      />
      <Edges
        color={color("outline")}
        threshold={props.crease ?? 15}
        transparent={dim}
        opacity={dim ? DIM_SOLID_OPACITY : 1}
      />
    </mesh>
  );
}

const Box = (p: { size: Vec3; fill: string; position?: Vec3; rotation?: Vec3 }) => (
  <Part fill={p.fill} position={p.position} rotation={p.rotation}>
    <boxGeometry args={p.size} />
  </Part>
);

/** Cylinder along x (fuselages), or along y with `upright`. */
const Rod = (p: {
  r: number;
  length: number;
  fill: string;
  position?: Vec3;
  upright?: boolean;
  alongZ?: boolean;
  r2?: number;
  sides?: number;
}) => (
  <Part
    fill={p.fill}
    position={p.position}
    rotation={p.upright ? [0, 0, 0] : p.alongZ ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2]}
    crease={50}
  >
    <cylinderGeometry args={[p.r2 ?? p.r, p.r, p.length, p.sides ?? 10]} />
  </Part>
);

/** Cone pointing along +x (dir 1) or -x (dir -1). */
const Nose = (p: { r: number; length: number; fill: string; x: number; dir: 1 | -1 }) => (
  <Part fill={p.fill} position={[p.x, 0, 0]} rotation={[0, 0, -p.dir * (Math.PI / 2)]} crease={50}>
    <coneGeometry args={[p.r, p.length, 10]} />
  </Part>
);

/** A flat planform (wing, stabilizer, hull) drawn in the x/z plane, extruded `thick` in y. */
function Plan(p: {
  points: readonly [number, number][];
  thick: number;
  fill: string;
  position?: Vec3;
  rotation?: Vec3;
}) {
  const geom = useMemo(() => {
    const shape = new ThreeShape();
    p.points.forEach(([x, z], i) => {
      if (i === 0) shape.moveTo(x, z);
      else shape.lineTo(x, z);
    });
    shape.closePath();
    const g = new ExtrudeGeometry(shape, { depth: p.thick, bevelEnabled: false });
    // Shape (x, y) → world (x, ·, y); extrusion lands on -y, so re-center it on y = 0.
    g.rotateX(Math.PI / 2);
    g.translate(0, p.thick / 2, 0);
    return g;
  }, [p.points, p.thick]);
  return (
    <Part fill={p.fill} position={p.position} rotation={p.rotation}>
      <primitive object={geom} attach="geometry" />
    </Part>
  );
}

/** Mirror a half planform (z ≥ 0, listed root LE → tip → root TE) into a full one. */
function mirrored(half: readonly [number, number][]): [number, number][] {
  const back = [...half].reverse().map(([x, z]) => [x, -z] as [number, number]);
  return [...half, ...back.filter(([, z]) => z !== 0)];
}

const UAV_WING = mirrored([
  [0.42, 0],
  [0.02, 1.8],
  [-0.22, 1.8],
  [-0.32, 0],
]);
const RCV_WING = mirrored([
  [0.3, 0],
  [-0.3, 1.3],
  [-0.52, 1.3],
  [-0.6, 0],
]);
const RCV_STAB = mirrored([
  [-0.75, 0],
  [-1.0, 0.6],
  [-1.15, 0.6],
  [-1.15, 0],
]);
/** Swept fin profile in the x/z plane (z = height); stood up with rotation [-(π/2 ∓ cant), 0, 0]. */
const FIN: [number, number][] = [
  [0, 0],
  [-0.3, 0.5],
  [-0.5, 0.5],
  [-0.4, 0],
];

function Shape({ node, fill }: { node: Node; fill: string }) {
  const dark = color("outline");
  switch (node.kind) {
    case "uav":
      // Carrier-based unmanned tanker, notional: slim body, high-aspect wing, V-tail, dorsal inlet.
      return (
        <group>
          <Rod r={0.2} length={1.7} fill={fill} position={[-0.1, 0, 0]} />
          <Nose r={0.2} length={0.6} fill={fill} x={1.05} dir={1} />
          <Nose r={0.2} length={0.45} fill={fill} x={-1.17} dir={-1} />
          <Plan points={UAV_WING} thick={0.06} fill={fill} position={[0, 0.08, 0]} />
          <Box size={[0.55, 0.14, 0.26]} fill={fill} position={[0.25, 0.22, 0]} />
          {[1, -1].map((side) => (
            <Plan
              key={side}
              points={FIN}
              thick={0.04}
              fill={fill}
              position={[-0.75, 0.12, side * 0.08]}
              rotation={[-(Math.PI / 2 - side * 0.7), 0, 0]}
            />
          ))}
          {/* Refueling store under the wing. */}
          <Rod r={0.07} length={0.6} fill={fill} position={[0.0, -0.1, 0.9]} />
        </group>
      );
    case "receiver":
      // Fighter-type receiver, notional: shorter body, trapezoid wing, twin canted tails, stabs.
      return (
        <group>
          <Rod r={0.17} length={1.5} fill={fill} position={[-0.2, 0, 0]} />
          <Nose r={0.17} length={0.6} fill={fill} x={0.85} dir={1} />
          <Box size={[0.4, 0.12, 0.2]} fill={fill} position={[0.45, 0.17, 0]} />
          <Plan points={RCV_WING} thick={0.05} fill={fill} />
          <Plan points={RCV_STAB} thick={0.04} fill={fill} />
          {[1, -1].map((side) => (
            <Plan
              key={side}
              points={FIN.map(([x, z]) => [x * 0.9, z * 0.9] as [number, number])}
              thick={0.04}
              fill={fill}
              position={[-0.55, 0.1, side * 0.2]}
              rotation={[-(Math.PI / 2 - side * 0.3), 0, 0]}
            />
          ))}
        </group>
      );
    case "satcom":
      // Comms satellite: bus, two solar wings on booms, nadir dish.
      return (
        <group>
          <Box size={[0.8, 0.8, 0.8]} fill={fill} />
          {[1, -1].map((side) => (
            <group key={side}>
              <Rod r={0.04} length={0.5} fill={dark} position={[side * 0.65, 0, 0]} />
              <Box size={[1.4, 0.04, 0.75]} fill={fill} position={[side * 1.6, 0, 0]} />
            </group>
          ))}
          <Part fill={fill} position={[0, -0.6, 0]} rotation={[Math.PI, 0, 0]} crease={50}>
            <cylinderGeometry args={[0.45, 0.12, 0.2, 12]} />
          </Part>
        </group>
      );
    case "gnss":
      // Navigation satellite: taller bus, panels on a z boom, nadir antenna array.
      return (
        <group>
          <Box size={[0.6, 0.9, 0.6]} fill={fill} />
          {[1, -1].map((side) => (
            <group key={side}>
              <Rod r={0.04} length={0.4} fill={dark} position={[0, 0, side * 0.5]} alongZ />
              <Box size={[0.6, 0.04, 1.2]} fill={fill} position={[0, 0, side * 1.3]} />
            </group>
          ))}
          <Box size={[0.4, 0.15, 0.4]} fill={fill} position={[0, -0.52, 0]} />
        </group>
      );
    case "c2":
      // Operations center: low block, tower, roof mast with dish.
      return (
        <group>
          <Box size={[2.0, 1.1, 1.5]} fill={fill} position={[0.2, -0.45, 0]} />
          <Box size={[0.8, 2.1, 0.8]} fill={fill} position={[-0.55, 0.05, 0]} />
          <Rod r={0.04} length={0.7} fill={dark} position={[-0.55, 1.45, 0]} upright />
          <Part fill={fill} position={[0.5, 0.25, 0]} rotation={[0, 0, -0.6]} crease={50}>
            <cylinderGeometry args={[0.35, 0.08, 0.15, 12]} />
          </Part>
        </group>
      );
    case "gcs":
      // Ground control station: deck shelter and a tracking dish on a mast.
      return (
        <group>
          <Box size={[1.3, 0.75, 0.9]} fill={fill} position={[0, -0.42, 0]} />
          <Rod r={0.05} length={0.6} fill={dark} position={[0.3, 0.25, 0]} upright />
          <Part fill={fill} position={[0.3, 0.6, 0]} rotation={[0, 0, -0.7]} crease={50}>
            <cylinderGeometry args={[0.35, 0.08, 0.15, 12]} />
          </Part>
        </group>
      );
    case "maintenance":
      // Hangar bay: box with a barrel roof.
      return (
        <group>
          <Box size={[1.5, 0.5, 1.0]} fill={fill} position={[0, -0.55, 0]} />
          <Part fill={fill} position={[0, -0.3, 0]} rotation={[0, 0, Math.PI / 2]} crease={50}>
            <cylinderGeometry args={[0.5, 0.5, 1.5, 10, 1, false, 0, Math.PI]} />
          </Part>
        </group>
      );
    case "supply-chain":
      // Vendor / factory: sawtooth roof and a stack.
      return (
        <group>
          <Box size={[1.6, 0.6, 1.0]} fill={fill} position={[0, -0.5, 0]} />
          {[-0.5, 0, 0.5].map((x) => (
            <Part key={x} fill={fill} position={[x, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.28, 0.28, 1.0, 3]} />
            </Part>
          ))}
          <Rod r={0.1} length={1.1} fill={fill} position={[0.65, 0.15, 0.3]} upright />
        </group>
      );
    case "adversary-jammer":
    case "adversary-spoofer":
      return (
        <group>
          {/* Truck: cab, bed, wheels. */}
          <Box size={[0.6, 0.55, 0.8]} fill={fill} position={[0.85, -0.42, 0]} />
          <Box size={[1.5, 0.3, 0.85]} fill={fill} position={[-0.2, -0.55, 0]} />
          {[0.85, 0.05, -0.6].map((x) => (
            <Rod
              key={x}
              r={0.17}
              length={0.9}
              fill={dark}
              position={[x, -0.72, 0]}
              alongZ
              sides={8}
            />
          ))}
          {node.kind === "adversary-jammer" ? (
            // Tilted emitter panel array.
            <Box
              size={[0.12, 0.95, 0.8]}
              fill={fill}
              position={[-0.3, 0.0, 0]}
              rotation={[0, 0, -0.45]}
            />
          ) : (
            // Mast with a GNSS-band antenna head.
            <group>
              <Rod r={0.05} length={1.4} fill={dark} position={[-0.3, 0.3, 0]} upright />
              <Part fill={fill} position={[-0.3, 1.05, 0]} crease={50}>
                <coneGeometry args={[0.25, 0.35, 8]} />
              </Part>
            </group>
          )}
        </group>
      );
    case "adversary-cyber":
      // Cyber operator: server rack and a workstation.
      return (
        <group>
          <Box size={[0.7, 1.5, 0.7]} fill={fill} position={[-0.3, -0.15, 0]} />
          {[0.3, 0, -0.3].map((y) => (
            <Box key={y} size={[0.04, 0.12, 0.55]} fill={dark} position={[0.06, y, 0]} />
          ))}
          <Box size={[0.6, 0.5, 0.7]} fill={fill} position={[0.45, -0.65, 0]} />
          <Box size={[0.06, 0.35, 0.5]} fill={fill} position={[0.4, -0.2, 0]} />
        </group>
      );
    default:
      return <Box size={[1.1, 0.8, 1.1]} fill={fill} />;
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
 * A node the timeline hides (visibility channel) draws nothing, callout included. Nodes the
 * playing scenario doesn't involve fade back (useFocus) so the ones it does stay readable.
 */
export function Platform({ node, position }: { node: Node; position: Vec3 }) {
  const fill = color(node.affiliation);
  const { root, attitude } = useActorTransform(node.id);
  const status = usePlayback((s) => s.discrete.status.get(node.id));
  const hidden = usePlayback((s) => s.discrete.hidden.has(node.id));
  const focus = useFocus();
  const dim = focus !== null && !focus.nodes.has(node.id);
  const portal = useHtmlPortal();
  return (
    <group ref={root} position={position} visible={!hidden}>
      <group ref={attitude}>
        <Dim.Provider value={dim}>
          <Shape node={node} fill={fill} />
        </Dim.Provider>
      </group>
      {hidden ? null : (
        <Html
          portal={portal}
          position={[0, CALLOUT_Y[node.kind] ?? 1.6, 0]}
          center
          zIndexRange={dim ? [5, 0] : [10, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            data-testid={`callout-${node.id}`}
            data-dim={dim || undefined}
            className="whitespace-nowrap border border-rule bg-paper px-2 py-0.5 text-sm font-bold leading-tight shadow-sm transition-opacity duration-300"
            style={{
              borderLeft: `0.3rem solid var(--color-${node.affiliation}-strong)`,
              opacity: dim ? DIM_LABEL_OPACITY : 1,
            }}
          >
            {node.label}
            {status ? (
              <div
                data-testid={`callout-status-${node.id}`}
                className="text-xs font-bold uppercase tracking-wide text-ink-muted"
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

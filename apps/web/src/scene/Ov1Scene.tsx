import { catalog } from "@ov1/catalog";
import { Edges, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import { ExtrudeGeometry, Shape } from "three";
import { AnimationDriver } from "../anim";
import { color } from "../theme/tokens";
import { CameraRig } from "./CameraRig";
import { LinkLine } from "./LinkLine";
import { NODE_LAYOUT, SCENERY, SLIDE_CAMERA, type Vec3 } from "./layout";
import { Platform } from "./platforms";

/**
 * Carrier hull inside SCENERY.carrier's box: square stern, bow chamfered on the starboard (+z)
 * side so the launch lane (port side, -z) keeps its full length, and an island aft of the GCS.
 */
function Carrier() {
  const { position, size } = SCENERY.carrier;
  const [hx, hy, hz] = [size[0] / 2, size[1], size[2] / 2];
  const hull = useMemo(() => {
    const s = new Shape();
    s.moveTo(-hx, -hz);
    s.lineTo(hx, -hz);
    s.lineTo(hx, hz * 0.2);
    s.lineTo(hx - 0.9, hz);
    s.lineTo(-hx, hz);
    s.closePath();
    const g = new ExtrudeGeometry(s, { depth: hy, bevelEnabled: false });
    g.rotateX(Math.PI / 2);
    g.translate(0, hy / 2, 0);
    return g;
  }, [hx, hy, hz]);
  const fill = color("paper-alt");
  return (
    <group position={position}>
      <mesh geometry={hull}>
        <meshStandardMaterial color={fill} flatShading />
        <Edges color={color("outline")} />
      </mesh>
      <mesh position={[2.4, hy / 2 + 0.45, hz - 0.25]}>
        <boxGeometry args={[1.0, 0.9, 0.35]} />
        <meshStandardMaterial color={fill} flatShading />
        <Edges color={color("outline")} />
      </mesh>
    </group>
  );
}

function Scenery() {
  const { friendlyLand, hostileLand, ocean } = SCENERY;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={ocean.size} />
        <meshStandardMaterial color={color("ocean")} />
      </mesh>
      <Carrier />
      {[
        { ...friendlyLand, fill: color("land") },
        { ...hostileLand, fill: color("land") },
      ].map((s) => (
        <mesh key={s.position.join(",")} position={s.position}>
          <boxGeometry args={s.size} />
          <meshStandardMaterial color={s.fill} flatShading />
          <Edges color={color("outline")} />
        </mesh>
      ))}
    </group>
  );
}

/** The OV-1 diorama (SPEC §7, §8). Motion comes from the playing timeline (anim/). */
export function Ov1Scene() {
  return (
    <Canvas
      data-testid="ov1-canvas"
      camera={{ position: [...SLIDE_CAMERA.position], fov: SLIDE_CAMERA.fov }}
      gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
      dpr={[1, 2]}
    >
      <AnimationDriver />
      <hemisphereLight args={[color("sky-top"), color("land"), 1.1]} />
      <directionalLight position={[10, 20, 12]} intensity={1.4} />
      <Scenery />
      {catalog.nodes.map((n) => (
        <Platform key={n.id} node={n} position={NODE_LAYOUT[n.id] as Vec3} />
      ))}
      {catalog.links.map((l) => (
        <LinkLine key={l.id} link={l} />
      ))}
      <OrbitControls makeDefault target={[...SLIDE_CAMERA.target]} maxPolarAngle={Math.PI / 2.1} />
      <CameraRig />
    </Canvas>
  );
}

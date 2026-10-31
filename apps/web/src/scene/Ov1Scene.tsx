import { catalog } from "@ov1/catalog";
import { Edges, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { color } from "../theme/tokens";
import { LinkLine } from "./LinkLine";
import { NODE_LAYOUT, SCENERY, SLIDE_CAMERA, type Vec3 } from "./layout";
import { Platform } from "./platforms";

function Scenery() {
  const { carrier, friendlyLand, hostileLand, ocean } = SCENERY;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={ocean.size} />
        <meshStandardMaterial color={color("ocean")} />
      </mesh>
      {[
        { ...friendlyLand, fill: color("land") },
        { ...hostileLand, fill: color("land") },
        { ...carrier, fill: color("paper-alt") },
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

/** The OV-1 diorama (SPEC §7, §8). v0: static default-state scene from the catalog. */
export function Ov1Scene() {
  return (
    <Canvas
      data-testid="ov1-canvas"
      camera={{ position: [...SLIDE_CAMERA.position], fov: SLIDE_CAMERA.fov }}
      gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
      dpr={[1, 2]}
    >
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
    </Canvas>
  );
}

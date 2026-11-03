/**
 * React + R3F bindings for the playback controller. The scene reads motion through these hooks;
 * see docs/animation/extending.md for the rules (no per-frame React state).
 */
import { useFrame } from "@react-three/fiber";
import { useRef, useSyncExternalStore } from "react";
import type { Group } from "three";
import { playback } from "./instance";
import type { PlaybackSnapshot } from "./playback";
import { homePosition } from "./space";

/**
 * Subscribe a component to the playback snapshot. The selector must return a primitive or an
 * object already on the snapshot (e.g. `s => s.discrete.links`), never a fresh object, or React
 * will re-render forever.
 */
export function usePlayback<T>(select: (s: PlaybackSnapshot) => T): T {
  return useSyncExternalStore(
    playback.subscribe,
    () => select(playback.getSnapshot()),
    () => select(playback.getSnapshot()),
  );
}

/**
 * Advances the playback clock once per rendered frame. Mount exactly once, inside <Canvas>.
 * Priority -1 runs it before every default-priority useFrame, so consumers always read the
 * current frame. (Negative priorities don't take over rendering in R3F; positive ones do.)
 */
export function AnimationDriver() {
  useFrame((_, deltaS) => playback.tick(deltaS), -1);
  return null;
}

/**
 * Bind a node's groups to its animated pose:
 *   - `root` gets the position (put callouts / labels here so they follow but don't rotate),
 *   - `attitude` gets heading, pitch, and bank (put the platform geometry here).
 * Nodes without a track sit at their home position with zero rotation.
 */
export function useActorTransform(nodeId: string) {
  const root = useRef<Group>(null);
  const attitude = useRef<Group>(null);
  useFrame(() => {
    const pose = playback.frame.actors.get(nodeId);
    const p = pose?.position ?? homePosition(nodeId);
    root.current?.position.set(p[0], p[1], p[2]);
    // Intrinsic yaw → pitch → roll: "YZX" applies Y (heading) first, then Z (pitch), then X (bank).
    attitude.current?.rotation.set(
      pose?.bankRad ?? 0,
      pose?.headingRad ?? 0,
      pose?.pitchRad ?? 0,
      "YZX",
    );
  });
  return { root, attitude };
}

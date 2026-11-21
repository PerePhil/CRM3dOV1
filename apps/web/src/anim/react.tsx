/**
 * React + R3F bindings for the playback controller. The scene reads motion through these hooks;
 * see docs/animation/extending.md for the rules (no per-frame React state).
 */
import { useFrame } from "@react-three/fiber";
import { useRef, useSyncExternalStore } from "react";
import { Euler, type Group, Quaternion } from "three";
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
 * useFrame priorities for the scene, lowest runs first. Negative priorities don't take over
 * rendering in R3F; positive ones do, so never go above 0.
 *   CLOCK  ticks playback (AnimationDriver).
 *   CAMERA moves the camera rig (after drei OrbitControls.update at -1).
 *   ACTORS writes node and link transforms.
 *   0      drei <Html> projects its anchor to the screen.
 * ACTORS must run before 0: <Html> is a child of the node group, so React registers its
 * useFrame first, and at equal priority every callout would be projected from the previous
 * frame's position. That one-frame lag is what made the callout boxes jitter against the meshes.
 */
export const FRAME_PRIORITY = { CLOCK: -1, CAMERA: -0.75, ACTORS: -0.5 } as const;

/**
 * Weight of the newest frame delta in the clock's moving average. requestAnimationFrame deltas
 * wobble by a few ms frame to frame (more on a laptop driving a projector); feeding them raw
 * makes motion stutter even at 60 fps. Averaging keeps playback speed exact over time.
 */
export const CLOCK_SMOOTHING = 0.2;

/** Frame delta smoother. A delta far off the average (tab switch, hitch) resets it. */
export function createDeltaSmoother(weight = CLOCK_SMOOTHING): (dtS: number) => number {
  let avg = -1;
  return (dtS) => {
    if (avg < 0 || dtS > avg * 4 || dtS < avg / 4) avg = dtS;
    else avg += (dtS - avg) * weight;
    return avg;
  };
}

/** Advances the playback clock once per rendered frame. Mount exactly once, inside <Canvas>. */
export function AnimationDriver() {
  const smooth = useRef(createDeltaSmoother());
  useFrame((_, deltaS) => playback.tick(smooth.current(deltaS)), FRAME_PRIORITY.CLOCK);
  return null;
}

/**
 * Attitude damping rate, 1/s. Heading, pitch, and bank are derived from the track, so they jump
 * where two motion segments meet (a straight leg into an orbit snaps the bank angle). The scene
 * eases toward the evaluated attitude at this rate; the evaluated pose itself stays exact.
 */
export const ATTITUDE_RATE = 6;
/** A playback jump larger than this (seek, load, loop wrap) snaps the attitude instead. */
const SNAP_JUMP_S = 0.5;

/**
 * Bind a node's groups to its animated pose:
 *   - `root` gets the position (put callouts / labels here so they follow but don't rotate),
 *   - `attitude` gets heading, pitch, and bank (put the platform geometry here).
 * Nodes without a track sit at their home position with zero rotation.
 */
export function useActorTransform(nodeId: string) {
  const root = useRef<Group>(null);
  const attitude = useRef<Group>(null);
  const state = useRef({ lastT: Number.NaN, euler: new Euler(), target: new Quaternion() });
  useFrame((_, deltaS) => {
    const frame = playback.frame;
    const pose = frame.actors.get(nodeId);
    const p = pose?.position ?? homePosition(nodeId);
    root.current?.position.set(p[0], p[1], p[2]);
    const g = attitude.current;
    if (!g) return;
    const st = state.current;
    // Intrinsic yaw → pitch → roll: "YZX" applies Y (heading) first, then Z (pitch), then X (bank).
    st.euler.set(pose?.bankRad ?? 0, pose?.headingRad ?? 0, pose?.pitchRad ?? 0, "YZX");
    st.target.setFromEuler(st.euler);
    const jumped = !(Math.abs(frame.tS - st.lastT) <= SNAP_JUMP_S);
    st.lastT = frame.tS;
    if (jumped) g.quaternion.copy(st.target);
    else g.quaternion.slerp(st.target, 1 - Math.exp(-ATTITUDE_RATE * deltaS));
  }, FRAME_PRIORITY.ACTORS);
  return { root, attitude };
}

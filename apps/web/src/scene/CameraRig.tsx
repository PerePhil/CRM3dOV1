import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Vector3 } from "three";
import { FRAME_PRIORITY, livePosition, nodeIdOfKind, playback } from "../anim";
import { type CameraMode, view } from "../view/viewStore";
import { SLIDE_CAMERA } from "./layout";

/** Camera distance from the UAV when a follow mode starts, diorama units. */
export const CHASE_DISTANCE = 22;
/** Camera elevation above the UAV's horizon when a follow mode starts, radians (~32°). */
export const CHASE_ELEVATION_RAD = 0.55;
/**
 * Orbit mode turn rate, radians per second of PLAYBACK time: one lap per mission minute at 1×,
 * slow enough to read callouts while it turns. Driven by the playback clock (AGENTS.md §6.1), so
 * pause and end freeze it and the speed control scales it.
 */
export const ORBIT_RATE_RAD_S = (2 * Math.PI) / 60;
/** A playback step larger than this (seek, load, loop wrap) doesn't turn the orbit. */
const ORBIT_MAX_STEP_S = 0.5;

/**
 * How far orbit mode turns between two playback times, radians. Only forward playback within
 * one normal tick counts; pauses, seeks, and wraps turn nothing.
 */
export function orbitStepRad(prevTS: number, tS: number): number {
  const d = tS - prevTS;
  return d > 0 && d <= ORBIT_MAX_STEP_S ? ORBIT_RATE_RAD_S * d : 0;
}
/** Ease time for entering a follow mode or resetting to the slide view, seconds. */
export const TRANSITION_S = 1.4;

/** Minimal view of drei's OrbitControls (three-stdlib) that the rig needs. */
interface Controls {
  target: Vector3;
  update(): unknown;
}

const smoothstep = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/**
 * Presentation camera (view/viewStore: free / track / orbit). Mount once inside <Canvas>, with
 * drei <OrbitControls makeDefault/>.
 *
 * Follow modes translate camera and orbit target together, so the user can still drag to change
 * the angle or scroll to zoom mid-flight and the rig keeps that framing. Orbit adds a slow turn
 * about the vertical axis, advanced by the playback clock rather than render time. Mode changes and "reset view" ease over TRANSITION_S, so the room never
 * sees a hard cut. Runs at FRAME_PRIORITY.CAMERA: after OrbitControls.update, before the
 * callouts project themselves.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const uavId = useMemo(() => nodeIdOfKind("uav"), []);
  const st = useRef({
    mode: "free" as CameraMode,
    resetSeq: view.get().resetSeq,
    /** Active transition, if any: where it started and how far along it is (0..1). */
    tr: null as null | { kind: "chase" | "slide"; t: number; pos: Vector3; target: Vector3 },
    tmpA: new Vector3(),
    tmpB: new Vector3(),
    off: new Vector3(),
    lastTS: Number.NaN,
  });

  useFrame((_, dtS) => {
    if (!controls) return;
    const s = st.current;
    const v = view.get();
    const startTransition = (kind: "chase" | "slide") => {
      s.tr = { kind, t: 0, pos: camera.position.clone(), target: controls.target.clone() };
    };
    if (v.resetSeq !== s.resetSeq) {
      s.resetSeq = v.resetSeq;
      s.mode = v.cameraMode;
      startTransition("slide");
    }
    if (v.cameraMode !== s.mode) {
      const wasFollowing = s.mode !== "free";
      s.mode = v.cameraMode;
      // Track ⇄ orbit keeps the current framing; free → follow eases in to a chase framing.
      if (s.mode !== "free" && !wasFollowing) startTransition("chase");
    }

    const frame = playback.frame;
    const orbitRad = orbitStepRad(s.lastTS, frame.tS);
    s.lastTS = frame.tS;
    const p = livePosition(frame, uavId);
    const uav = s.tmpA.set(p[0], p[1], p[2]);

    if (s.tr) {
      s.tr.t = Math.min(1, s.tr.t + dtS / TRANSITION_S);
      const e = smoothstep(s.tr.t);
      let endTarget: Vector3;
      let endPos: Vector3;
      if (s.tr.kind === "slide") {
        endTarget = s.tmpB.set(...SLIDE_CAMERA.target);
        endPos = s.off.set(...SLIDE_CAMERA.position);
      } else {
        // Chase framing: CHASE_DISTANCE from the UAV at CHASE_ELEVATION_RAD, on the side the
        // camera is already on, so the move reads as a dolly-in rather than a swing around.
        const az = Math.atan2(s.tr.pos.x - s.tr.target.x, s.tr.pos.z - s.tr.target.z);
        const h = CHASE_DISTANCE * Math.cos(CHASE_ELEVATION_RAD);
        endTarget = uav;
        endPos = s.off.set(
          uav.x + h * Math.sin(az),
          uav.y + CHASE_DISTANCE * Math.sin(CHASE_ELEVATION_RAD),
          uav.z + h * Math.cos(az),
        );
      }
      controls.target.copy(s.tr.target).lerp(endTarget, e);
      camera.position.copy(s.tr.pos).lerp(endPos, e);
      if (s.tr.t >= 1) s.tr = null;
    } else if (s.mode !== "free") {
      // Rigid follow: the UAV's motion is already smooth, and damping here would let it drift
      // off-center at speed.
      const delta = s.tmpB.copy(uav).sub(controls.target);
      controls.target.add(delta);
      camera.position.add(delta);
      if (s.mode === "orbit") {
        s.off.copy(camera.position).sub(controls.target);
        s.off.applyAxisAngle(UP, orbitRad);
        camera.position.copy(controls.target).add(s.off);
      }
    } else {
      return;
    }
    camera.lookAt(controls.target);
  }, FRAME_PRIORITY.CAMERA);

  return null;
}

const UP = new Vector3(0, 1, 0);

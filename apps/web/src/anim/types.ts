/**
 * The animation timeline format (docs/animation/README.md, ADR-0006).
 *
 * A Timeline is plain data: what each actor does, what state each link is in, which threats are
 * active, and what text to show, all as a function of playback time. The interpreter
 * (compile.ts + evaluate.ts) turns it into a Frame for any time t, so play, pause, seek, scrub,
 * loop, and replay all fall out of one pure function.
 *
 * Two kinds of producer write Timelines:
 *   1. Hand-authored scripts in timelines/ (idle loops, presentation choreography).
 *   2. timelineFromSim() (fromSim.ts), which converts a sim run's event log + snapshots.
 * Either way the renderer only ever sees a Timeline, so nothing in the scene depends on where
 * the motion came from.
 *
 * Units: diorama units (the compressed OV-1 render space of scene/layout.ts), seconds, radians.
 * Never SI meters: map sim space into diorama space before building a Timeline.
 */
import type { LinkState } from "@ov1/catalog";
import type { Vec3 } from "../scene/layout";

export type { Vec3 };

/**
 * A location. Either raw diorama coordinates, or a catalog node's home position (NODE_LAYOUT)
 * plus an optional offset. Prefer the node form: it survives layout changes.
 */
export type Place = Vec3 | { node: string; offset?: Vec3 };

/** Easing for flyTo / path progress. `linear` keeps speed constant (right for aircraft). */
export type Ease = "linear" | "in" | "out" | "inOut";

/**
 * One step of an actor's motion. Segments play back-to-back: each starts where the previous one
 * ended, so a track never needs explicit start times. See docs/animation/authoring.md.
 */
export type MotionSegment =
  /** Stay put. `at` teleports first (use it only for initial placement). */
  | { kind: "hold"; durationS: number; at?: Place; headingRad?: number }
  /** Smooth curve from the current position and heading to `to`. */
  | {
      kind: "flyTo";
      durationS: number;
      to: Place;
      ease?: Ease;
      /** Heading on arrival. Default: the straight-line direction of travel. */
      arriveHeadingRad?: number;
    }
  /** Circle `center` at the center's altitude. Enters at the angle the actor is already at. */
  | {
      kind: "orbit";
      durationS: number;
      center: Place;
      radius: number;
      periodS: number;
      /** Seen from above. Default "ccw". */
      direction?: "ccw" | "cw";
      /** Override the entry angle (radians, 0 = +x, ccw toward -z). */
      startAngleRad?: number;
    }
  /** Smooth spline from the current position through every point, at constant speed. */
  | { kind: "path"; durationS: number; through: Place[]; ease?: Ease }
  /**
   * Time-stamped positions, linearly interpolated. This is what a sim adapter emits (one sample
   * per sim tick). tS is relative to the segment start and must strictly increase.
   */
  | { kind: "samples"; samples: readonly { tS: number; position: Vec3 }[] };

export interface ActorTrack {
  /** Position at t = 0. Default: the node's home position. */
  start?: Place;
  /** Heading at t = 0 when the first segment doesn't imply one. Default 0 (+x). */
  startHeadingRad?: number;
  segments: MotionSegment[];
}

/** Link state from tS onward (until the next key). Before the first key: the catalog default. */
export interface LinkKey {
  tS: number;
  state: LinkState;
}

/** Threat active/inactive from tS onward. Before the first key: inactive. */
export interface ThreatKey {
  tS: number;
  active: boolean;
}

/**
 * Node shown or hidden from tS onward (until the next key). Before the first key: shown.
 * Use it to keep an actor off the slide until it takes part, e.g. an adversary that only appears
 * when its attack is used.
 */
export interface VisibilityKey {
  tS: number;
  visible: boolean;
}

/**
 * Text cues. `caption` is a viewport annotation; `status` is a second line on a node's callout.
 * Without durationS a cue lasts until the end of the timeline.
 */
export type Cue =
  | { kind: "caption"; tS: number; durationS?: number; text: string }
  | { kind: "status"; tS: number; durationS?: number; node: string; text: string };

/**
 * One step of a written mission procedure (e.g. the refuel-op step breakdown). A step is active
 * from its tS until the next step's tS; the last one runs to the end. Shown in the Mission Steps
 * panel, which can seek to a step. Steps are narration, not behavior: they never move anything.
 */
export interface MissionStep {
  tS: number;
  /** Step number as written in the source procedure. */
  n: number;
  /** Short name, e.g. "Fuel Transfer". */
  title: string;
  /** One or two sentences from the procedure. */
  detail?: string;
  /** Parameters or systems that matter during this step (rows of the mission risk table). */
  watch?: readonly string[];
  /**
   * `"attack"`: an adversary action injected into the procedure (not part of the source doc).
   * Its `n` is the procedure step it follows. Rendered in hostile red. Default `"procedure"`.
   */
  kind?: "procedure" | "attack";
}

export interface Timeline {
  /** Unique, kebab-case, e.g. "idle" or "s1-jamming". */
  id: string;
  /** Shown in the playback panel. */
  label: string;
  /** The catalog scenario this animates, if any. */
  scenarioId?: string;
  durationS: number;
  /** Wrap at durationS. Looping timelines must end where they start (validate.ts checks). */
  loop: boolean;
  /** Keyed by catalog node ID. Nodes without a track sit at their home position. */
  actors?: Readonly<Record<string, ActorTrack>>;
  /** Keyed by catalog link ID. Keys sorted by tS. */
  links?: Readonly<Record<string, readonly LinkKey[]>>;
  /** Keyed by catalog threat ID. Keys sorted by tS. */
  threats?: Readonly<Record<string, readonly ThreatKey[]>>;
  /** Keyed by catalog node ID. Keys sorted by tS. Nodes without keys are always shown. */
  visibility?: Readonly<Record<string, readonly VisibilityKey[]>>;
  cues?: readonly Cue[];
  /** Mission procedure steps, sorted by tS with strictly increasing times. */
  steps?: readonly MissionStep[];
}

/** Where an actor is and which way it points. Angles follow the scene convention (README). */
export interface Pose {
  position: Vec3;
  /** Yaw about +y. 0 = nose along +x, positive turns the nose toward -z (left, seen from above). */
  headingRad: number;
  /** Nose up is positive. */
  pitchRad: number;
  /** Roll about the nose. Negative = left wing down (a left turn). */
  bankRad: number;
}

/** Everything the scene needs to draw one instant. Produced by evaluate(). */
export interface Frame {
  /** Timeline-local time after loop wrap / end clamp. */
  tS: number;
  /** Only nodes with a track. Everything else is at home: use livePosition() in space.ts. */
  actors: ReadonlyMap<string, Pose>;
  /** Only links with keys that have fired. Otherwise the catalog default: use linkStateOf(). */
  links: ReadonlyMap<string, LinkState>;
  activeThreats: ReadonlySet<string>;
  /** Nodes hidden at this instant (visibility channel). Everything else is drawn. */
  hidden: ReadonlySet<string>;
  /** Active captions, oldest first. */
  captions: readonly string[];
  /** Active status line per node (latest cue wins). */
  status: ReadonlyMap<string, string>;
  /** Index into the timeline's `steps` of the active step, or -1 (before the first / none). */
  stepIndex: number;
}

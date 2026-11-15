/**
 * Animation layer public API. Import from "../anim" rather than reaching into files.
 * Guide: docs/animation/README.md.
 */

export { type CompiledTimeline, compileTimeline } from "./compile";
export { evaluate, localTime, poseAt, positionAt } from "./evaluate";
export { type SimRunInput, type SimSample, timelineFromSim } from "./fromSim";
export { playback } from "./instance";
export {
  createPlayback,
  type DiscreteState,
  type Playback,
  type PlaybackSnapshot,
  RATES,
} from "./playback";
export { AnimationDriver, useActorTransform, usePlayback } from "./react";
export { linkIdsTouching, nodeIdOfKind, scenarioTargets } from "./roles";
export { homePosition, linkStateOf, livePosition, resolvePlace } from "./space";
export {
  availableTimelines,
  DEV_TIMELINES,
  IDLE_TIMELINE,
  MISSION_TIMELINES,
  SCENARIO_TIMELINES,
  timelineForScenario,
} from "./timelines/registry";
export type * from "./types";
export { validateTimeline } from "./validate";

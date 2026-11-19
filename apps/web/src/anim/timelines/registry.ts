/**
 * The timeline registry: the ONE place timelines are wired into the app.
 * Adding a scenario animation = write timelines/<scenario>.ts, then add one line to
 * SCENARIO_TIMELINES. registry.test.ts validates everything listed here.
 */
import type { Timeline } from "../types";
import { idleTimeline } from "./idle";
import { referenceTimeline } from "./reference";
import { refuelOpTimeline } from "./refuel-op";
import { s2Spoofing } from "./s2-spoofing";
import { s3FalseTelemetry } from "./s3-false-telemetry";
import { s4Malware } from "./s4-malware";

/** Plays on load and whenever no scenario animation is selected. */
export const IDLE_TIMELINE: Timeline = idleTimeline;

/**
 * Scenario animations, keyed by catalog scenario ID (the key must equal the timeline's
 * `scenarioId`). See docs/animation/authoring.md.
 */
export const SCENARIO_TIMELINES: Readonly<Record<string, Timeline>> = {
  [s2Spoofing.scenarioId as string]: s2Spoofing,
  [s3FalseTelemetry.scenarioId as string]: s3FalseTelemetry,
  [s4Malware.scenarioId as string]: s4Malware,
};

/**
 * Baseline mission profiles (no threats): the written procedure the scenarios attack. Listed in
 * the timeline picker and the Mission Steps panel. Not keyed by scenario ID.
 */
export const MISSION_TIMELINES: readonly Timeline[] = [refuelOpTimeline];

/** Shown in the timeline picker in dev builds only. */
export const DEV_TIMELINES: readonly Timeline[] = [referenceTimeline];

export function timelineForScenario(scenarioId: string): Timeline | undefined {
  return SCENARIO_TIMELINES[scenarioId];
}

/** Every timeline the picker may offer, idle first. */
export function availableTimelines(includeDev: boolean): Timeline[] {
  return [
    IDLE_TIMELINE,
    ...MISSION_TIMELINES,
    ...Object.values(SCENARIO_TIMELINES),
    ...(includeDev ? DEV_TIMELINES : []),
  ];
}

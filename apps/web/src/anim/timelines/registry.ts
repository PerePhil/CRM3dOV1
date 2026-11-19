/**
 * The timeline registry: the ONE place timelines are wired into the app.
 * Adding a scenario animation = write timelines/<scenario>.ts, then add one line to
 * SCENARIO_TIMELINES. registry.test.ts validates everything listed here.
 */
import type { Timeline } from "../types";
import { idleTimeline } from "./idle";
import { referenceTimeline } from "./reference";
import { refuelOpTimeline } from "./refuel-op";
import { gpsSpoofingStoryboard } from "./s1-gps-spoofing";
import { falseTelemetryStoryboard } from "./s2-false-telemetry";
import { malwareStoryboard } from "./s2-malware";

/** Plays on load and whenever no scenario animation is selected. */
export const IDLE_TIMELINE: Timeline = idleTimeline;

/**
 * Scenario animations, keyed by catalog scenario ID (every timeline's `scenarioId` must equal
 * its key). A scenario with several threats can have several animations, each with a distinct
 * `variant`; the first one plays when the scenario is clicked. See docs/animation/authoring.md.
 *
 * This is the ONLY place a scenario ID is written out (AGENTS.md §6.1): each scenario timeline is
 * a builder that receives its scenario ID from here.
 */
const byScenario = (
  scenarioId: string,
  builders: readonly ((scenarioId: string) => Timeline)[],
): readonly Timeline[] => builders.map((build) => build(scenarioId));

export const SCENARIO_TIMELINES: Readonly<Record<string, readonly Timeline[]>> = {
  S1: byScenario("S1", [gpsSpoofingStoryboard]),
  S2: byScenario("S2", [falseTelemetryStoryboard, malwareStoryboard]),
};

/**
 * Baseline mission profiles (no threats): the written procedure the scenarios attack. Listed in
 * the timeline picker and the Mission Steps panel. Not keyed by scenario ID.
 */
export const MISSION_TIMELINES: readonly Timeline[] = [refuelOpTimeline];

/** Shown in the timeline picker in dev builds only. */
export const DEV_TIMELINES: readonly Timeline[] = [referenceTimeline];

/** Every animation of a scenario (empty if none is authored yet). */
export function timelinesForScenario(scenarioId: string): readonly Timeline[] {
  return SCENARIO_TIMELINES[scenarioId] ?? [];
}

/** The animation that plays when the scenario is clicked. */
export function timelineForScenario(scenarioId: string): Timeline | undefined {
  return timelinesForScenario(scenarioId)[0];
}

/** Every timeline the picker may offer, idle first. */
export function availableTimelines(includeDev: boolean): Timeline[] {
  return [
    IDLE_TIMELINE,
    ...MISSION_TIMELINES,
    ...Object.values(SCENARIO_TIMELINES).flat(),
    ...(includeDev ? DEV_TIMELINES : []),
  ];
}

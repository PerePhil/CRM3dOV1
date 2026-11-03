/**
 * The timeline registry: the ONE place timelines are wired into the app.
 * Adding a scenario animation = write timelines/<scenario>.ts, then add one line to
 * SCENARIO_TIMELINES. registry.test.ts validates everything listed here.
 */
import type { Timeline } from "../types";
import { idleTimeline } from "./idle";
import { referenceTimeline } from "./reference";

/** Plays on load and whenever no scenario animation is selected. */
export const IDLE_TIMELINE: Timeline = idleTimeline;

/**
 * Scenario animations, keyed by catalog scenario ID (the key must equal the timeline's
 * `scenarioId`). Empty until scenario tasks land; see docs/animation/authoring.md.
 */
export const SCENARIO_TIMELINES: Readonly<Record<string, Timeline>> = {};

/** Shown in the timeline picker in dev builds only. */
export const DEV_TIMELINES: readonly Timeline[] = [referenceTimeline];

export function timelineForScenario(scenarioId: string): Timeline | undefined {
  return SCENARIO_TIMELINES[scenarioId];
}

/** Every timeline the picker may offer, idle first. */
export function availableTimelines(includeDev: boolean): Timeline[] {
  return [
    IDLE_TIMELINE,
    ...Object.values(SCENARIO_TIMELINES),
    ...(includeDev ? DEV_TIMELINES : []),
  ];
}

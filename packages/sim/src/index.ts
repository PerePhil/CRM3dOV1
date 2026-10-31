/**
 * @ov1/sim: deterministic fixed-timestep simulation (SPEC §3.2, §6.1–6.3).
 * Skeleton only. Link, nav, and lost-link models arrive via backlog tasks.
 */
export * from "./events";
export { createEventLog, type EventLog } from "./log";

/** Default fixed simulation rate (SPEC §3.2). The renderer interpolates between ticks. */
export const DEFAULT_TICK_HZ = 20;

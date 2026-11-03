/**
 * The app's one playback controller. Module-level so it's reachable from React, from the R3F
 * frame loop, and later from the zustand app store and the sim worker bridge.
 */
import { createPlayback } from "./playback";
import { IDLE_TIMELINE } from "./timelines/registry";

const reducedMotion =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Starts on the idle timeline. Respects prefers-reduced-motion by starting paused. */
export const playback = createPlayback(IDLE_TIMELINE, { autoplay: !reducedMotion });

import { useMemo } from "react";
import { type Focus, playback, timelineFocus, usePlayback } from "../anim";
import { useView } from "../view/viewStore";

/** Opacity for scene labels and lines outside the playing scenario's focus set. */
export const DIM_LABEL_OPACITY = 0.3;
export const DIM_LINE_OPACITY = 0.22;
export const DIM_SOLID_OPACITY = 0.4;

/** The playing timeline's focus set, or null when everything is in focus (or dimming is off). */
export function useFocus(): Focus | null {
  const timelineId = usePlayback((s) => s.timelineId);
  const enabled = useView((s) => s.focusDim);
  // biome-ignore lint/correctness/useExhaustiveDependencies: recompute when the timeline changes.
  return useMemo(() => (enabled ? timelineFocus(playback.timeline) : null), [timelineId, enabled]);
}

/**
 * Default timeline (the proof of concept): the UAV flies a holding orbit around its OV-1 slot,
 * awaiting tasking. Loops seamlessly because the run is exactly one orbit period.
 */
import { nodeIdOfKind } from "../roles";
import type { Timeline } from "../types";

const UAV = nodeIdOfKind("uav");
const RADIUS = 2.4;
const PERIOD_S = 28;

export const idleTimeline: Timeline = {
  id: "idle",
  label: "IDLE · Holding pattern",
  durationS: PERIOD_S,
  loop: true,
  actors: {
    [UAV]: {
      // Start on the circle (angle 0 = +x of the slot) so the orbit has no entry jump.
      start: { node: UAV, offset: [RADIUS, 0, 0] },
      segments: [
        {
          kind: "orbit",
          durationS: PERIOD_S,
          center: { node: UAV },
          radius: RADIUS,
          periodS: PERIOD_S,
        },
      ],
    },
  },
  cues: [{ kind: "status", tS: 0, node: UAV, text: "LOITER · AWAITING TASKING" }],
};

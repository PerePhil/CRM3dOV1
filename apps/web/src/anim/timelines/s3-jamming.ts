/**
 * S3 · C2 link jamming / outage, on the refuel op (storyboard).
 *
 * Mission analysis doc, FAIR Scenario 3 and the "C2 Connection" parameter (mapped to step 8,
 * Launch and Initial Flight). A hostile jammer raises J/S on the tanker's C2 receivers just as the
 * catapult fires. Both command uplinks (LOS and SATCOM) are denied, so the tanker drops into its
 * lost-link mode before climb-out is established and never reaches climb speed. The telemetry
 * downlink isn't jammed: the GCS watches it sink but has no uplink to command a climb or
 * wave-off. It settles off the bow into the ocean.
 */
import { nodeIdOfKind, scenarioTargets } from "../roles";
import type { Timeline, Vec3 } from "../types";
import { linksLostWith, refuelAttackTimeline } from "./refuel-attack";
import { REFUEL_OP } from "./refuel-op";

const TANKER = REFUEL_OP.tanker.id;
const JAMMER = nodeIdOfKind("adversary-jammer");
const GCS = nodeIdOfKind("gcs");

const { T } = REFUEL_OP;
const { DECK_SPOT, DECK_Y, LANE_Z } = REFUEL_OP.geometry;
const at = (dx: number, y: number, dz = 0): Vec3 => [DECK_SPOT[0] + dx, y, LANE_Z + dz];

/**
 * Step 8 starts on time. The jammer comes up as the catapult fires (just after the step starts,
 * since step times must strictly increase), so the C2 uplinks are already denied for the whole
 * stroke and the failed launch follows its cause.
 */
const LAUNCH = T.launch;
const JAM = LAUNCH + 0.2;
const OFF_BOW = LAUNCH + 1.6;
const SETTLE = OFF_BOW + 2.4;
const DITCH = SETTLE + 1;
const END = DITCH + 8;

/**
 * Built by the registry, which passes the catalog scenario ID: the registry key is the only
 * scenario-ID literal (AGENTS.md §6.1).
 */
export function jammingStoryboard(scenarioId: string): Timeline {
  const { links: jammed } = scenarioTargets(scenarioId);
  const lostAtDitch = linksLostWith(TANKER).filter((id) => !jammed.includes(id));
  return refuelAttackTimeline({
    id: "s3-jamming",
    scenarioId,
    divergeAtS: LAUNCH,
    attackAtS: JAM,
    attack: {
      title: "C2 Link Jamming",
      detail:
        "A hostile jammer denies the LOS and SATCOM command uplinks during the catapult stroke. The tanker drops into lost-link mode before climb-out is established, and the GCS can see it sinking but has no uplink to command a climb or wave-off.",
      watch: ["C2 Connection", "Network Latency", "Flight Control Health"],
    },
    durationS: END,
    tanker: [
      // Catapult stroke as C2 drops: leaves the bow without reaching climb speed.
      { kind: "flyTo", durationS: OFF_BOW - LAUNCH, to: at(1.6, DECK_Y - 0.05), ease: "in" },
      // Lost-link mode holds launch attitude; nobody can command the climb.
      {
        kind: "path",
        durationS: SETTLE - OFF_BOW,
        through: [at(3.2, DECK_Y - 0.4, -0.1), at(4.4, 0.25, -0.2)],
      },
      { kind: "flyTo", durationS: DITCH - SETTLE, to: at(5, -0.1, -0.25) },
      { kind: "hold", durationS: END - DITCH },
    ],
    reveal: [JAMMER],
    links: [
      ...jammed.map((link) => ({ link, tS: JAM, state: "denied" as const })),
      ...lostAtDitch.map((link) => ({ link, tS: DITCH, state: "denied" as const })),
    ],
    cues: [
      {
        kind: "caption",
        tS: JAM,
        durationS: DITCH - JAM,
        text: "Jammer denies LOS + SATCOM C2 at the catapult stroke",
      },
      {
        kind: "caption",
        tS: OFF_BOW,
        durationS: DITCH - OFF_BOW,
        text: "Lost-link in climb-out · GCS has no uplink to recover",
      },
      { kind: "caption", tS: DITCH, text: "Settled off the bow · airframe and sortie lost" },
      { kind: "status", tS: JAM, node: JAMMER, text: "RADIATING · C2 UPLINK BANDS" },
      {
        kind: "status",
        tS: JAM,
        durationS: DITCH - JAM,
        node: GCS,
        text: "C2 UPLINK DENIED · CANNOT COMMAND",
      },
      { kind: "status", tS: DITCH, node: GCS, text: "TLM LOST · AIRCRAFT DOWN" },
      {
        kind: "status",
        tS: OFF_BOW,
        durationS: DITCH - OFF_BOW,
        node: TANKER,
        text: "LOST-LINK · BELOW CLIMB SPEED",
      },
      { kind: "status", tS: DITCH, node: TANKER, text: "DITCHED · AIRFRAME LOST" },
    ],
  });
}

/** Exported for tests. */
export const S3_TIMES = { LAUNCH, JAM, OFF_BOW, DITCH, END } as const;

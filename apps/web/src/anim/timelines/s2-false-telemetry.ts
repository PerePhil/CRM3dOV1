/**
 * S2 · Supply-chain malware / false data injection: the false-telemetry variant, on the refuel op
 * (storyboard).
 *
 * Mission analysis doc, FAIR Scenario 2: "flight-control or telemetry data poisoning → loss of
 * control, crash". The threat diagram routes data poisoning into the cloud and mission data
 * sources, which feed operational data to the ground system. Here poisoned launch parameters
 * travel that path into the tanker. At launch (step 8, where the doc maps Data Integrity and
 * Packet Integrity) the catapult stroke leaves it short of flying speed, but its air data and the
 * GCS telemetry read nominal, so nobody aborts. It settles off the bow into the ocean.
 */
import { getScenario } from "@ov1/catalog";
import { nodeIdOfKind } from "../roles";
import type { Vec3 } from "../types";
import { linksLostWith, refuelAttackTimeline, scenarioThreatByLinkState } from "./refuel-attack";
import { REFUEL_OP } from "./refuel-op";

const scenario = getScenario("S2");
const threat = scenarioThreatByLinkState(scenario.id, "injected");
const TANKER = REFUEL_OP.tanker.id;
const CYBER = nodeIdOfKind("adversary-cyber");
const GCS = nodeIdOfKind("gcs");
const DATA_STORE = nodeIdOfKind("c2");

const { T } = REFUEL_OP;
const { DECK_SPOT, DECK_Y, LANE_Z } = REFUEL_OP.geometry;
const at = (dx: number, y: number, dz = 0): Vec3 => [DECK_SPOT[0] + dx, y, LANE_Z + dz];

/** Step 8 starts on time; the attack step comes as the tanker leaves the bow, under-speed. */
const LAUNCH = T.launch;
const OFF_BOW = LAUNCH + 1.6;
const SETTLE = OFF_BOW + 2.4;
const DITCH = SETTLE + 1;
const END = DITCH + 8;

export const s2FalseTelemetry = refuelAttackTimeline({
  id: "s2-false-telemetry",
  scenarioId: scenario.id,
  variant: "False telemetry",
  threats: [threat.id],
  divergeAtS: LAUNCH,
  attackAtS: OFF_BOW,
  attack: {
    title: "False Telemetry / Data Injection",
    detail:
      "Poisoned launch parameters from the mission data store reached the ground system and were loaded into the tanker. It leaves the bow below flying speed while its air data and telemetry read nominal, so no abort is called.",
    watch: ["Data Integrity", "Packet Integrity", "Flight Control Health"],
  },
  durationS: END,
  tanker: [
    // Catapult stroke on poisoned parameters: leaves the bow below flying speed.
    { kind: "flyTo", durationS: OFF_BOW - LAUNCH, to: at(1.6, DECK_Y - 0.05), ease: "in" },
    // Settles toward the water, wings level, air data still reading good.
    {
      kind: "path",
      durationS: SETTLE - OFF_BOW,
      through: [at(3.2, DECK_Y - 0.4, -0.1), at(4.4, 0.25, -0.2)],
    },
    { kind: "flyTo", durationS: DITCH - SETTLE, to: at(5, -0.1, -0.25) },
    { kind: "hold", durationS: END - DITCH },
  ],
  reveal: [CYBER],
  links: [
    ...threat.links.map((link) => ({ link, tS: OFF_BOW, state: "injected" as const })),
    ...linksLostWith(TANKER).map((link) => ({ link, tS: DITCH, state: "denied" as const })),
  ],
  cues: [
    {
      kind: "caption",
      tS: OFF_BOW,
      durationS: DITCH - OFF_BOW,
      text: "Poisoned launch data · air data reads flying speed",
    },
    {
      kind: "caption",
      tS: OFF_BOW + 1,
      durationS: DITCH - OFF_BOW - 1,
      text: "GCS telemetry nominal · no abort called",
    },
    { kind: "caption", tS: DITCH, text: "Settled off the bow · airframe lost" },
    { kind: "status", tS: OFF_BOW, node: CYBER, text: "POISONING · MISSION DATA" },
    { kind: "status", tS: OFF_BOW, node: DATA_STORE, text: "MISSION DATA · POISONED" },
    {
      kind: "status",
      tS: OFF_BOW,
      durationS: DITCH - OFF_BOW,
      node: GCS,
      text: "TLM: AIRSPEED OK (FALSE)",
    },
    { kind: "status", tS: DITCH, node: GCS, text: "TLM LOST · AIRCRAFT DOWN" },
    {
      kind: "status",
      tS: OFF_BOW,
      durationS: DITCH - OFF_BOW,
      node: TANKER,
      text: "AIR DATA: FLYING SPEED (FALSE)",
    },
    { kind: "status", tS: DITCH, node: TANKER, text: "DITCHED · AIRFRAME LOST" },
  ],
});

/** Exported for tests. */
export const S2_FDI_TIMES = { LAUNCH, OFF_BOW, DITCH, END } as const;

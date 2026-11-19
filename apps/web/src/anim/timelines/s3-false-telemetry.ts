/**
 * S3 · False telemetry injection on the refuel op (storyboard).
 *
 * Just before launch the adversary cyber operator forges the tanker's gross-weight and air-data
 * telemetry. The GCS and launch crew see nominal values, so the catapult is set for a lighter
 * aircraft: a cold cat shot. The tanker leaves the bow below flying speed while its air data
 * still reads good, settles, and goes into the water.
 */
import { getScenario } from "@ov1/catalog";
import { nodeIdOfKind, scenarioTargets } from "../roles";
import type { Vec3 } from "../types";
import { linksLostWith, refuelAttackTimeline } from "./refuel-attack";
import { REFUEL_OP } from "./refuel-op";

const scenario = getScenario("S3");
const { links: targetLinks } = scenarioTargets(scenario);
const TANKER = REFUEL_OP.tanker.id;
const CYBER = nodeIdOfKind("adversary-cyber");
const GCS = nodeIdOfKind("gcs");

const { T } = REFUEL_OP;
const { DECK_SPOT, DECK_Y, LANE_Z } = REFUEL_OP.geometry;
const at = (dx: number, y: number, dz = 0): Vec3 => [DECK_SPOT[0] + dx, y, LANE_Z + dz];

/** Attack step between step 7 (deck prep) and step 8 (launch). */
const INJECT = T.launch;
const LAUNCH = INJECT + 6;
const OFF_BOW = LAUNCH + 1.6;
const SETTLE = OFF_BOW + 2.4;
const DITCH = SETTLE + 1;
const END = DITCH + 7;

export const s3FalseTelemetry = refuelAttackTimeline({
  id: "s3-false-telemetry",
  scenarioId: scenario.id,
  attackAtS: INJECT,
  attack: {
    title: "False Telemetry Injection",
    detail:
      "Adversary forges the tanker's gross-weight and air-data telemetry. The GCS and launch crew see nominal values, so the catapult is set for a lighter aircraft.",
    watch: ["Data Integrity", "Packet Integrity", "Aircraft Fuel State"],
  },
  after: [{ n: 8, tS: LAUNCH }],
  durationS: END,
  tanker: [
    { kind: "hold", durationS: LAUNCH - INJECT, headingRad: 0 },
    // Catapult stroke: underpowered, leaves the bow below flying speed.
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
    ...targetLinks.map((link) => ({ link, tS: INJECT, state: "injected" as const })),
    ...linksLostWith(TANKER).map((link) => ({ link, tS: DITCH, state: "denied" as const })),
  ],
  cues: [
    {
      kind: "caption",
      tS: INJECT,
      durationS: 6,
      text: "Forged TLM: gross weight and air data read nominal",
    },
    {
      kind: "caption",
      tS: LAUNCH,
      durationS: DITCH - LAUNCH,
      text: "Cold cat shot · end speed below flying speed",
    },
    { kind: "caption", tS: DITCH, text: "Ditched off the bow · airframe lost" },
    { kind: "status", tS: INJECT, node: CYBER, text: "INJECTING · TLM DOWNLINK" },
    {
      kind: "status",
      tS: INJECT,
      durationS: DITCH - INJECT,
      node: GCS,
      text: "TLM: NOMINAL (FORGED)",
    },
    { kind: "status", tS: DITCH, node: GCS, text: "TLM LOST · AIRCRAFT DOWN" },
    {
      kind: "status",
      tS: INJECT,
      durationS: LAUNCH - INJECT,
      node: TANKER,
      text: "ON DECK · CAT SET (FORGED WT)",
    },
    {
      kind: "status",
      tS: LAUNCH,
      durationS: DITCH - LAUNCH,
      node: TANKER,
      text: "LAUNCH · AIRSPEED OK (FALSE)",
    },
    { kind: "status", tS: DITCH, node: TANKER, text: "DITCHED · AIRFRAME LOST" },
  ],
});

/** Exported for tests. */
export const S3_TIMES = { INJECT, LAUNCH, OFF_BOW, DITCH, END } as const;

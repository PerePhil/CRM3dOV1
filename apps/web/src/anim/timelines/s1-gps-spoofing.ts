/**
 * S1 · GPS spoofing → navigation integrity failure, on the refuel op (storyboard).
 *
 * Mission analysis doc, FAIR Scenario 1 (mission steps 4, 8, 9, 10, 16): "In contested airspace a
 * nation-state actor spoofs GNSS → UAV deviates from course → mission abort or possible
 * loss/capture of the aircraft." This storyboard shows the capture branch.
 *
 * The fuel transfer completes normally. As the tanker finishes on station, a hostile spoofer
 * captures its GNSS receiver and walks the position fix west of truth, so the carrier appears to
 * lie east. The tanker flies its "recovery" toward the hostile shore and lands there.
 */
import { getScenario } from "@ov1/catalog";
import { nodeIdOfKind, scenarioTargets } from "../roles";
import type { Vec3 } from "../types";
import { refuelAttackTimeline } from "./refuel-attack";
import { REFUEL_OP } from "./refuel-op";

const scenario = getScenario("S1");
const { links: targetLinks } = scenarioTargets(scenario);
const TANKER = REFUEL_OP.tanker.id;
const SPOOFER = nodeIdOfKind("adversary-spoofer");

const { T } = REFUEL_OP;
const { ANCHOR, ANCHOR_R, ANCHOR_PERIOD_S } = REFUEL_OP.geometry;

/** Attack step between step 15 (separation) and step 16 (return and recovery), a doc-mapped GNSS step. */
const SPOOF = T.recovery;
const RTB = SPOOF + 8;
const FINAL = RTB + 12;
const TOUCHDOWN = FINAL + 3;
const STOPPED = TOUCHDOWN + 3;
const END = STOPPED + 8;

// The hostile shore (SCENERY.hostileLand), well clear of the adversary sites.
const GROUND_Y = 0.3;
const ON_FINAL: Vec3 = [10.5, 1.2, -5.5];
const TOUCHDOWN_AT: Vec3 = [12.5, GROUND_Y, -5.5];
const ROLLOUT_AT: Vec3 = [15, GROUND_Y, -5.5];

export const s1GpsSpoofing = refuelAttackTimeline({
  id: "s1-gps-spoofing",
  scenarioId: scenario.id,
  attackAtS: SPOOF,
  attack: {
    title: "GNSS Spoofing",
    detail:
      "A hostile spoofer captures the tanker's GNSS receiver and walks the position fix west of truth, below detector thresholds. The carrier now appears to lie east, over the hostile shore.",
    watch: ["GNSS Connection", "Navigation Integrity"],
  },
  after: [{ n: 16, tS: RTB }],
  durationS: END,
  tanker: [
    // Still on the anchor while the spoofer captures and drags the fix.
    {
      kind: "orbit",
      durationS: RTB - SPOOF,
      center: ANCHOR,
      radius: ANCHOR_R,
      periodS: ANCHOR_PERIOD_S,
    },
    // "Recovery" toward where the spoofed fix puts the carrier: east, over the hostile shore.
    { kind: "flyTo", durationS: FINAL - RTB, to: ON_FINAL, arriveHeadingRad: 0 },
    { kind: "flyTo", durationS: TOUCHDOWN - FINAL, to: TOUCHDOWN_AT, arriveHeadingRad: 0 },
    { kind: "flyTo", durationS: STOPPED - TOUCHDOWN, to: ROLLOUT_AT, ease: "out" },
    { kind: "hold", durationS: END - STOPPED, headingRad: 0 },
  ],
  reveal: [SPOOFER],
  links: targetLinks.map((link) => ({ link, tS: SPOOF, state: "spoofed" as const })),
  cues: [
    {
      kind: "caption",
      tS: SPOOF,
      durationS: RTB - SPOOF,
      text: "Spoofer captures GNSS · fix walked off truth",
    },
    {
      kind: "caption",
      tS: RTB,
      durationS: FINAL - RTB,
      text: "Nav shows carrier approach · true track is east",
    },
    {
      kind: "caption",
      tS: STOPPED,
      text: "Landed in hostile territory · airframe and data exposed",
    },
    { kind: "status", tS: SPOOF, node: SPOOFER, text: "RADIATING · COUNTERFEIT GNSS" },
    {
      kind: "status",
      tS: SPOOF,
      durationS: RTB - SPOOF,
      node: TANKER,
      text: "ON STATION · GNSS FIX (SPOOFED)",
    },
    {
      kind: "status",
      tS: RTB,
      durationS: FINAL - RTB,
      node: TANKER,
      text: "RTB · NAV ON COURSE (FALSE)",
    },
    {
      kind: "status",
      tS: FINAL,
      durationS: STOPPED - FINAL,
      node: TANKER,
      text: "FINAL · “CARRIER” (FALSE)",
    },
    { kind: "status", tS: STOPPED, node: TANKER, text: "LANDED · HOSTILE TERRITORY" },
  ],
});

/** Exported for tests. */
export const S1_TIMES = { SPOOF, RTB, TOUCHDOWN, STOPPED, END } as const;

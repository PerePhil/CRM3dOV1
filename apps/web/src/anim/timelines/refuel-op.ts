/**
 * Refuel op: the team's baseline mission (no attack). An MQ-25-class tanker launches from the
 * carrier, transits to a tanker anchor in contested airspace, identifies and joins with a
 * receiver, transfers fuel, separates, and recovers to the carrier.
 *
 * Source: the team's mission analysis doc ("Mission Step Breakdown", steps 1–18, and the
 * "Parameters, risks, requirements, failsafe goals" table). Steps are copied in `STEPS` and the
 * table's "Effected Activities" column becomes each step's `watch` list.
 *
 * This is hand-authored choreography of the NOMINAL mission. It makes no claim about behavior
 * under attack (README Rule 1); S1–S6 timelines will overlay threats on this profile, and the
 * sim decides what the aircraft does then. Labeled (storyboard) until the sim drives it.
 */
import { catalog } from "@ov1/catalog";
import { SCENERY } from "../../scene/layout";
import { nodeIdOfKind } from "../roles";
import { resolvePlace } from "../space";
import type { Cue, MissionStep, Timeline, Vec3 } from "../types";

const TANKER = nodeIdOfKind("uav");
const RECEIVER = nodeIdOfKind("receiver");

// Derive the coordination link from the catalog relationship, not its ID (AGENTS.md §4.5).
const rcvrLink = catalog.links.find(
  (l) => (l.from === TANKER && l.to === RECEIVER) || (l.from === RECEIVER && l.to === TANKER),
);
if (!rcvrLink) throw new Error("refuel-op timeline: no catalog link between tanker and receiver");

// ---------------------------------------------------------------------------------------------
// Procedure (source doc, steps 1–18) and the parameter table.
// ---------------------------------------------------------------------------------------------

/** "Parameters, risks, requirements, failsafe goals": parameter → affected step numbers. */
const PARAMETERS: readonly (readonly [string, readonly number[]])[] = [
  ["C2 Connection", [3, 7, 8, 9, 10, 16, 18]],
  ["Network Latency", [3, 7, 8, 9, 10, 11, 12, 16]],
  ["Packet Integrity", [3, 8, 9, 10, 11, 12, 15, 16, 18]],
  ["Command Authentication", [1, 3, 7, 9, 16]],
  ["GNSS Connection", [4, 8, 9, 10, 16]],
  ["Navigation Integrity", [4, 8, 9, 10, 12, 13, 14, 15, 16]],
  ["Flight Control Health", [5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]],
  ["Aircraft Identification", [10, 11, 12, 13, 14]],
  ["Receiver Communication", [11, 12, 13, 14, 15]],
  ["Refueling Mechanism", [6, 13, 14, 15, 17]],
  ["Aircraft Fuel State", [2, 5, 6, 8, 9, 13, 14, 15, 16, 17]],
  ["Carrier Recovery Interface", [16]],
  ["Software/Firmware Integrity", [2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18]],
  ["Data Integrity", [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18]],
];

const watchFor = (n: number): string[] =>
  PARAMETERS.filter(([, steps]) => steps.includes(n)).map(([name]) => name);

/** Step start times (s). Deck steps are short; the flight is paced so formation reads clearly. */
const T = {
  initiation: 0,
  planning: 4,
  c2Init: 8,
  navInit: 12,
  preflight: 16,
  refuelPrep: 20,
  deckPrep: 24,
  launch: 28,
  transit: 36,
  areaEntry: 46,
  rcvrId: 54,
  rcvrCoord: 60,
  xferPrep: 68,
  xfer: 74,
  separation: 86,
  recovery: 92,
  postflight: 122,
  debrief: 128,
  end: 134,
} as const;

const PROCEDURE: readonly (readonly [number, string, string])[] = [
  [
    T.initiation,
    "Mission Initiation",
    "Receive refueling request, establish mission authority, identify intended receiver aircraft, document mission objectives.",
  ],
  [
    T.planning,
    "Mission Planning",
    "Establish mission plan, environmental constraints, airspace coordination requirements, and safe termination conditions.",
  ],
  [
    T.c2Init,
    "C2 and Data Initialization",
    "Initialize mission control interface, establish authenticated communications, verify command authority, synchronize system clocks.",
  ],
  [
    T.navInit,
    "Navigation Initialization",
    "Initialize navigation sensors, assess GPS/GNSS and inertial navigation health, check positioning integrity.",
  ],
  [
    T.preflight,
    "Aircraft Preflight Diagnostics",
    "Verify propulsion, flight controls, electrical power, sensors, onboard computing, and fault monitoring.",
  ],
  [
    T.refuelPrep,
    "Refueling System Preparation",
    "Inspect aerial refueling store, hose/drogue mechanism, fuel quantity and quality monitoring, and transfer-system health.",
  ],
  [
    T.deckPrep,
    "Carrier Deck Preparation",
    "Verify deck handling, aircraft configuration, launch authorization, carrier coordination, and personnel safety.",
  ],
  [
    T.launch,
    "Launch and Initial Flight",
    "Complete launch, verify flight-control response, propulsion status, navigation consistency, and telemetry.",
  ],
  [
    T.transit,
    "Transit to Assigned Area",
    "Track aircraft health, monitor navigation integrity, receive authorized mission updates, assess airspace conditions.",
  ],
  [
    T.areaEntry,
    "Area Entry and Situational Awareness",
    "Monitor relevant air traffic information, report unknown or inconsistent signatures, evaluate operating constraints.",
  ],
  [
    T.rcvrId,
    "Receiver Identification",
    "Correlate receiver identification, validate mission authorization, and confirm receiver suitability.",
  ],
  [
    T.rcvrCoord,
    "Receiver Coordination",
    "Establish coordination with intended receiver, exchange readiness information, verify compatible refueling configuration.",
  ],
  [
    T.xferPrep,
    "Refueling Preparation",
    "Verify system readiness, fuel availability, refueling-store deployment status, and safety interlocks.",
  ],
  [
    T.xfer,
    "Fuel Transfer",
    "Monitor transfer initiation, fuel flow, delivered quantity, fuel-system health, and aircraft stability.",
  ],
  [
    T.separation,
    "Transfer Completion and Separation",
    "Confirm transfer termination, reconcile fuel quantities, verify safe disconnection, and secure refueling equipment.",
  ],
  [
    T.recovery,
    "Return and Carrier Recovery",
    "Reconcile remaining fuel, verify recovery capability, monitor carrier/deck status, and complete landing.",
  ],
  [
    T.postflight,
    "Postflight Servicing",
    "Secure aircraft, conduct inspection, assess fuel and equipment condition, capture maintenance discrepancies.",
  ],
  [
    T.debrief,
    "Debrief",
    "Reconcile mission events, review faults, preserve logs, close authorized communication sessions, and return to controlled ground state.",
  ],
];

const STEPS: MissionStep[] = PROCEDURE.map(([tS, title, detail], i) => ({
  tS,
  n: i + 1,
  title,
  detail,
  watch: watchFor(i + 1),
}));

// ---------------------------------------------------------------------------------------------
// Geometry (diorama units). Computed once at load; the Timeline below is still plain data.
// ---------------------------------------------------------------------------------------------

const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
/** Point on a circle, scene convention: angle 0 = +x, ccw (seen from above) toward −z. */
const onCircle = (c: Vec3, r: number, a: number): Vec3 => [
  c[0] + r * Math.cos(a),
  c[1],
  c[2] - r * Math.sin(a),
];
const CCW_TANGENT = Math.PI / 2;

// Carrier deck: launch and landing on the same lane, near the bow, clear of GCS / MX.
const { carrier } = SCENERY;
const DECK_Y = carrier.position[1] + carrier.size[1] / 2 + 0.2;
const LANE_Z = carrier.position[2] - 0.8;
const DECK_SPOT: Vec3 = [carrier.position[0] + carrier.size[0] / 2 - 0.5, DECK_Y, LANE_Z];
const STERN_X = carrier.position[0] - carrier.size[0] / 2;

// Tanker anchor: a racetrack-style orbit east of the UAV's OV-1 slot, toward the threat axis.
const ANCHOR: Vec3 = resolvePlace({ node: TANKER, offset: [4.5, 0.5, -1] });
const ANCHOR_R = 2.2;
const ANCHOR_PERIOD_S = 18;
/** Enter on the south side heading +x: tangent to a ccw orbit at angle 3π/2. */
const ANCHOR_ENTRY_ANGLE = (3 * Math.PI) / 2;
const tankerAngle = (tS: number) =>
  ANCHOR_ENTRY_ANGLE + (2 * Math.PI * (tS - T.areaEntry)) / ANCHOR_PERIOD_S;

// Receiver: same circle, slightly below the tanker, lagging behind (astern) by an angle.
const RCVR_ORBIT_CENTER: Vec3 = add3(ANCHOR, [0, -0.5, 0]);
const PRECONTACT_LAG = Math.PI / 3; // ~2.3u astern while coordinating
const CONTACT_LAG = (25 * Math.PI) / 180; // ~1u astern on the drogue
const rcvrPrecontactAngle = tankerAngle(T.xferPrep) - PRECONTACT_LAG;
/** Closing from pre-contact to contact during refueling prep: a slightly faster orbit. */
const closeSweep = tankerAngle(T.xfer) - CONTACT_LAG - rcvrPrecontactAngle;
const CLOSE_PERIOD_S = (2 * Math.PI * (T.xfer - T.xferPrep)) / closeSweep;

// Receiver's combat air patrol over the hostile shore before and after the join.
const CAP_CENTER: Vec3 = resolvePlace({ node: RECEIVER });
const CAP_R = 1.6;
const CAP_PERIOD_S = 12;

// ---------------------------------------------------------------------------------------------
// Cues
// ---------------------------------------------------------------------------------------------

const tankerStatus: [number, string][] = [
  [T.initiation, "ON DECK · MISSION INITIATION"],
  [T.planning, "ON DECK · MISSION PLANNING"],
  [T.c2Init, "ON DECK · C2 INIT"],
  [T.navInit, "ON DECK · NAV INIT"],
  [T.preflight, "ON DECK · PREFLIGHT"],
  [T.refuelPrep, "ON DECK · REFUEL STORE CHECK"],
  [T.deckPrep, "ON DECK · LAUNCH AUTH"],
  [T.launch, "LAUNCH"],
  [T.transit, "TRANSIT"],
  [T.areaEntry, "ON STATION · ANCHOR"],
  [T.rcvrId, "RCVR ID · CORRELATING"],
  [T.rcvrCoord, "RCVR COORD · PRE-CONTACT"],
  [T.xferPrep, "DROGUE OUT · INTERLOCKS"],
  [T.xfer, "CONTACT · FUEL XFER"],
  [T.separation, "DISCONNECT · STOW"],
  [T.recovery, "RTB · RECOVERY"],
  [T.postflight, "RECOVERED · POSTFLIGHT"],
  [T.debrief, "DEBRIEF · LOGS PRESERVED"],
];

const receiverStatus: [number, string][] = [
  [0, "CAP · FUEL LOW"],
  [T.rcvrId, "INBOUND · RENDEZVOUS"],
  [T.xferPrep, "PRE-CONTACT"],
  [T.xfer, "CONTACT · RECEIVING"],
  [T.separation, "SEPARATED · TO CAP"],
  [T.separation + 12, "CAP · REFUELED"],
];

const statusCues = (node: string, entries: [number, string][]): Cue[] =>
  entries.map(([tS, text], i) => {
    const next = entries[i + 1];
    return next
      ? { kind: "status", tS, durationS: next[0] - tS, node, text }
      : { kind: "status", tS, node, text };
  });

// ---------------------------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------------------------

export const refuelOpTimeline: Timeline = {
  id: "refuel-op",
  label: "REFUEL OP · MQ-25-class tanker mission (storyboard)",
  durationS: T.end,
  loop: false,
  actors: {
    [TANKER]: {
      start: DECK_SPOT,
      startHeadingRad: 0,
      segments: [
        // Steps 1–7: on deck at the launch spot, bow (+x).
        { kind: "hold", durationS: T.launch, headingRad: 0 },
        // Step 8: catapult launch off the bow and climb out (accelerating).
        {
          kind: "flyTo",
          durationS: T.transit - T.launch,
          to: [DECK_SPOT[0] + 4, 3.6, LANE_Z - 0.6],
          ease: "in",
        },
        // Step 9: transit; arrive tangent to the anchor orbit.
        {
          kind: "flyTo",
          durationS: T.areaEntry - T.transit,
          to: onCircle(ANCHOR, ANCHOR_R, ANCHOR_ENTRY_ANGLE),
          arriveHeadingRad: ANCHOR_ENTRY_ANGLE + CCW_TANGENT,
        },
        // Steps 10–15: hold the anchor while the receiver identifies, joins, and refuels.
        {
          kind: "orbit",
          durationS: T.recovery - T.areaEntry,
          center: ANCHOR,
          radius: ANCHOR_R,
          periodS: ANCHOR_PERIOD_S,
        },
        // Step 16: return west, swing around astern of the carrier, and trap on the same lane.
        {
          kind: "path",
          durationS: 18,
          through: [
            [ANCHOR[0] - 7, 4.8, ANCHOR[2] - 1.8],
            [STERN_X - 2, 3.8, ANCHOR[2] - 1.2],
            [STERN_X - 7, 2.8, LANE_Z - 2.3],
          ],
        },
        {
          kind: "flyTo",
          durationS: 5,
          to: [STERN_X - 4.5, DECK_Y + 0.9, LANE_Z],
          arriveHeadingRad: 0,
        },
        { kind: "flyTo", durationS: T.postflight - T.recovery - 23, to: DECK_SPOT, ease: "out" },
        // Steps 17–18: secured on deck.
        { kind: "hold", durationS: T.end - T.postflight, headingRad: 0 },
      ],
    },
    [RECEIVER]: {
      start: onCircle(CAP_CENTER, CAP_R, 0),
      segments: [
        // Steps 1–10: on combat air patrol, low on fuel.
        {
          kind: "orbit",
          durationS: T.rcvrId,
          center: CAP_CENTER,
          radius: CAP_R,
          periodS: CAP_PERIOD_S,
        },
        // Steps 11–12: inbound to the anchor, arriving in pre-contact astern of the tanker.
        {
          kind: "flyTo",
          durationS: T.xferPrep - T.rcvrId,
          to: onCircle(RCVR_ORBIT_CENTER, ANCHOR_R, rcvrPrecontactAngle),
          arriveHeadingRad: rcvrPrecontactAngle + CCW_TANGENT,
        },
        // Step 13: close from pre-contact to contact.
        {
          kind: "orbit",
          durationS: T.xfer - T.xferPrep,
          center: RCVR_ORBIT_CENTER,
          radius: ANCHOR_R,
          periodS: CLOSE_PERIOD_S,
        },
        // Step 14: in contact, locked to the tanker's orbit.
        {
          kind: "orbit",
          durationS: T.separation - T.xfer,
          center: RCVR_ORBIT_CENTER,
          radius: ANCHOR_R,
          periodS: ANCHOR_PERIOD_S,
        },
        // Step 15 onward: separate and return to CAP.
        {
          kind: "flyTo",
          durationS: 12,
          to: onCircle(CAP_CENTER, CAP_R, 0),
          arriveHeadingRad: CCW_TANGENT,
        },
        {
          kind: "orbit",
          durationS: T.end - T.separation - 12,
          center: CAP_CENTER,
          radius: CAP_R,
          periodS: CAP_PERIOD_S,
        },
      ],
    },
  },
  cues: [
    {
      kind: "caption",
      tS: 0,
      durationS: 6,
      text: "Refuel op · nominal mission profile (no threats)",
    },
    { kind: "caption", tS: T.launch, durationS: 5, text: "Catapult launch · climb out" },
    {
      kind: "caption",
      tS: T.rcvrId,
      durationS: 6,
      text: "Receiver detected · correlating ID and authorization",
    },
    {
      kind: "caption",
      tS: T.rcvrCoord,
      durationS: 6,
      text: `${rcvrLink.label} up · readiness exchange`,
    },
    { kind: "caption", tS: T.xfer, durationS: 8, text: "Contact · fuel transfer in progress" },
    { kind: "caption", tS: T.separation, durationS: 6, text: "Disconnect · receiver separates" },
    { kind: "caption", tS: T.postflight - 7, durationS: 7, text: "Recovery · arrested landing" },
    ...statusCues(TANKER, tankerStatus),
    ...statusCues(RECEIVER, receiverStatus),
  ],
  steps: STEPS,
};

/** Exported for tests: when the receiver should sit in contact astern of the tanker. */
export const REFUEL_OP_TIMES = T;

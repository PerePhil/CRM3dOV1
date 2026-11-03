/**
 * Reference timeline: exercises every motion primitive and channel so authors can see each one
 * on screen (dev builds only, "REFERENCE" in the timeline picker). It is NOT a scenario and makes
 * no claim about how the UAV behaves under attack; that comes from the sim. Copy its patterns,
 * not its story. Walkthrough: docs/animation/authoring.md.
 */
import { catalog } from "@ov1/catalog";
import { nodeIdOfKind } from "../roles";
import type { Timeline } from "../types";

const UAV = nodeIdOfKind("uav");
const GCS = nodeIdOfKind("gcs");
const JAMMER = nodeIdOfKind("adversary-jammer");

// Derive IDs from catalog relationships instead of writing them out (AGENTS.md §4.5).
const c2Link = catalog.links.find((l) => l.medium === "rf" && l.from === GCS && l.to === UAV);
if (!c2Link) throw new Error("reference timeline: no rf link GCS → UAV in the catalog");
const c2Threat = catalog.threats.find((t) => t.targets.links.includes(c2Link.id));
if (!c2Threat) throw new Error(`reference timeline: no threat targets ${c2Link.id}`);

const HOME_RADIUS = 2.4;
const HOME_PERIOD_S = 28;
/** Where the home orbit is entered (angle 0), and the heading tangent to it there. */
const HOME_ENTRY = { node: UAV, offset: [HOME_RADIUS, 0, 0] as [number, number, number] };
const HOME_ENTRY_HEADING = Math.PI / 2;

export const referenceTimeline: Timeline = {
  id: "reference",
  label: "REFERENCE · Engine demo (dev only)",
  durationS: 60,
  loop: false,
  actors: {
    [UAV]: {
      start: HOME_ENTRY,
      segments: [
        // 0–8 s: on station.
        {
          kind: "orbit",
          durationS: 8,
          center: { node: UAV },
          radius: HOME_RADIUS,
          periodS: HOME_PERIOD_S,
        },
        // 8–18 s: transit along a spline route toward the hostile shore.
        {
          kind: "path",
          durationS: 10,
          through: [
            { node: UAV, offset: [4, 0.5, 3] },
            { node: JAMMER, offset: [0, 5, -3] },
          ],
        },
        // 18–26 s: orbit the objective. The path ends heading +x; a clockwise orbit is tangent
        // to that when its center sits one radius toward +z of the path's end point.
        {
          kind: "orbit",
          durationS: 8,
          center: { node: JAMMER, offset: [0, 5, -1] },
          radius: 2,
          periodS: 12,
          direction: "cw",
        },
        // 26–38 s: curve back and arrive tangent to the home orbit.
        { kind: "flyTo", durationS: 12, to: HOME_ENTRY, arriveHeadingRad: HOME_ENTRY_HEADING },
        // 38–60 s: back on station.
        {
          kind: "orbit",
          durationS: 22,
          center: { node: UAV },
          radius: HOME_RADIUS,
          periodS: HOME_PERIOD_S,
        },
      ],
    },
    [JAMMER]: {
      segments: [
        { kind: "hold", durationS: 12 },
        // A surface vehicle eases in and out instead of flying at constant speed.
        { kind: "flyTo", durationS: 6, to: { node: JAMMER, offset: [-2.5, 0, 1] }, ease: "inOut" },
        { kind: "hold", durationS: 20 },
        { kind: "flyTo", durationS: 6, to: { node: JAMMER }, ease: "inOut" },
      ],
    },
  },
  links: {
    [c2Link.id]: [
      { tS: 18, state: "degraded" },
      { tS: 22, state: "denied" },
      { tS: 40, state: "nominal" },
    ],
  },
  threats: {
    [c2Threat.id]: [
      { tS: 16, active: true },
      { tS: 38, active: false },
    ],
  },
  cues: [
    { kind: "caption", tS: 0, durationS: 8, text: "orbit · loiter around a node" },
    {
      kind: "caption",
      tS: 8,
      durationS: 8,
      text: "path · spline through waypoints, constant speed",
    },
    { kind: "caption", tS: 12, durationS: 6, text: "flyTo + ease: surface actor repositions" },
    { kind: "caption", tS: 16, durationS: 6, text: `threat key · ${c2Threat.name} active` },
    {
      kind: "caption",
      tS: 18,
      durationS: 8,
      text: `link keys · ${c2Link.label} degraded → denied`,
    },
    {
      kind: "caption",
      tS: 26,
      durationS: 12,
      text: "flyTo · curve from current heading to a target",
    },
    { kind: "caption", tS: 40, durationS: 8, text: `link key · ${c2Link.label} restored` },
    { kind: "status", tS: 0, durationS: 8, node: UAV, text: "ON STATION" },
    { kind: "status", tS: 8, durationS: 10, node: UAV, text: "TRANSIT" },
    { kind: "status", tS: 18, durationS: 8, node: UAV, text: "ON OBJECTIVE" },
    { kind: "status", tS: 26, durationS: 12, node: UAV, text: "RETURNING" },
    { kind: "status", tS: 38, node: UAV, text: "ON STATION" },
    { kind: "status", tS: 12, durationS: 32, node: JAMMER, text: "REPOSITIONED" },
  ],
};

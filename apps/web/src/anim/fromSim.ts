/**
 * Sim → Timeline adapter. Converts a sim run (the frozen event log in @ov1/sim/events.ts, plus
 * per-node position samples) into the same Timeline format the hand-authored scripts use, so
 * the renderer can't tell them apart (SPEC §1: the animation and the numbers come from the
 * same engine).
 *
 * Positions must already be in diorama units. The SI → diorama mapping belongs to whoever
 * wires sim-runner into the scene (docs/animation/extending.md#sim-adapter).
 */
import { catalog } from "@ov1/catalog";
import type { SimEvent } from "@ov1/sim";
import type { Cue, LinkKey, ThreatKey, Timeline, Vec3 } from "./types";

export interface SimSample {
  /** Sim time, seconds (tick / tickHz). */
  tS: number;
  /** Diorama units, already mapped from SI. */
  position: Vec3;
}

export interface SimRunInput {
  id: string;
  label: string;
  scenarioId?: string;
  events: readonly SimEvent[];
  /** Per catalog node ID, samples in time order (typically one per tick). */
  tracks?: Readonly<Record<string, readonly SimSample[]>>;
  /** Default: the run.end time, else the last event or sample time. */
  durationS?: number;
}

/** How long transient annotations (detections, triggers, notes) stay on screen, seconds. */
export const SIM_CAPTION_S = 6;

const threatName = (id: string) => catalog.threats.find((t) => t.id === id)?.name ?? id;
const controlName = (id: string) => catalog.controls.find((c) => c.id === id)?.name ?? id;
const linkLabel = (id: string) => catalog.links.find((l) => l.id === id)?.label ?? id;

export function timelineFromSim(run: SimRunInput): Timeline {
  const links: Record<string, LinkKey[]> = {};
  const threats: Record<string, ThreatKey[]> = {};
  const cues: Cue[] = [];
  const modeCues: { node: string; tS: number; text: string }[] = [];
  const push = <K>(map: Record<string, K[]>, id: string, key: K) => {
    const list = map[id];
    if (list) list.push(key);
    else map[id] = [key];
  };
  let endS: number | undefined;
  let lastS = 0;

  for (const e of run.events) {
    lastS = Math.max(lastS, e.t);
    switch (e.type) {
      case "link.state":
        push(links, e.payload.linkId, { tS: e.t, state: e.payload.to });
        if (e.payload.to !== "nominal" && e.payload.to !== "trusted") {
          cues.push({
            kind: "caption",
            tS: e.t,
            durationS: SIM_CAPTION_S,
            text: `${linkLabel(e.payload.linkId)} ${e.payload.to.toUpperCase()}`,
          });
        }
        break;
      case "threat.start":
        push(threats, e.payload.threatId, { tS: e.t, active: true });
        break;
      case "threat.stop":
        push(threats, e.payload.threatId, { tS: e.t, active: false });
        break;
      case "uav.mode":
        modeCues.push({ node: e.source, tS: e.t, text: `MODE: ${e.payload.to.toUpperCase()}` });
        break;
      case "detection":
        cues.push({
          kind: "caption",
          tS: e.t,
          durationS: SIM_CAPTION_S,
          text: `DETECTED: ${threatName(e.payload.threatId)} (by ${e.payload.by}, ${e.payload.latencyS.toFixed(1)} s)`,
        });
        break;
      case "control.trigger":
        cues.push({
          kind: "caption",
          tS: e.t,
          durationS: SIM_CAPTION_S,
          text: `${controlName(e.payload.controlId)}: ${e.payload.effect}`,
        });
        break;
      case "loss.event":
        cues.push({
          kind: "caption",
          tS: e.t,
          text: `LOSS EVENT: ${e.payload.kind.toUpperCase()}. ${e.payload.detail}`,
        });
        break;
      case "note":
        cues.push({ kind: "caption", tS: e.t, durationS: SIM_CAPTION_S, text: e.payload.text });
        break;
      case "run.end":
        endS = e.t;
        break;
      case "run.start":
        break;
    }
  }

  // A mode lasts until the same node's next mode change.
  modeCues.forEach((m, i) => {
    const next = modeCues.slice(i + 1).find((n) => n.node === m.node);
    cues.push({
      kind: "status",
      node: m.node,
      tS: m.tS,
      text: m.text,
      ...(next ? { durationS: next.tS - m.tS } : {}),
    });
  });

  const actors: Timeline["actors"] = Object.fromEntries(
    Object.entries(run.tracks ?? {}).flatMap(([nodeId, samples]) => {
      const first = samples[0];
      if (!first) return [];
      const last = samples[samples.length - 1] as SimSample;
      lastS = Math.max(lastS, last.tS);
      return [[nodeId, { start: first.position, segments: [{ kind: "samples", samples }] }]];
    }),
  );

  const durationS = run.durationS ?? endS ?? lastS;
  return {
    id: run.id,
    label: run.label,
    ...(run.scenarioId ? { scenarioId: run.scenarioId } : {}),
    durationS: durationS > 0 ? durationS : 1,
    loop: false,
    actors,
    links,
    threats,
    cues,
  };
}

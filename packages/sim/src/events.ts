/**
 * FROZEN CONTRACT (SPEC §3.2). The event log is the sim's only output contract: it drives
 * the UI timeline, replay, repudiation analysis, and the sim → FAIR Vuln estimate.
 * Edits require a `contract`-labeled task and a SPEC.md update in the same PR.
 * Adding a NEW event type is a contract change too, because consumers switch on `type`.
 */
import type { LinkState, LostLinkProcedure } from "@ov1/catalog";

export const SIM_EVENTS_VERSION = 1;

/** UAV control/flight mode. */
export type UavMode =
  | "mission"
  | "lost-link"
  | "rtb"
  | "loiter"
  | "landing"
  | "landed"
  | "crashed"
  | "compromised";

/** How a run ended, used to decide whether a loss event occurred. */
export type RunOutcome =
  | "mission-complete"
  | "mission-aborted"
  | "airframe-lost"
  | "data-exfiltrated"
  | "c2-unavailable"
  | "harmful-command"
  | "timeout";

export interface EventPayloads {
  "run.start": {
    scenarioId: string;
    seed: number;
    tickHz: number;
    lostLink: LostLinkProcedure;
    controls: string[];
  };
  "run.end": { outcome: RunOutcome; lossEvent: boolean };
  "link.state": {
    linkId: string;
    from: LinkState;
    to: LinkState;
    /** Jam-to-signal ratio at the receiver when the transition happened, dB. */
    jsDb?: number;
  };
  "uav.mode": { from: UavMode; to: UavMode; reason: string };
  "threat.start": { threatId: string };
  "threat.stop": { threatId: string };
  /** A control changed sim behavior (e.g. spoof detection fired, INS took over). */
  "control.trigger": { controlId: string; effect: string };
  /** Something (control, operator, monitor) detected a threat. */
  "detection": { threatId: string; by: string; latencyS: number };
  /** The scenario's loss condition occurred (SPEC §6.3). */
  "loss.event": { kind: RunOutcome; detail: string };
  /** Free-form annotation for the event log UI. Don't use it to carry machine-read data. */
  "note": { text: string };
}

export type SimEventType = keyof EventPayloads;

interface SimEventBase<K extends SimEventType> {
  /** Monotonic sequence number within a run, starting at 0. */
  seq: number;
  /** Sim tick index at emission. */
  tick: number;
  /** Sim time in seconds: tick / tickHz. Never wall-clock. */
  t: number;
  type: K;
  /** Catalog ID of the emitting entity, or "sim". */
  source: string;
  payload: EventPayloads[K];
}

export type SimEvent = { [K in SimEventType]: SimEventBase<K> }[SimEventType];
export type SimEventOf<K extends SimEventType> = SimEventBase<K>;

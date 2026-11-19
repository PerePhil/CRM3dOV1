/**
 * Attack storyboards on the refuel op. Each one replays the nominal mission (refuel-op.ts) up to
 * the moment the attack is used, injects a red `attack` step into the procedure, reveals the
 * adversary platform that carries it out, and then plays a scenario-specific consequence.
 *
 * Hand-authored behavior under attack: every timeline built here is labeled (storyboard) until
 * the sim produces the run (docs/animation/README.md, Rule 1).
 */
import { catalog, getScenario, type LinkState } from "@ov1/catalog";
import { hostileNodeIds, linkIdsTouching } from "../roles";
import type { Cue, LinkKey, MissionStep, MotionSegment, Timeline, VisibilityKey } from "../types";
import { REFUEL_OP, statusCues } from "./refuel-op";

const EPS = 1e-9;

/**
 * The first `endS` seconds of a track. A cut may land inside a `hold` or `orbit` (both are
 * exact when shortened) or on a segment boundary; cutting a curve would reshape it, so that
 * throws. A track shorter than `endS` has its last hold/orbit stretched to fit.
 */
export function fitSegments(segs: readonly MotionSegment[], endS: number): MotionSegment[] {
  const out: MotionSegment[] = [];
  let t = 0;
  for (const seg of segs) {
    if (t >= endS - EPS) break;
    if (seg.kind === "samples") throw new Error("fitSegments: samples segments are not supported");
    const end = t + seg.durationS;
    if (end <= endS + EPS) {
      out.push(seg);
      t = end;
      continue;
    }
    if (seg.kind !== "hold" && seg.kind !== "orbit") {
      throw new Error(`fitSegments: cannot cut a ${seg.kind} segment at t=${endS}s`);
    }
    out.push({ ...seg, durationS: endS - t });
    t = endS;
  }
  if (t < endS - EPS) {
    const last = out[out.length - 1];
    if (!last || (last.kind !== "hold" && last.kind !== "orbit")) {
      throw new Error("fitSegments: can only stretch a track that ends in a hold or orbit");
    }
    out[out.length - 1] = { ...last, durationS: last.durationS + (endS - t) };
  }
  return out;
}

/** Drop cues that start at or after `endS`; shorten the rest so none runs past it. */
export function clipCues(cues: readonly Cue[], endS: number): Cue[] {
  return cues
    .filter((c) => c.tS < endS - EPS)
    .map((c) => ({
      ...c,
      durationS: Math.min(c.durationS ?? Number.POSITIVE_INFINITY, endS - c.tS),
    }));
}

/** RF links touching a node that can be `denied`: what goes dark when its airframe is lost. */
export function linksLostWith(nodeId: string): string[] {
  return linkIdsTouching(nodeId).filter((id) =>
    catalog.links.find((l) => l.id === id)?.states.includes("denied"),
  );
}

export interface RefuelAttackSpec {
  /** Kebab-case timeline id. */
  id: string;
  /** Catalog scenario this storyboards. Its threats go active at `attackAtS`. */
  scenarioId: string;
  /** The nominal mission plays until here; the red attack step starts here. */
  attackAtS: number;
  /** The injected step. Its number is the procedure step it follows. */
  attack: { title: string; detail: string; watch: readonly string[] };
  /** Procedure steps (by number) that still happen after the attack, at their new start times. */
  after?: readonly { n: number; tS: number }[];
  durationS: number;
  /** Tanker motion from `attackAtS` on. */
  tanker: MotionSegment[];
  /** Receiver motion from `attackAtS` on. Omit to keep its nominal track. */
  receiver?: MotionSegment[];
  /** Adversary nodes that appear when the attack is used. */
  reveal: readonly string[];
  /** Link state changes, merged per link and sorted. */
  links?: readonly { link: string; tS: number; state: LinkState }[];
  /** Scenario captions and status from `attackAtS` on. */
  cues: Cue[];
}

export function refuelAttackTimeline(spec: RefuelAttackSpec): Timeline {
  const scenario = getScenario(spec.scenarioId);
  const { attackAtS: cut, durationS } = spec;
  const nominal = REFUEL_OP;

  const before = nominal.steps.filter((s) => s.tS < cut - EPS);
  const last = before[before.length - 1];
  if (!last) throw new Error(`${spec.id}: attack at t=${cut}s comes before the first step`);
  const attackStep: MissionStep = { tS: cut, n: last.n, kind: "attack", ...spec.attack };
  const after: MissionStep[] = (spec.after ?? []).map(({ n, tS }) => {
    const s = nominal.steps.find((x) => x.n === n);
    if (!s) throw new Error(`${spec.id}: no nominal step ${n}`);
    return { ...s, tS };
  });

  const receiverEnd = spec.receiver ? cut : durationS;
  const links: Record<string, LinkKey[]> = {};
  for (const { link, tS, state } of spec.links ?? []) {
    const keys = links[link] ?? [];
    keys.push({ tS, state });
    links[link] = keys;
  }
  for (const keys of Object.values(links)) keys.sort((a, b) => a.tS - b.tS);

  const reveal = new Set(spec.reveal);
  const visibility: Record<string, VisibilityKey[]> = Object.fromEntries(
    hostileNodeIds().map((id) => [
      id,
      reveal.has(id)
        ? [
            { tS: 0, visible: false },
            { tS: cut, visible: true },
          ]
        : [{ tS: 0, visible: false }],
    ]),
  );

  const entries = (xs: readonly (readonly [number, string])[]): [number, string][] =>
    xs.map(([t, s]) => [t, s]);
  const receiverStatus = statusCues(nominal.receiver.id, entries(nominal.receiverStatus));

  return {
    id: spec.id,
    label: `${scenario.id} · ${scenario.name} · refuel op (storyboard)`,
    scenarioId: scenario.id,
    durationS,
    loop: false,
    actors: {
      [nominal.tanker.id]: {
        start: nominal.tanker.start,
        startHeadingRad: 0,
        segments: [...fitSegments(nominal.tanker.segments, cut), ...spec.tanker],
      },
      [nominal.receiver.id]: {
        start: nominal.receiver.start,
        segments: [
          ...fitSegments(nominal.receiver.segments, receiverEnd),
          ...(spec.receiver ?? []),
        ],
      },
    },
    threats: Object.fromEntries(scenario.threats.map((id) => [id, [{ tS: cut, active: true }]])),
    links,
    visibility,
    cues: [
      { kind: "caption", tS: 0, durationS: 6, text: `Refuel op · ${scenario.id} ${scenario.name}` },
      ...clipCues(nominal.captions, cut),
      ...clipCues(statusCues(nominal.tanker.id, entries(nominal.tankerStatus)), cut),
      ...(spec.receiver
        ? clipCues(receiverStatus, cut)
        : receiverStatus.filter((c) => c.tS < durationS - EPS)),
      ...spec.cues,
    ],
    steps: [...before, attackStep, ...after],
  };
}

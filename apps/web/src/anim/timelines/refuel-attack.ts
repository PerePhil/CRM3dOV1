/**
 * Attack storyboards on the refuel op. Each one replays the nominal mission (refuel-op.ts) up to
 * the moment the attack is used, injects a red `attack` step into the procedure, reveals the
 * adversary platform that carries it out, and then plays a scenario-specific consequence.
 *
 * Hand-authored behavior under attack: every timeline built here is labeled (storyboard) until
 * the sim produces the run (docs/animation/README.md, Rule 1).
 */
import { catalog, getLink, getScenario, getThreat, type LinkState } from "@ov1/catalog";
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

/**
 * The scenario threat that drives one of its links into `state` (e.g. "injected" for false data,
 * "compromised" for a poisoned update). Lets a variant pick its threat from catalog
 * relationships instead of a literal ID. Throws unless exactly one matches.
 */
export function scenarioThreatByLinkState(
  scenarioId: string,
  state: LinkState,
): { id: string; links: string[]; nodes: string[] } {
  const hits = getScenario(scenarioId)
    .threats.map(getThreat)
    .filter((t) => t.targets.links.some((l) => getLink(l).states.includes(state)));
  const t = hits[0];
  if (hits.length !== 1 || !t) {
    throw new Error(
      `${scenarioId}: expected one threat targeting a "${state}" link, found ${hits.length}`,
    );
  }
  return { id: t.id, links: [...t.targets.links], nodes: [...t.targets.nodes] };
}

export interface RefuelAttackSpec {
  /** Kebab-case timeline id. */
  id: string;
  /** Catalog scenario this storyboards. */
  scenarioId: string;
  /** Short name when the scenario has several animations (Timeline.variant). */
  variant?: string;
  /** Threats used by this animation (go active at `attackAtS`). Default: all of the scenario's. */
  threats?: readonly string[];
  /** The red attack step starts here. Nominal captions and status end here. */
  attackAtS: number;
  /**
   * Where the actors' motion leaves the nominal profile, if earlier than `attackAtS` (the attack
   * shapes motion inside the step it interrupts). Must land inside a hold/orbit or on a segment
   * boundary. Default: `attackAtS`.
   */
  divergeAtS?: number;
  /** The injected step. Its number is the procedure step it follows. */
  attack: { title: string; detail: string; watch: readonly string[] };
  /** Procedure steps (by number) that still happen after the attack, at their new start times. */
  after?: readonly { n: number; tS: number }[];
  durationS: number;
  /** Tanker motion from `divergeAtS` on. */
  tanker: MotionSegment[];
  /** Receiver motion from `divergeAtS` on. Omit to keep its nominal track. */
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
  const diverge = spec.divergeAtS ?? cut;
  if (diverge > cut) throw new Error(`${spec.id}: divergeAtS must not be after attackAtS`);
  const threats = spec.threats ?? scenario.threats;
  for (const id of threats) {
    if (!scenario.threats.includes(id))
      throw new Error(`${spec.id}: ${id} is not a threat of ${scenario.id}`);
  }
  const nominal = REFUEL_OP;
  const title = spec.variant ? `${scenario.name} · ${spec.variant}` : scenario.name;

  const before = nominal.steps.filter((s) => s.tS < cut - EPS);
  const last = before[before.length - 1];
  if (!last) throw new Error(`${spec.id}: attack at t=${cut}s comes before the first step`);
  const attackStep: MissionStep = { tS: cut, n: last.n, kind: "attack", ...spec.attack };
  const after: MissionStep[] = (spec.after ?? []).map(({ n, tS }) => {
    const s = nominal.steps.find((x) => x.n === n);
    if (!s) throw new Error(`${spec.id}: no nominal step ${n}`);
    return { ...s, tS };
  });

  const receiverEnd = spec.receiver ? diverge : durationS;
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
    label: `${scenario.id} · ${title} · refuel op (storyboard)`,
    scenarioId: scenario.id,
    ...(spec.variant ? { variant: spec.variant } : {}),
    durationS,
    loop: false,
    actors: {
      [nominal.tanker.id]: {
        start: nominal.tanker.start,
        startHeadingRad: 0,
        segments: [...fitSegments(nominal.tanker.segments, diverge), ...spec.tanker],
      },
      [nominal.receiver.id]: {
        start: nominal.receiver.start,
        segments: [
          ...fitSegments(nominal.receiver.segments, receiverEnd),
          ...(spec.receiver ?? []),
        ],
      },
    },
    threats: Object.fromEntries(threats.map((id) => [id, [{ tS: cut, active: true }]])),
    links,
    visibility,
    cues: [
      {
        kind: "caption",
        tS: 0,
        durationS: 6,
        text: `Refuel op · ${scenario.id} ${spec.variant ?? scenario.name}`,
      },
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

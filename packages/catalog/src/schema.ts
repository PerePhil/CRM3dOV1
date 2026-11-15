/**
 * FROZEN CONTRACT (SPEC §4, §5, §9). Every package and the UI depend on these shapes.
 * Edits require a `contract`-labeled task and a SPEC.md update in the same PR.
 * Adding DATA (new rows in data/*.json) is not a contract change. Changing SHAPES is.
 */
import { z } from "zod";

export const CATALOG_SCHEMA_VERSION = 1;

// ---------- primitives ----------

export const Affiliation = z.enum(["friendly", "hostile", "neutral", "unknown"]);
export const Stride = z.enum(["S", "T", "R", "I", "D", "E"]);

/** Union of every state any link can take. Each link declares its own subset. */
export const LinkState = z.enum([
  "nominal",
  "degraded",
  "denied",
  "spoofed",
  "injected",
  "trusted",
  "compromised",
]);

export const LostLinkProcedure = z.enum([
  "rtb",
  "loiter-then-rtb",
  "continue-mission",
  "land-immediate",
]);

/** Beta-PERT three-point estimate. `source` points into docs/fair/ (SPEC §6.4). */
export const Pert = z
  .object({
    min: z.number(),
    ml: z.number(),
    max: z.number(),
    source: z.string().optional(),
  })
  .refine((p) => p.min <= p.ml && p.ml <= p.max, { message: "PERT requires min <= ml <= max" });

export const FrameworkMapping = z.object({
  framework: z.enum(["attack-ics", "attack-enterprise", "emb3d", "sparta", "capec", "other"]),
  id: z.string(),
  name: z.string(),
  /** false until a human checks the ID against the framework's site. Don't cite unverified mappings. */
  verified: z.boolean(),
});

// ---------- IDs ----------

export const NodeId = z.string().regex(/^N-[A-Z0-9-]+$/);
export const LinkId = z.string().regex(/^L-[A-Z0-9-]+$/);
export const ThreatId = z.string().regex(/^T-[A-Z0-9-]+$/);
export const ControlId = z.string().regex(/^C-[A-Z0-9-]+$/);
export const ScenarioId = z.string().regex(/^S[0-9]+$/);
export const AdversaryId = z.string().regex(/^ADV-[0-9]+$/);

// ---------- entities ----------

export const Node = z.object({
  id: NodeId,
  name: z.string(),
  /** Short OV-1 callout label. */
  label: z.string(),
  kind: z.enum([
    "uav",
    "gcs",
    "c2",
    "satcom",
    "gnss",
    "supply-chain",
    "maintenance",
    "receiver",
    "adversary-jammer",
    "adversary-spoofer",
    "adversary-cyber",
  ]),
  affiliation: Affiliation,
  description: z.string(),
  /** Onboard/internal subsystems worth naming in callouts and threat targets. */
  subsystems: z.array(z.string()).default([]),
});

export const Link = z.object({
  id: LinkId,
  name: z.string(),
  /** Text drawn on the OV-1 link line, e.g. "LOS C2". */
  label: z.string(),
  from: NodeId,
  to: NodeId,
  /** Optional relay hop(s) for drawing, e.g. BLOS via N-SAT. */
  via: z.array(NodeId).default([]),
  /** rf → lightning-bolt line; wired → straight line; logical → dashed (SPEC §8.2). */
  medium: z.enum(["rf", "wired", "logical"]),
  states: z.array(LinkState).min(1),
  defaultState: LinkState,
});

export const Threat = z.object({
  id: ThreatId,
  name: z.string(),
  stride: z.array(Stride).min(1),
  targets: z.object({
    nodes: z.array(NodeId).default([]),
    links: z.array(LinkId).default([]),
  }),
  /** Which adversary profiles can execute this threat. */
  adversaries: z.array(AdversaryId).min(1),
  description: z.string(),
  mappings: z.array(FrameworkMapping).default([]),
});

export const ControlEffect = z.object({
  kind: z.enum(["sim-param", "fair-factor"]),
  /** Dotted path of the parameter affected, e.g. "link.L-LOS.processingGainDb" or "fair.S1.vuln". */
  target: z.string(),
  note: z.string(),
});

export const Control = z.object({
  id: ControlId,
  name: z.string(),
  description: z.string(),
  mitigates: z.array(ThreatId).min(1),
  /** Annual cost in USD; undefined until sourced. */
  annualCostUsd: Pert.optional(),
  effects: z.array(ControlEffect).default([]),
});

export const Adversary = z.object({
  id: AdversaryId,
  name: z.string(),
  kind: z.enum(["nation-state-ew", "nation-state-cyber", "criminal"]),
  description: z.string(),
  /** FAIR threat-community inputs (SPEC §5.5). Optional until sourced in docs/fair/. */
  fair: z
    .object({
      tefPerYear: Pert.optional(),
      /** Threat capability as a percentile 0–100 vs. the general threat population. */
      tcapPercentile: Pert.optional(),
    })
    .default({}),
  /** STIX 2.1 object id in packages/catalog/stix/ once authored. */
  stixId: z.string().optional(),
});

export const Scenario = z.object({
  id: ScenarioId,
  name: z.string(),
  description: z.string(),
  threats: z.array(ThreatId).min(1),
  /** What counts as a loss event for the sim → FAIR Vuln estimate (SPEC §6.3). */
  lossEvent: z.string(),
  defaultLostLink: LostLinkProcedure,
  missionImpact: z.number().int().min(1).max(5).optional(),
});

export const Catalog = z
  .object({
    nodes: z.array(Node),
    links: z.array(Link),
    threats: z.array(Threat),
    controls: z.array(Control),
    adversaries: z.array(Adversary),
    scenarios: z.array(Scenario),
  })
  .superRefine((c, ctx) => {
    const ids = {
      node: new Set(c.nodes.map((n) => n.id)),
      link: new Set(c.links.map((l) => l.id)),
      threat: new Set(c.threats.map((t) => t.id)),
      adversary: new Set(c.adversaries.map((a) => a.id)),
    };
    const all = [
      ...c.nodes.map((x) => x.id),
      ...c.links.map((x) => x.id),
      ...c.threats.map((x) => x.id),
      ...c.controls.map((x) => x.id),
      ...c.adversaries.map((x) => x.id),
      ...c.scenarios.map((x) => x.id),
    ];
    const dupes = all.filter((id, i) => all.indexOf(id) !== i);
    for (const d of new Set(dupes)) ctx.addIssue({ code: "custom", message: `duplicate id ${d}` });

    const need = (set: Set<string>, id: string, where: string) => {
      if (!set.has(id))
        ctx.addIssue({ code: "custom", message: `${where} references unknown ${id}` });
    };
    for (const l of c.links) {
      need(ids.node, l.from, `link ${l.id}.from`);
      need(ids.node, l.to, `link ${l.id}.to`);
      for (const v of l.via) need(ids.node, v, `link ${l.id}.via`);
      if (!l.states.includes(l.defaultState)) {
        ctx.addIssue({ code: "custom", message: `link ${l.id} defaultState not in states` });
      }
    }
    for (const t of c.threats) {
      for (const n of t.targets.nodes) need(ids.node, n, `threat ${t.id}`);
      for (const l of t.targets.links) need(ids.link, l, `threat ${t.id}`);
      for (const a of t.adversaries) need(ids.adversary, a, `threat ${t.id}`);
    }
    for (const k of c.controls) for (const t of k.mitigates) need(ids.threat, t, `control ${k.id}`);
    for (const s of c.scenarios) for (const t of s.threats) need(ids.threat, t, `scenario ${s.id}`);
  });

// ---------- inferred types ----------

export type Affiliation = z.infer<typeof Affiliation>;
export type Stride = z.infer<typeof Stride>;
export type LinkState = z.infer<typeof LinkState>;
export type LostLinkProcedure = z.infer<typeof LostLinkProcedure>;
export type Pert = z.infer<typeof Pert>;
export type Node = z.infer<typeof Node>;
export type Link = z.infer<typeof Link>;
export type Threat = z.infer<typeof Threat>;
export type Control = z.infer<typeof Control>;
export type Adversary = z.infer<typeof Adversary>;
export type Scenario = z.infer<typeof Scenario>;
export type Catalog = z.infer<typeof Catalog>;

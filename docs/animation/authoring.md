# Authoring a timeline

This guide is for an agent or person adding a scenario animation (S1–S6) or any other timeline.
You'll touch two files: a new `apps/web/src/anim/timelines/<name>.ts` and one line in
`timelines/registry.ts`. You don't touch the engine, the scene, or the panels.

Read [README.md](README.md) first, especially **Rule 1** (what a hand-authored timeline may claim).

---

## Recipe: add a scenario animation

1. **Create the file**, e.g. `apps/web/src/anim/timelines/s1-jamming.ts`. Start from the
   template below or copy `reference.ts`.
2. **Get every ID from the catalog.** Use `nodeIdOfKind("uav")`, `scenarioTargets(scenario)`,
   `linkIdsTouching(nodeId)`, or `catalog.*.find(…)` on relationships. Never write `"L-LOS"`.
3. **Describe motion as segments** (reference below). Segments play back to back, and each one starts
   where the previous one ended.
4. **Add link, threat, and cue keys** at the times things happen.
5. **Register it** in `timelines/registry.ts`:
   ```ts
   export const SCENARIO_TIMELINES: Readonly<Record<string, Timeline>> = {
     [s1Jamming.scenarioId as string]: s1Jamming,
   };
   ```
   The key must equal the timeline's `scenarioId` (the test enforces this). That enables the scenario's
   button in the left panel and adds it to the timeline picker.
6. **Check it:**
   ```bash
   pnpm --filter @ov1/web test     # registry.test.ts validates your timeline against the catalog
   pnpm dev                        # click the scenario, then scrub through it
   pnpm verify
   ```
   Put screenshots of the key moments in the PR (SPEC §8 checklist).

### Template

```ts
import { getScenario } from "@ov1/catalog";
import { nodeIdOfKind, scenarioTargets } from "../roles";
import type { Timeline } from "../types";

const scenario = getScenario("S1");            // the only literal ID, and the registry key matches it
const UAV = nodeIdOfKind("uav");
const GCS = nodeIdOfKind("gcs");
const { threats, links } = scenarioTargets(scenario);

export const s1Jamming: Timeline = {
  id: "s1-jamming",
  label: `${scenario.id} · ${scenario.name} (storyboard)`,
  scenarioId: scenario.id,
  durationS: 45,
  loop: false,
  actors: {
    [UAV]: {
      start: { node: UAV, offset: [2.4, 0, 0] },
      segments: [
        { kind: "orbit", durationS: 10, center: { node: UAV }, radius: 2.4, periodS: 28 },
        { kind: "flyTo", durationS: 14, to: { node: GCS, offset: [0, 3, 0] } },
        { kind: "hold", durationS: 21 },
      ],
    },
  },
  threats: Object.fromEntries(threats.map((id) => [id, [{ tS: 4, active: true }]])),
  links: Object.fromEntries(
    links.map((id) => [id, [{ tS: 6, state: "degraded" }, { tS: 9, state: "denied" }]]),
  ),
  cues: [
    { kind: "caption", tS: 4, durationS: 6, text: "Jammer radiates on C2 bands" },
    { kind: "status", tS: 9, node: UAV, text: `LOST-LINK · ${scenario.defaultLostLink.toUpperCase()}` },
  ],
};
```

This is illustrative. A real S1 should take its timing and behavior from the sim once `sim-runner`
exists (README Rule 1), and keep only choreography such as captions and pacing in the script. Until then,
label placeholder storyboards `(storyboard)` so nobody mistakes them for sim output.

---

## Reference

### Timeline

| Field | Type | Notes |
|---|---|---|
| `id` | kebab-case string | Unique across all timelines |
| `label` | string | Shown in the playback panel |
| `scenarioId?` | catalog scenario ID | Set it for scenario timelines |
| `durationS` | > 0 | Every track, key, and cue must fit inside it |
| `loop` | boolean | Looping timelines must end where they start (validator checks it) |
| `actors?` | `{ [nodeId]: ActorTrack }` | Nodes without a track stay at home |
| `links?` | `{ [linkId]: LinkKey[] }` | Sorted by `tS` |
| `threats?` | `{ [threatId]: ThreatKey[] }` | Sorted by `tS` |
| `cues?` | `Cue[]` | Any order. Sorted at compile time |

### Places

A `Place` is either raw diorama coordinates `[x, y, z]` or `{ node, offset? }`, which means that
node's home position (`scene/layout.ts`) plus an offset. **Prefer the node form**: it survives layout
changes. Diorama scale: the UAV sits at y ≈ 5.5, ground nodes around y ≈ 1, satellites around 13–15.

### ActorTrack

| Field | Default | Notes |
|---|---|---|
| `start?` | the node's home | Position at t = 0 |
| `startHeadingRad?` | `0` (+x) | Used until motion implies a heading |
| `segments` | — | Played back to back |

### Motion segments

All of them except `samples` take `durationS`. Each starts from where the previous one ended.

| `kind` | Fields | What it does | Use it for |
|---|---|---|---|
| `hold` | `at?`, `headingRad?` | Stays put. `at` teleports first. | Ground nodes, pauses, initial placement |
| `flyTo` | `to`, `ease?`, `arriveHeadingRad?` | Smooth Bézier from the current position **and heading** to `to`, at constant speed (linear ease) | Transits, RTB, repositioning |
| `orbit` | `center`, `radius`, `periodS`, `direction?` (`"ccw"`), `startAngleRad?` | Circles `center` at the center's altitude. Enters at the angle the actor is already at. | Loiter, holding pattern, on-station |
| `path` | `through[]`, `ease?` | Catmull-Rom spline through every point at constant speed. Leaves roughly along the current heading. | Routes, waypoints, drift tracks |
| `samples` | `samples[{tS, position}]` | Linear interpolation of timestamped positions. Duration = last `tS`. | Sim output (via `timelineFromSim`) |

**Continuity tips** (the validator catches the first two):
- An `orbit` whose circle doesn't pass near the actor **jumps**. Enter it with a `flyTo` that ends on the
  circle, ideally with `arriveHeadingRad` set to the tangent: for `ccw` at angle `a`, the tangent is
  `a + π/2`. For `cw`, it's `a − π/2`. Angle 0 is `center + [radius, 0, 0]`.
- A looping timeline must end where it started. One full `orbit` with `durationS === periodS` is the
  easiest seamless loop (see `idle.ts`).
- To leave an orbit smoothly into a `path`, the path's first point should lie roughly ahead along the
  tangent. See `reference.ts`, which pairs a path ending heading +x with a `cw` orbit centered one
  radius toward +z.

**Ease:** `linear` (default, constant speed, right for aircraft), `in`, `out`, `inOut` (right for
surface vehicles that start and stop).

**Orientation is automatic.** Heading follows velocity, bank follows turn rate, pitch follows climb.
You never author angles except optional `arriveHeadingRad` / `headingRad`.

### Keys

| Type | Shape | Semantics |
|---|---|---|
| `LinkKey` | `{ tS, state }` | From `tS` on, the link is in `state`. Before the first key it's the catalog `defaultState`. `state` must be in that link's `states` list. |
| `ThreatKey` | `{ tS, active }` | From `tS` on, the threat is active or inactive. Before the first key it's inactive. |

### Cues

| `kind` | Shape | Shows up |
|---|---|---|
| `caption` | `{ tS, durationS?, text }` | Stacked box at the top of the viewport. Keep it under ~60 chars, OV-1 tone. |
| `status` | `{ tS, durationS?, node, text }` | Second line on the node's callout. The latest active cue wins. |

Without `durationS`, a cue lasts to the end of the timeline. Write text in the briefing voice: short and
factual, uppercase for status (`LOST-LINK · RTB`), sentence case for captions.

---

## Previewing and debugging

- **Timeline picker** (left panel, Playback): every registered timeline. In dev builds it also lists
  `REFERENCE`, which demos every primitive.
- **Scrub** to any time. `evaluate` is pure, so scrubbing backward is exact.
- **Speed** 0.25×–4× for checking fast transitions.
- **In a test**, evaluate any instant directly:
  ```ts
  const frame = evaluate(compileTimeline(myTimeline), 12.5);
  frame.actors.get(uavId)?.position;  // [x, y, z]
  frame.links.get(linkId);            // "denied"
  ```
- `validateTimeline(tl)` returns readable errors such as
  `s1-jamming: actor N-UAV: orbit at t=10s starts 3.10u from the actor; add a flyTo first`.

## Checklist before the PR

- [ ] No literal node, link, or threat IDs. The registry key is the only scenario ID literal.
- [ ] `pnpm --filter @ov1/web test` is green (the registry validates your timeline).
- [ ] Hand-written behavior is labeled `(storyboard)` unless it came from the sim (README Rule 1).
- [ ] Captions and status text are short and in the OV-1 voice. No colors or styling in the timeline.
- [ ] Screenshots of the key beats in the PR.

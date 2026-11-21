# Authoring a timeline

This guide is for an agent or person adding a scenario animation (S1–S3) or any other timeline.
You'll touch two files: a new `apps/web/src/anim/timelines/<name>.ts` and one line in
`timelines/registry.ts`. You don't touch the engine, the scene, or the panels.

Read [README.md](README.md) first, especially **Rule 1** (what a hand-authored timeline may claim).

---

## Recipe: add a scenario animation

1. **Create the file**, e.g. `apps/web/src/anim/timelines/s3-jamming.ts`. Start from the
   template below or copy `reference.ts`.
2. **Get every ID from the catalog.** Take the scenario ID as the builder's argument. Use `nodeIdOfKind("uav")`, `scenarioTargets(scenario)`,
   `linkIdsTouching(nodeId)`, or `catalog.*.find(…)` on relationships. Never write `"L-LOS"`.
3. **Describe motion as segments** (reference below). Segments play back to back, and each one starts
   where the previous one ended.
4. **Add link, threat, and cue keys** at the times things happen.
5. **Register it** in `timelines/registry.ts`:
   ```ts
   export const SCENARIO_TIMELINES: Readonly<Record<string, readonly Timeline[]>> = {
     S3: byScenario("S3", [jammingStoryboard]),
   };
   ```
   Scenario timelines are **builders** `(scenarioId) => Timeline`: the registry key is the only
   place a scenario ID is written out, and `registry.test.ts` fails if any other timeline file
   names one. The key must equal every built timeline's `scenarioId` (also tested). That enables
   the scenario's button in the side panel's Scenario section and adds it to the timeline picker. A scenario with
   several threats can list several timelines; give each a distinct `variant` (e.g. S2's
   "False telemetry" and "Flight-computer malware") and they appear as sub-buttons.
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

const UAV = nodeIdOfKind("uav");
const GCS = nodeIdOfKind("gcs");

/** The registry passes the scenario ID: no scenario-ID literal in this file (AGENTS.md §6.1). */
export function jammingStoryboard(scenarioId: string): Timeline {
  const scenario = getScenario(scenarioId);
  const { threats, links } = scenarioTargets(scenario);
  return {
  id: "s3-jamming",
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
}
```

This is illustrative. A real S3 should take its timing and behavior from the sim once `sim-runner`
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
| `variant?` | string | Short name when a scenario has several timelines (sub-button label) |
| `durationS` | > 0 | Every track, key, and cue must fit inside it |
| `loop` | boolean | Looping timelines must end where they start (validator checks it) |
| `actors?` | `{ [nodeId]: ActorTrack }` | Nodes without a track stay at home |
| `links?` | `{ [linkId]: LinkKey[] }` | Sorted by `tS` |
| `threats?` | `{ [threatId]: ThreatKey[] }` | Sorted by `tS` |
| `visibility?` | `{ [nodeId]: VisibilityKey[] }` | Sorted by `tS`. Nodes without keys are always shown |
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
| `VisibilityKey` | `{ tS, visible }` | From `tS` on, the node (icon and callout) is drawn or hidden. Before the first key it's shown. Use it to keep an adversary off the slide until its attack is used. |

### Cues

| `kind` | Shape | Shows up |
|---|---|---|
| `caption` | `{ tS, durationS?, text }` | Stacked box at the top of the viewport. Keep it under ~60 chars, OV-1 tone. |
| `status` | `{ tS, durationS?, node, text }` | Second line on the node's callout. The latest active cue wins. |

### Mission steps

A timeline that follows a written procedure lists it in `steps`. The Mission Steps panel shows the
list, highlights the active step, and seeks to a step when clicked.

| Field | Notes |
|---|---|
| `tS` | Step starts here and runs until the next step. Strictly increasing, inside the timeline. |
| `n` | The step number as written in the source procedure. |
| `title` | Short name, e.g. "Fuel Transfer". |
| `detail?` | One or two sentences from the procedure. |
| `watch?` | Parameters or systems that matter during the step (risk-table rows). |
| `kind?` | `"attack"` marks an adversary action injected into the procedure. Its `n` is the procedure step it follows. Rendered in hostile red. Needs a `scenarioId` and a threat track. Default `"procedure"`. |

Steps narrate; they never move anything. Put the motion in `actors` and let the step boundaries
match the segment boundaries (see `refuel-op.ts`, which keys both off one `T` table).

### Attacks on the refuel op

To storyboard an attack on the baseline mission, don't copy `refuel-op.ts`. Call
`refuelAttackTimeline()` from `timelines/refuel-attack.ts` (see `s1-gps-spoofing.ts`,
`s2-false-telemetry.ts`, `s2-malware.ts`). You give it:

- `attackAtS`: the nominal mission plays until here, then the red attack step starts.
- `divergeAtS` (optional, ≤ `attackAtS`): where motion leaves the nominal profile when the attack
  shapes the step it interrupts (S2 false telemetry diverges at launch, attacks off the bow). The
  cut must land inside a `hold` / `orbit` or on a segment boundary (`fitSegments` throws otherwise).
- `variant` and `threats` when the scenario has several threats: name this animation and say
  which threat it uses. Pick the threat with `scenarioThreatByLinkState()`, not a literal ID.
- `attack`: the injected step's title, detail, and watch list. Use parameter-table names that the
  table maps to the step the attack follows or leads into (the tests enforce this).
- `after`: nominal steps that still happen, by number, at their new start times.
- `tanker` (and optionally `receiver`) segments from `attackAtS` on. An omitted receiver keeps
  its nominal track.
- `reveal`: adversary nodes that appear at `attackAtS`. Every other hostile node stays hidden.
- `links` and `cues` for the attack and its consequence.

The builder activates the chosen threats at `attackAtS`, hides all hostile nodes before it,
clips nominal captions and status there, and labels the result `(storyboard)`.

### Baseline missions vs. scenarios

A mission with no threats (e.g. `refuel-op`) has no `scenarioId`. Register it in
`MISSION_TIMELINES`, not `SCENARIO_TIMELINES`: it appears in the timeline picker and as a load
button in the Mission Steps panel. A baseline mission shows no enemy activity, so it hides every
hostile node (`hostileNodeIds()` from `roles.ts`) with a visibility key at `tS: 0`.

Without `durationS`, a cue lasts to the end of the timeline. Write text in the briefing voice: short and
factual, uppercase for status (`LOST-LINK · RTB`), sentence case for captions.

---

## Previewing and debugging

- **Timeline picker** (side panel, Playback): every registered timeline. In dev builds it also lists
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
  `s3-jamming: actor N-UAV: orbit at t=10s starts 3.10u from the actor; add a flyTo first`.

## Checklist before the PR

- [ ] No literal node, link, or threat IDs. The registry key is the only scenario ID literal.
- [ ] `pnpm --filter @ov1/web test` is green (the registry validates your timeline).
- [ ] Hand-written behavior is labeled `(storyboard)` unless it came from the sim (README Rule 1).
- [ ] Captions and status text are short and in the OV-1 voice. No colors or styling in the timeline.
- [ ] Screenshots of the key beats in the PR.

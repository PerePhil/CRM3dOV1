# Extending the animation layer

For agents working on the engine or wiring new scene elements to it: link-state rendering, threat
volumes, the ghost track, camera moves, and the sim adapter. If you only want to animate a scenario,
see [authoring.md](authoring.md).

---

## Make a scene element follow the timeline

### Rule: read the Frame in `useFrame`, write to refs

```tsx
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { livePosition, playback } from "../anim";

export function FollowsUav({ uavId }: { uavId: string }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    const p = livePosition(playback.frame, uavId);   // animated pose, or home if untracked
    ref.current?.position.set(p[0], p[1], p[2]);
  });
  return <group ref={ref}>{/* … */}</group>;
}
```

- `<AnimationDriver/>` (mounted once in `Ov1Scene`) ticks the clock at `useFrame` priority **−1**, so
  every later `useFrame` sees the current frame. Don't use positive priorities: in R3F they take over
  rendering. The clock is fed a moving average of the frame delta (`createDeltaSmoother`), which
  removes rAF wobble without changing playback speed.
- **Priority order** (`FRAME_PRIORITY` in `anim/react.tsx`): `CLOCK` (−1) → `CAMERA` (−0.75, the
  presentation camera rig) → `ACTORS` (−0.5, node and link transforms) → 0 (drei `<Html>` callouts
  project themselves). Anything that moves a group carrying an `<Html>` child must run at `ACTORS`:
  React registers the child's `useFrame` first, so at equal priority the callout is projected from the
  previous frame's position and visibly jitters against its mesh.
- **Never** `setState` per frame, and never put `playback.frame` in React state or context.
- For a whole node (platform icon + callout), use `useActorTransform(nodeId)`. It returns
  `{ root, attitude }`: position goes on `root`, heading/pitch/bank on `attitude`. Put DOM callouts
  under `root` so they follow the node without rolling (see `scene/platforms.tsx`).
  Position is exact; attitude eases toward the evaluated pose at `ATTITUDE_RATE` so bank and heading
  don't snap where two motion segments meet (it snaps instead on a seek or load).

### Discrete things (text, states, toggles): `usePlayback(selector)`

```tsx
const links = usePlayback((s) => s.discrete.links);           // stable Map until a link changes
const threats = usePlayback((s) => s.discrete.activeThreats);  // stable Set until a threat toggles
const playing = usePlayback((s) => s.playing);                 // primitive: fine
```

The snapshot changes only on control changes, discrete-channel changes, or every 0.1 s of time.
**Selectors must return a primitive or an object already on the snapshot.** A fresh object or array
each call makes `useSyncExternalStore` loop. Derive inside the component instead.

### Geometry that depends on moving endpoints

`scene/LinkLine.tsx` is the pattern. It computes the static polyline once for the first render, then in
`useFrame` recomputes points from `livePosition()` and rewrites the drei `<Line>` buffers **in place**
(`writeSegmentPositions` / `writeSegmentDistances` in `scene/linkGeometry.ts`). It skips the work when
no endpoint is animated and sets `frustumCulled={false}` because the cached bounds go stale. Keep point
counts independent of positions so buffers never need reallocating.

---

## Backlog tasks: where to plug in

| Task | Read | Notes |
|---|---|---|
| `link-state-render` | `linkStateOf(playback.frame, link)` in `LinkLine`'s `useFrame`, or `usePlayback(s => s.discrete.links)` to swap materials | Keep the in-place geometry path. Material / dash changes are discrete, so drive them from the snapshot. |
| `threat-volumes` | `usePlayback(s => s.discrete.activeThreats)` for visibility; `livePosition()` for anchoring to a moving emitter | The radius slider comes from the app store, not the timeline. |
| `ghost-track` | Add a perceived-pose channel (below), then render a red dashed ghost with `useFrame` | The sim's perceived position $\hat{\mathbf{x}}(t)$ arrives as a second sample track. |
| `camera-presets` | Optional: add a `camera` cue channel for scripted presentation moves | User orbit must still win. Only move the camera on an explicit cue. |
| `event-log-panel` | `playback.seek(event.t)` on click | The scrubber and event log share the same clock. |
| `app-store` | Call `playback.load(timelineForScenario(id) ?? IDLE_TIMELINE)` when the selected scenario changes | Keep the clock in `playback`. The store owns *config* (scenario, seed, controls), not time. |

---

## Add a channel

Example: a perceived-position (ghost) channel for SPEC §6.2.

1. **Format** (`types.ts`): add an optional field to `Timeline`, e.g.
   `ghosts?: Readonly<Record<string, ActorTrack>>`, and the evaluated output to `Frame`, e.g.
   `ghosts: ReadonlyMap<string, Pose>`.
2. **Compile** (`compile.ts`): reuse `compileTrack()` and store the result on `CompiledTimeline`.
3. **Evaluate** (`evaluate.ts`): fill the new `Frame` field. Keep it pure.
4. **Validate** (`validate.ts`): check IDs against the catalog and timing against `durationS`.
5. **Snapshot** (`playback.ts`): only if React needs it. Add it to `DiscreteState` **and** to
   `discreteKey()`, or the UI won't update.
6. **Sim adapter** (`fromSim.ts`): populate it from the run.
7. **Tests:** extend `interpreter.test.ts` and `validate.test.ts`, then render it in a scene component.
8. **Docs:** add the channel to the table in [README.md](README.md) and to [authoring.md](authoring.md).

Changing the Timeline format is a local change in `apps/web`. It is **not** a frozen contract. But
keep it backward compatible (new fields optional) so existing timelines still validate.

## Add a motion primitive

Add a variant to `MotionSegment` (`types.ts`) and a `case` in `compileSegment()` (`compile.ts`). It
receives the chain state (position and heading at the segment start) and returns a compiled segment
(`at(localS) → Vec3`, `restHeadingRad`) plus the end state. Precompute anything expensive at compile
time, since `at()` runs several times per actor per frame (orientation uses finite differences).
Add validation and tests, and document it in authoring.md's table.

---

## Sim adapter

`timelineFromSim()` (`anim/fromSim.ts`) already converts the **frozen event log** (`@ov1/sim`
`events.ts`) into Timeline channels:

| Sim event | Timeline |
|---|---|
| `link.state` | `links[linkId]` key, plus a caption on non-nominal states |
| `threat.start` / `threat.stop` | `threats[threatId]` keys |
| `uav.mode` | `status` cue on the source node (`MODE: LOST-LINK`), lasting until its next mode |
| `detection`, `control.trigger`, `note` | 6 s captions |
| `loss.event` | Caption until the end |
| `run.end` | `durationS` |

Positions come in as `tracks: { [nodeId]: { tS, position }[] }` and become `samples` segments.

**What the `sim-runner` / `worker-bridge` work still has to do:**

1. Produce per-tick snapshots (true position, perceived position) alongside the event log.
2. Define the **SI → diorama mapping** (e.g. `scene/simSpace.ts`): an affine map from the sim's
   meters to the compressed layout. It's a render concern, so it lives in `apps/web`, never in `packages/sim`.
3. In the bridge, call `timelineFromSim({ id, label, scenarioId, events, tracks })` and
   `playback.load(...)` with the result. Downsample tracks if needed: `samples` interpolates linearly,
   so 5–10 Hz is plenty for display.
4. Layer choreography on top if wanted (extra captions) by merging cue arrays. Never edit the
   sim-derived motion or keys.

---

## Performance budget

- `evaluate()` allocates a few small objects per frame. That's fine at the current scale (one
  actor, six links). If it becomes hot, reuse an output Frame. Don't cache across `t`, because purity
  is what makes seeking exact.
- Orientation costs about 7 position samples per actor per frame. Keep `at()` O(log n) or better
  (binary search on samples, precomputed arc-length tables).
- React re-renders from playback are capped at about 10 Hz plus discrete changes (`SNAPSHOT_RESOLUTION_S`).

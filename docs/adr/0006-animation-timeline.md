# ADR-0006: Declarative timelines + a pure interpreter for scene animation

- **Status:** Proposed
- **Date:** 2026-11-03
- **Deciders:** Project team
- **SPEC sections affected:** §1, §3.1, §3.2 ("the renderer interpolates between ticks"), §7 (play / pause / scrub / speed), §8

## Context
The OV-1 has to move: the UAV flies, links change state, threats switch on, and the briefing text changes,
all under play / pause / scrub / speed controls (SPEC §7). Motion will come from two sources: hand-made
choreography (idle loops, presentation pacing) and the deterministic sim (SPEC §3.2), whose fixed-tick
output the renderer must interpolate. Several agents will add scenario animations in parallel, so the
way to add one must be small, data-only, and checkable in CI, and it must not require touching scene
components.

## Decision
Everything time-varying is a **Timeline**: plain data with actor motion segments (`hold`, `flyTo`,
`orbit`, `path`, `samples`), link-state keys, threat keys, and text cues, in diorama units. A compiler
plus a pure `evaluate(timeline, t) → Frame` interpreter produce the state for any instant. One
framework-free playback controller owns the clock. Scene components read the Frame in `useFrame` and
write to refs. Sim runs are converted into the same format by `timelineFromSim()`, so scripted and
simulated motion share one renderer path. Orientation (heading, bank, pitch) is derived from motion,
never authored. Lives in `apps/web/src/anim/`. Guide: `docs/animation/`.

## Alternatives considered
| Option | Pros | Cons |
|---|---|---|
| Imperative per-component animation (`useFrame` + local timers) | Quick for one effect | No shared clock, so no consistent pause/scrub/replay. Every agent reinvents timing, and motion logic scatters across the scene. |
| Animation library (GSAP, theatre.js, framer-motion-3d) | Rich easing, visual editors | New dependency. Time isn't a pure function of the timeline, so seeking backward is fragile. Doesn't speak sim events. theatre.js state is JSON outside our catalog validation. |
| three.js `AnimationMixer` + keyframe clips | Built in, GPU-friendly | Keyframes per property, no notion of links, threats, or cues, and awkward to generate from sim events or validate against the catalog. |
| **Data timelines + pure interpreter (chosen)** | Seek and replay are exact. One format for scripts and sim output. Validated against the catalog in CI. No new dependencies. Adding a scenario is one data file plus one registry line. | We maintain ~1.2k lines (comments included) of interpreter, clock, and adapter. Richer effects need a new channel (documented in `extending.md`). |

## Consequences
- Scene tasks (`link-state-render`, `threat-volumes`, `ghost-track`, `camera-presets`) read playback
  state instead of inventing their own timing.
- Scenario animations can be storyboarded before `sim-runner` lands and swapped for sim-derived
  timelines without touching the scene. Docs require storyboards to be labeled as such (SPEC §1:
  animation and numbers come from the same engine).
- The Timeline format is local to `apps/web`, not a frozen contract. Changes must stay backward
  compatible, and every registered timeline is validated in CI.
- Playback time uses the wall clock (presentation state), while frame contents stay a pure function of
  time, so screenshots at a given `t` are reproducible.
- If SPEC §3.1 / §7 should name this layer, that's a SPEC edit for a human to make.

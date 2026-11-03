# anim/

The animation layer: Timeline format, interpreter, playback clock, R3F bindings, sim adapter, and
the registered timelines. **Start at [docs/animation/README.md](../../../../docs/animation/README.md).**

- Add a scenario animation: `timelines/<name>.ts` + one line in `timelines/registry.ts`
  ([authoring.md](../../../../docs/animation/authoring.md)).
- Make a scene element follow the timeline, add a channel, or wire the sim in:
  [extending.md](../../../../docs/animation/extending.md).
- Pure modules (`compile`, `evaluate`, `validate`, `playback`, `fromSim`, `roles`, `space`, `vec`) run
  in Node and are unit-tested. Only `react.tsx` and `instance.ts` touch React or the browser.

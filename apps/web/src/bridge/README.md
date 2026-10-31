# bridge/

Comlink wrappers that run `@ov1/sim` and `@ov1/risk` inside Web Workers (SPEC §3.1), so Monte Carlo
never blocks rendering. Empty in v0: see backlog task "Worker bridge for sim + risk".
Add `comlink` as a dependency in that task (it's pre-approved in SPEC §3.1).

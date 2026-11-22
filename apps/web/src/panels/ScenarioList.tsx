import { catalog } from "@ov1/catalog";
import { IDLE_TIMELINE, playback, timelinesForScenario, usePlayback } from "../anim";

/**
 * Scenario preset picker (SPEC §7). Clicking a scenario plays its first registered animation
 * (anim/timelines/registry.ts); clicking it again returns to idle. A scenario with several
 * animations (e.g. one per threat of a multi-threat scenario) lists each as a sub-button.
 * Scenarios without an animation yet are disabled. The app-store task will move "selected
 * scenario" into the shared store; playback loading stays the same.
 */
export function ScenarioList() {
  const playingScenario = usePlayback((s) => s.scenarioId);
  const playingId = usePlayback((s) => s.timelineId);
  return (
    <ul data-testid="scenario-list" className="space-y-1.5 text-base">
      {catalog.scenarios.map((s) => {
        const tls = timelinesForScenario(s.id);
        const first = tls[0];
        const active = playingScenario === s.id;
        return (
          <li key={s.id}>
            <button
              type="button"
              data-testid={`scenario-${s.id}`}
              disabled={!first}
              aria-pressed={active}
              title={first ? `Play ${first.label}` : "No animation authored yet (docs/animation)"}
              onClick={() => playback.load(active || !first ? IDLE_TIMELINE : first)}
              className={`flex w-full items-baseline gap-2 border px-2.5 py-1.5 text-left leading-snug ${
                active ? "border-friendly-strong bg-friendly/30" : "border-rule bg-paper"
              } enabled:hover:bg-paper-alt disabled:cursor-not-allowed`}
            >
              <span className="font-bold">{s.id}</span>
              <span className="flex-1">{s.name}</span>
              <span className="text-xs font-bold uppercase text-ink-muted">
                {first ? (active ? "■" : "▶") : "—"}
              </span>
            </button>
            {tls.length > 1 ? (
              <ul className="mt-1 space-y-1 pl-5">
                {tls.map((tl) => {
                  const on = playingId === tl.id;
                  return (
                    <li key={tl.id}>
                      <button
                        type="button"
                        data-testid={`scenario-variant-${tl.id}`}
                        aria-pressed={on}
                        title={`Play ${tl.label}`}
                        onClick={() => playback.load(on ? IDLE_TIMELINE : tl)}
                        className={`flex w-full items-baseline gap-2 border px-2.5 py-1 text-left text-sm ${
                          on ? "border-friendly-strong bg-friendly/30" : "border-rule/50 bg-paper"
                        } hover:bg-paper-alt`}
                      >
                        <span className="flex-1">{tl.variant ?? tl.label}</span>
                        <span className="text-xs font-bold uppercase text-ink-muted">
                          {on ? "■" : "▶"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

import { catalog } from "@ov1/catalog";
import { IDLE_TIMELINE, playback, timelineForScenario, usePlayback } from "../anim";

/**
 * Scenario preset picker (SPEC §7). Clicking a scenario plays its animation if one is
 * registered (anim/timelines/registry.ts); clicking it again returns to idle. Scenarios without
 * an animation yet are disabled. The app-store task will move "selected scenario" into the
 * shared store; playback loading stays the same.
 */
export function ScenarioList() {
  const playingScenario = usePlayback((s) => s.scenarioId);
  return (
    <ul data-testid="scenario-list" className="space-y-1 text-sm">
      {catalog.scenarios.map((s) => {
        const tl = timelineForScenario(s.id);
        const active = playingScenario === s.id;
        return (
          <li key={s.id}>
            <button
              type="button"
              data-testid={`scenario-${s.id}`}
              disabled={!tl}
              aria-pressed={active}
              title={tl ? `Play ${tl.label}` : "No animation authored yet (docs/animation)"}
              onClick={() => playback.load(active || !tl ? IDLE_TIMELINE : tl)}
              className={`flex w-full items-baseline gap-1 border px-2 py-1 text-left ${
                active ? "border-friendly-strong bg-friendly/30" : "border-rule bg-paper"
              } enabled:hover:bg-paper-alt disabled:cursor-not-allowed`}
            >
              <span className="font-bold">{s.id}</span>
              <span className="flex-1">{s.name}</span>
              <span className="text-[9px] font-bold uppercase text-ink-muted">
                {tl ? (active ? "■" : "▶") : "—"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

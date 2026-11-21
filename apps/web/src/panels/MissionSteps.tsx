import { useEffect, useRef } from "react";
import { MISSION_TIMELINES, playback, usePlayback } from "../anim";
import { formatClock } from "./PlaybackControls";

const btn =
  "border border-rule bg-paper px-3 py-1 text-sm font-bold uppercase enabled:hover:bg-paper-alt disabled:cursor-not-allowed disabled:text-ink-muted focus-visible:outline-2 focus-visible:outline-friendly-strong";

/** One-line "STEP n / N" (or attack) summary for the collapsed section header. */
export function useStepSummary(): string | null {
  usePlayback((s) => s.timelineId);
  const stepIndex = usePlayback((s) => s.discrete.stepIndex);
  const steps = playback.timeline.steps ?? [];
  const active = steps[stepIndex];
  if (steps.length === 0) return null;
  if (!active) return `— / ${steps.length}`;
  return active.kind === "attack"
    ? `ATTACK · ${active.title}`
    : `${active.n} / ${steps.length} · ${active.title}`;
}

/**
 * Mission procedure for the playing timeline (Timeline.steps): the written steps, the active one
 * highlighted with its description and the parameters to watch. Clicking a step, or Prev / Next,
 * seeks the shared playback clock, so the scene, captions, and this list always agree.
 * Attack steps (scenario storyboards) are adversary actions injected into the procedure, so they
 * render in hostile red (SPEC §8: red means adversary, and only adversary).
 */
export function MissionSteps() {
  // timelineId re-renders on load; the steps themselves are static data on the timeline.
  const timelineId = usePlayback((s) => s.timelineId);
  const stepIndex = usePlayback((s) => s.discrete.stepIndex);
  const tS = usePlayback((s) => s.tS);
  const durationS = usePlayback((s) => s.durationS);
  const steps = playback.timeline.steps ?? [];
  const activeRef = useRef<HTMLLIElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when the active step changes.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [stepIndex, timelineId]);

  if (steps.length === 0) {
    return (
      <div data-testid="mission-steps-empty" className="space-y-1.5 text-sm">
        <p className="mb-2 text-ink-muted">No written procedure for this timeline.</p>
        {MISSION_TIMELINES.map((tl) => (
          <button
            key={tl.id}
            type="button"
            data-testid={`mission-load-${tl.id}`}
            className={`${btn} w-full text-left normal-case`}
            onClick={() => playback.load(tl)}
          >
            ▶ {tl.label}
          </button>
        ))}
      </div>
    );
  }

  const active = steps[stepIndex];
  const nextT = steps[stepIndex + 1]?.tS ?? durationS;
  const progress = active ? Math.min(1, Math.max(0, (tS - active.tS) / (nextT - active.tS))) : 0;
  const seekTo = (i: number) => {
    const s = steps[i];
    if (s) playback.seek(s.tS);
  };

  return (
    <section data-testid="mission-steps" aria-label="Mission steps" className="text-sm">
      <div className="sticky top-0 z-10 mb-2 flex items-center gap-1.5 bg-paper-alt py-1">
        <button
          type="button"
          data-testid="mission-step-prev"
          className={btn}
          disabled={stepIndex <= 0}
          title="Previous step (←)"
          onClick={() => seekTo(stepIndex - 1)}
        >
          ◀ Prev
        </button>
        <span
          data-testid="mission-step-counter"
          className="flex-1 text-center font-[family-name:var(--font-data)] text-sm font-bold"
        >
          {active
            ? active.kind === "attack"
              ? `ATTACK · AFTER STEP ${active.n}`
              : `STEP ${active.n} / ${steps.length}`
            : `— / ${steps.length}`}
        </span>
        <button
          type="button"
          data-testid="mission-step-next"
          className={btn}
          disabled={stepIndex >= steps.length - 1}
          title="Next step (→)"
          onClick={() => seekTo(stepIndex + 1)}
        >
          Next ▶
        </button>
      </div>

      <ol className="space-y-1">
        {steps.map((s, i) => {
          const isActive = i === stepIndex;
          const done = i < stepIndex;
          const attack = s.kind === "attack";
          const frame = attack
            ? isActive
              ? "border-hostile-strong bg-hostile/15"
              : "border-transparent border-l-hostile-strong bg-hostile/10 hover:border-hostile-strong/40"
            : isActive
              ? "border-friendly-strong bg-paper"
              : "border-transparent hover:border-rule/40";
          return (
            <li
              key={`${s.kind ?? "procedure"}-${s.n}`}
              ref={isActive ? activeRef : undefined}
              data-testid={attack ? "mission-step-attack" : `mission-step-${s.n}`}
              data-kind={s.kind ?? "procedure"}
              aria-current={isActive ? "step" : undefined}
              className={`border ${frame}`}
              style={isActive || attack ? { borderLeftWidth: 4 } : undefined}
            >
              <button
                type="button"
                className="flex w-full items-baseline gap-2 px-2 py-1 text-left leading-snug"
                title={
                  attack
                    ? `Seek to the attack after step ${s.n} (T+${formatClock(s.tS)})`
                    : `Seek to step ${s.n} (T+${formatClock(s.tS)})`
                }
                onClick={() => seekTo(i)}
              >
                <span
                  className={`w-6 shrink-0 text-right font-[family-name:var(--font-data)] text-xs ${
                    attack ? "font-bold text-hostile-strong" : "text-ink-muted"
                  }`}
                >
                  {attack ? "!" : s.n}
                </span>
                <span
                  className={`flex-1 ${isActive ? "text-base" : ""} ${attack ? "font-bold text-hostile-strong" : ""} ${
                    isActive ? "font-bold" : done && !attack ? "text-ink-muted" : ""
                  }`}
                >
                  {attack ? `ATTACK · ${s.title}` : s.title}
                </span>
                <span className="font-[family-name:var(--font-data)] text-xs text-ink-muted">
                  {done ? "✓" : formatClock(s.tS).slice(0, 5)}
                </span>
              </button>

              {isActive ? (
                <div className="px-2 pb-2 pl-10">
                  <div
                    className="mb-1.5 h-1 w-full bg-paper-alt"
                    role="progressbar"
                    aria-label={`Step ${s.n} progress`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress * 100)}
                  >
                    <div
                      className={`h-full ${attack ? "bg-hostile-strong" : "bg-friendly-strong"}`}
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                  {s.detail ? <p className="mb-1.5 leading-snug">{s.detail}</p> : null}
                  {s.watch && s.watch.length > 0 ? (
                    <>
                      <div className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-muted">
                        Watch
                      </div>
                      <ul data-testid="mission-step-watch" className="flex flex-wrap gap-1">
                        {s.watch.map((w) => (
                          <li
                            key={w}
                            className="border border-rule/50 bg-paper-alt px-1.5 py-0.5 text-xs"
                          >
                            {w}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

import { availableTimelines, playback, RATES, usePlayback } from "../anim";

/** T+mm:ss.s, for the monospace telemetry readout. */
export function formatClock(tS: number): string {
  const tenths = Math.max(0, Math.floor(tS * 10 + 1e-6));
  const m = Math.floor(tenths / 600);
  const s = Math.floor((tenths % 600) / 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${tenths % 10}`;
}

const btn =
  "border border-rule bg-paper px-2 py-0.5 text-xs font-bold uppercase hover:bg-paper-alt focus-visible:outline-2 focus-visible:outline-friendly-strong";

/** Play / pause / restart / scrub / speed / timeline picker (SPEC §7, left panel). */
export function PlaybackControls() {
  const timelineId = usePlayback((s) => s.timelineId);
  const label = usePlayback((s) => s.label);
  const playing = usePlayback((s) => s.playing);
  const rate = usePlayback((s) => s.rate);
  const tS = usePlayback((s) => s.tS);
  const durationS = usePlayback((s) => s.durationS);
  const loop = usePlayback((s) => s.loop);
  const ended = usePlayback((s) => s.ended);
  const options = availableTimelines(import.meta.env.DEV);

  return (
    <section
      data-testid="playback"
      aria-label="Playback"
      className="mt-3 border-t border-rule pt-2"
    >
      <h3 className="mb-1 text-[10px] font-bold uppercase tracking-wider">Playback</h3>

      <label className="mb-1.5 block text-[10px] uppercase text-ink-muted">
        Timeline
        <select
          data-testid="playback-timeline"
          className="mt-0.5 block w-full border border-rule bg-paper px-1 py-0.5 text-xs text-ink"
          value={timelineId}
          onChange={(e) => {
            const next = options.find((t) => t.id === e.target.value);
            if (next) playback.load(next);
          }}
        >
          {options.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <div className="mb-1.5 flex items-center gap-1">
        <button
          type="button"
          data-testid="playback-toggle"
          className={btn}
          aria-pressed={playing}
          onClick={() => playback.toggle()}
        >
          {playing ? "Pause" : ended ? "Replay" : "Play"}
        </button>
        <button type="button" className={btn} onClick={() => playback.restart()}>
          Restart
        </button>
        <label className="ml-auto flex items-center gap-1 text-[10px] uppercase text-ink-muted">
          Speed
          <select
            data-testid="playback-rate"
            className="border border-rule bg-paper px-0.5 py-0.5 font-[family-name:var(--font-data)] text-xs text-ink"
            value={rate}
            onChange={(e) => playback.setRate(Number(e.target.value))}
          >
            {RATES.map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
        </label>
      </div>

      <input
        data-testid="playback-scrub"
        aria-label={`Scrub ${label}`}
        type="range"
        className="w-full accent-friendly-strong"
        min={0}
        max={durationS}
        step={0.1}
        value={tS}
        onChange={(e) => playback.seek(Number(e.target.value))}
      />
      <div
        data-testid="playback-clock"
        className="flex justify-between font-[family-name:var(--font-data)] text-[11px]"
      >
        <span>T+{formatClock(tS)}</span>
        <span className="text-ink-muted">
          {formatClock(durationS)}
          {loop ? " · LOOP" : ""}
        </span>
      </div>
    </section>
  );
}

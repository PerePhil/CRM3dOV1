import { usePlayback } from "../anim";

/**
 * Timeline captions (SPEC §8.4 callout style), stacked at the top of the viewport. Renders
 * nothing when no caption cue is active, so the idle slide stays clean.
 */
export function CaptionOverlay() {
  const captions = usePlayback((s) => s.discrete.captions);
  if (captions.length === 0) return null;
  return (
    <div
      data-testid="captions"
      aria-live="polite"
      className="pointer-events-none absolute top-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1"
    >
      {captions.map((text) => (
        <div
          key={text}
          className="border border-rule bg-paper/95 px-2 py-0.5 text-[11px] font-bold shadow-sm"
        >
          {text}
        </div>
      ))}
    </div>
  );
}

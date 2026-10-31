/**
 * Classification-style banner (SPEC §8.4). Always this exact text: the project is
 * open-source-only and notional (SPEC §10). Do not change the marking.
 */
export const BANNER_TEXT = "UNCLASSIFIED // NOTIONAL — ACADEMIC USE";

export function ClassificationBanner({ position }: { position: "top" | "bottom" }) {
  return (
    <div
      role="note"
      aria-label={`classification banner ${position}`}
      data-testid={`banner-${position}`}
      className="bg-banner-unclass py-0.5 text-center text-xs font-bold tracking-widest text-banner-text"
    >
      {BANNER_TEXT}
    </div>
  );
}

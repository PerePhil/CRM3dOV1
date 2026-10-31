import { catalog } from "@ov1/catalog";
import { linkColorToken } from "../theme/tokens";

const AFFILIATIONS = [
  ["friendly", "Friendly"],
  ["hostile", "Hostile"],
  ["neutral", "Neutral"],
  ["unknown", "Unknown"],
] as const;

/** OV-1 legend box (SPEC §8.4). Will update live as scenarios add threats (backlog task). */
export function Legend() {
  return (
    <figure
      aria-label="Legend"
      data-testid="legend"
      className="absolute bottom-3 left-3 border border-rule bg-paper/95 p-2 text-[11px] shadow-sm"
    >
      <figcaption className="mb-1 border-b border-rule pb-0.5 font-bold uppercase">
        Legend
      </figcaption>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        {catalog.links.map((l) => (
          <div key={l.id} className="flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-5"
              style={{ background: `var(--color-${linkColorToken(l)})` }}
            />
            {l.label}
          </div>
        ))}
        {AFFILIATIONS.map(([a, label]) => (
          <div key={a} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 border border-rule"
              style={{ background: `var(--color-${a})` }}
            />
            {label}
          </div>
        ))}
      </div>
    </figure>
  );
}

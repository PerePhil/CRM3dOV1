import { catalog } from "@ov1/catalog";
import { linkColorToken } from "../theme/tokens";
import { useView } from "../view/viewStore";

const AFFILIATIONS = [
  ["friendly", "Friendly"],
  ["hostile", "Hostile"],
  ["neutral", "Neutral"],
  ["unknown", "Unknown"],
] as const;

/** OV-1 legend box (SPEC §8.4). Will update live as scenarios add threats (backlog task). */
export function Legend() {
  const open = useView((s) => s.legendOpen);
  if (!open) return null;
  return (
    <figure
      aria-label="Legend"
      data-testid="legend"
      className="absolute bottom-3 left-3 z-20 border border-rule bg-paper/95 px-3 py-2 text-sm shadow-sm"
    >
      <figcaption className="mb-1 border-b border-rule pb-0.5 font-bold uppercase">
        Legend
      </figcaption>
      <div className="grid grid-cols-2 gap-x-5 gap-y-1">
        {catalog.links.map((l) => (
          <div key={l.id} className="flex items-center gap-2">
            <span
              className="inline-block h-1 w-6"
              style={{ background: `var(--color-${linkColorToken(l)})` }}
            />
            {l.label}
          </div>
        ))}
        {AFFILIATIONS.map(([a, label]) => (
          <div key={a} className="flex items-center gap-2">
            <span
              className="inline-block h-3.5 w-3.5 border border-rule"
              style={{ background: `var(--color-${a})` }}
            />
            {label}
          </div>
        ))}
      </div>
    </figure>
  );
}

import { catalog } from "@ov1/catalog";
import { usePlayback } from "../anim";
import { linkColorToken } from "../theme/tokens";

/** Read-only live link states from the playing timeline (catalog default when untouched). */
export function LinksTable() {
  const states = usePlayback((s) => s.discrete.links);
  return (
    <table className="w-full text-sm">
      <tbody>
        {catalog.links.map((l) => {
          const state = states.get(l.id) ?? l.defaultState;
          const changed = state !== l.defaultState;
          return (
            <tr key={l.id} className="border-b border-rule/30">
              <td className="py-1.5 font-bold">
                <span
                  aria-hidden
                  className="mr-2 inline-block h-1 w-5 align-middle"
                  style={{ background: `var(--color-${linkColorToken(l)})` }}
                />
                {l.label}
              </td>
              <td
                data-testid={`link-state-${l.id}`}
                className={`py-1.5 text-right font-[family-name:var(--font-data)] ${
                  changed ? "font-bold underline" : "text-ink-muted"
                }`}
              >
                {state}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

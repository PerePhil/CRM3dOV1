import { catalog } from "@ov1/catalog";
import { usePlayback } from "../anim";

/** Read-only live link states from the playing timeline (catalog default when untouched). */
export function LinksTable() {
  const states = usePlayback((s) => s.discrete.links);
  return (
    <table className="w-full text-xs">
      <tbody>
        {catalog.links.map((l) => (
          <tr key={l.id} className="border-b border-rule/30">
            <td className="py-1 font-bold">{l.label}</td>
            <td
              data-testid={`link-state-${l.id}`}
              className="py-1 text-right font-[family-name:var(--font-data)]"
            >
              {states.get(l.id) ?? l.defaultState}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

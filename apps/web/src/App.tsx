import { catalog } from "@ov1/catalog";
import { ClassificationBanner } from "./components/ClassificationBanner";
import { Legend } from "./components/Legend";
import { Panel } from "./components/Panel";
import { TitleBlock } from "./components/TitleBlock";
import { Ov1Scene } from "./scene/Ov1Scene";

/**
 * v0 layout skeleton (SPEC §7): banner / title block / [scenario panel | viewport | controls panel] / banner.
 * Panels are read-only catalog listings until the M1 tasks wire in state + sim.
 */
export function App() {
  return (
    <div className="flex h-full flex-col">
      <ClassificationBanner position="top" />

      <TitleBlock operation="CONTESTED // OV-1" scenarioId="—" seed={null} />

      <main className="grid min-h-0 flex-1 grid-cols-[16rem_1fr_16rem] gap-0 border-y border-rule">
        <Panel title="Scenario" side="left">
          <ul data-testid="scenario-list" className="space-y-1 text-sm">
            {catalog.scenarios.map((s) => (
              <li key={s.id} className="border border-rule bg-paper px-2 py-1">
                <span className="font-bold">{s.id}</span> {s.name}
              </li>
            ))}
          </ul>
        </Panel>

        <section
          aria-label="OV-1 viewport"
          className="relative min-h-0"
          style={{
            background:
              "linear-gradient(to bottom, var(--color-sky-top), var(--color-sky-bottom) 70%)",
          }}
        >
          <Ov1Scene />
          <Legend />
        </section>

        <Panel title="Links" side="right">
          <table className="w-full text-xs">
            <tbody>
              {catalog.links.map((l) => (
                <tr key={l.id} className="border-b border-rule/30">
                  <td className="py-1 font-bold">{l.label}</td>
                  <td className="py-1 text-right font-[family-name:var(--font-data)]">
                    {l.defaultState}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </main>

      <ClassificationBanner position="bottom" />
    </div>
  );
}

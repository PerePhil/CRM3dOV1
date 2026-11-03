import { CaptionOverlay } from "./components/CaptionOverlay";
import { ClassificationBanner } from "./components/ClassificationBanner";
import { Disclaimer } from "./components/Disclaimer";
import { Legend } from "./components/Legend";
import { Panel } from "./components/Panel";
import { TitleBlock } from "./components/TitleBlock";
import { LinksTable } from "./panels/LinksTable";
import { PlaybackControls } from "./panels/PlaybackControls";
import { ScenarioList } from "./panels/ScenarioList";
import { Ov1Scene } from "./scene/Ov1Scene";

/**
 * v0 layout skeleton (SPEC §7): banner / title block / [scenario panel | viewport | controls panel] / banner.
 * Scenario + playback drive the animation layer (anim/); other panels arrive with the M1 tasks.
 */
export function App() {
  return (
    <div className="flex h-full flex-col">
      <ClassificationBanner position="top" />

      <TitleBlock operation="CONTESTED // OV-1" scenarioId="—" seed={null} />

      <main className="grid min-h-0 flex-1 grid-cols-[16rem_1fr_16rem] gap-0 border-y border-rule">
        <Panel title="Scenario" side="left">
          <ScenarioList />
          <PlaybackControls />
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
          <CaptionOverlay />
          <Legend />
        </section>

        <Panel title="Links" side="right">
          <LinksTable />
        </Panel>
      </main>

      <Disclaimer />
      <ClassificationBanner position="bottom" />
    </div>
  );
}

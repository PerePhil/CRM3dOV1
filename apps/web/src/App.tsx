import { useEffect } from "react";
import { usePlayback } from "./anim";
import { CaptionOverlay } from "./components/CaptionOverlay";
import { ClassificationBanner } from "./components/ClassificationBanner";
import { Disclaimer } from "./components/Disclaimer";
import { Legend } from "./components/Legend";
import { Section } from "./components/Section";
import { TitleBlock } from "./components/TitleBlock";
import { ViewToolbar } from "./components/ViewToolbar";
import { LinksTable } from "./panels/LinksTable";
import { MissionSteps, useStepSummary } from "./panels/MissionSteps";
import { PlaybackControls } from "./panels/PlaybackControls";
import { ScenarioList } from "./panels/ScenarioList";
import { Ov1Scene } from "./scene/Ov1Scene";
import { usePresenterKeys } from "./view/usePresenterKeys";
import { TEXT_SCALES, useView } from "./view/viewStore";

/**
 * Layout (SPEC §7), tuned for a classroom projector: banner / title block / [viewport | side
 * panel] / banner. The single side panel keeps playback pinned on top and folds scenario, mission
 * steps, and links into collapsible sections. All UI and callout type is rem-sized, so the A−/A+
 * control (root font size) scales the whole briefing at once.
 */
export function App() {
  const scenarioId = usePlayback((s) => s.scenarioId);
  const sidebarOpen = useView((s) => s.sidebarOpen);
  const scaleIndex = useView((s) => s.textScaleIndex);
  const stepSummary = useStepSummary();
  usePresenterKeys();

  useEffect(() => {
    document.documentElement.style.fontSize = `${(TEXT_SCALES[scaleIndex] ?? 1) * 100}%`;
  }, [scaleIndex]);

  return (
    <div className="flex h-full flex-col">
      <ClassificationBanner position="top" />

      <TitleBlock operation="CONTESTED // OV-1" scenarioId={scenarioId ?? "—"} seed={null} />

      <main
        className={`grid min-h-0 flex-1 gap-0 border-y border-rule ${
          sidebarOpen ? "grid-cols-[1fr_min(30rem,36vw)]" : "grid-cols-[1fr]"
        }`}
      >
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
          <ViewToolbar />
        </section>

        {sidebarOpen ? (
          <aside
            aria-label="Briefing panel"
            data-testid="sidebar"
            className="flex min-h-0 flex-col border-l border-rule bg-paper-alt"
          >
            <div className="shrink-0 border-b border-rule bg-paper px-3 py-2">
              <PlaybackControls />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Section title="Scenario">
                <ScenarioList />
              </Section>
              <Section title="Mission Steps" aside={stepSummary}>
                <MissionSteps />
              </Section>
              <Section title="Links" defaultOpen={false}>
                <LinksTable />
              </Section>
            </div>
          </aside>
        ) : null}
      </main>

      <Disclaimer />
      <ClassificationBanner position="bottom" />
    </div>
  );
}

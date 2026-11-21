import type { ReactNode } from "react";
import { TEXT_SCALES, useView, view } from "../view/viewStore";

const btn =
  "border border-rule bg-paper px-2.5 py-1 text-sm font-bold uppercase hover:bg-paper-alt focus-visible:outline-2 focus-visible:outline-friendly-strong aria-pressed:bg-friendly-strong aria-pressed:text-paper";

function Group(props: { label: string; children: ReactNode }) {
  return (
    <fieldset aria-label={props.label} className="m-0 flex items-center border-0 p-0">
      {props.children}
    </fieldset>
  );
}

/**
 * Presenter controls over the viewport: camera mode, legend, focus dimming, text size, and the
 * sidebar. Every button has a keyboard shortcut (usePresenterKeys) shown in its tooltip.
 */
export function ViewToolbar() {
  const mode = useView((s) => s.cameraMode);
  const legend = useView((s) => s.legendOpen);
  const dim = useView((s) => s.focusDim);
  const sidebar = useView((s) => s.sidebarOpen);
  const scaleIndex = useView((s) => s.textScaleIndex);
  return (
    <div
      data-testid="view-toolbar"
      className="absolute top-3 right-3 z-20 flex flex-wrap items-center justify-end gap-2"
    >
      <Group label="Camera">
        <button
          type="button"
          data-testid="camera-track"
          className={btn}
          aria-pressed={mode === "track"}
          title="Follow the UAV (T)"
          onClick={() => view.toggleCameraMode("track")}
        >
          Track UAV
        </button>
        <button
          type="button"
          data-testid="camera-orbit"
          className={`${btn} border-l-0`}
          aria-pressed={mode === "orbit"}
          title="Follow the UAV and slowly circle it (O)"
          onClick={() => view.toggleCameraMode("orbit")}
        >
          Orbit
        </button>
        <button
          type="button"
          data-testid="camera-reset"
          className={`${btn} border-l-0`}
          title="Back to the slide view (R)"
          onClick={() => view.resetView()}
        >
          Reset
        </button>
      </Group>
      <Group label="Display">
        <button
          type="button"
          className={btn}
          aria-pressed={legend}
          title="Show or hide the legend (L)"
          onClick={() => view.toggle("legendOpen")}
        >
          Legend
        </button>
        <button
          type="button"
          data-testid="focus-dim"
          className={`${btn} border-l-0`}
          aria-pressed={dim}
          title="Fade what the playing scenario doesn't involve (D)"
          onClick={() => view.toggle("focusDim")}
        >
          Focus
        </button>
      </Group>
      <Group label="Text size">
        <button
          type="button"
          data-testid="text-smaller"
          className={btn}
          disabled={scaleIndex <= 0}
          title="Smaller text (−)"
          onClick={() => view.stepTextScale(-1)}
        >
          A−
        </button>
        <span className="border-y border-rule bg-paper px-2 py-1 font-[family-name:var(--font-data)] text-sm">
          {Math.round((TEXT_SCALES[scaleIndex] ?? 1) * 100)}%
        </span>
        <button
          type="button"
          data-testid="text-larger"
          className={btn}
          disabled={scaleIndex >= TEXT_SCALES.length - 1}
          title="Larger text (+)"
          onClick={() => view.stepTextScale(1)}
        >
          A+
        </button>
      </Group>
      <button
        type="button"
        data-testid="sidebar-toggle"
        className={btn}
        aria-pressed={!sidebar}
        title="Hide or show the side panel (P)"
        onClick={() => view.toggle("sidebarOpen")}
      >
        {sidebar ? "Hide panel ▸" : "◂ Panel"}
      </button>
    </div>
  );
}

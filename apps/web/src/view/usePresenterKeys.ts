import { useEffect } from "react";
import { playback } from "../anim";
import { view } from "./viewStore";

/** Mission step index to seek to for "previous" / "next", or undefined at either end. */
export function stepTarget(stepIndex: number, stepCount: number, dir: 1 | -1): number | undefined {
  const i = stepIndex + dir;
  return i >= 0 && i < stepCount ? i : undefined;
}

function presenterAction(key: string, seekStep: (dir: 1 | -1) => void): (() => void) | undefined {
  switch (key) {
    case " ":
      return () => playback.toggle();
    case "ArrowRight":
      return () => seekStep(1);
    case "ArrowLeft":
      return () => seekStep(-1);
    case "t":
      return () => view.toggleCameraMode("track");
    case "o":
      return () => view.toggleCameraMode("orbit");
    case "r":
      return () => view.resetView();
    case "p":
      return () => view.toggle("sidebarOpen");
    case "l":
      return () => view.toggle("legendOpen");
    case "d":
      return () => view.toggle("focusDim");
    case "+":
    case "=":
      return () => view.stepTextScale(1);
    case "-":
      return () => view.stepTextScale(-1);
    default:
      return undefined;
  }
}

/**
 * Presenter shortcuts, so the briefer can drive the OV-1 from a clicker or keyboard:
 *   Space play/pause · ← → previous/next mission step · T track UAV · O orbit · R reset view ·
 *   P side panel · L legend · D focus dimming · + / − text size.
 * Ignored while typing in a form field, and with Ctrl/Cmd/Alt held.
 */
export function usePresenterKeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, select, textarea, [contenteditable]")) return;
      const steps = playback.timeline.steps ?? [];
      const seekStep = (dir: 1 | -1) => {
        const i = stepTarget(playback.frame.stepIndex, steps.length, dir);
        const s = i === undefined ? undefined : steps[i];
        if (s) playback.seek(s.tS);
      };
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const act = presenterAction(key, seekStep);
      if (!act) return;
      // Space on a focused button would also click it; one action per key press.
      e.preventDefault();
      act();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

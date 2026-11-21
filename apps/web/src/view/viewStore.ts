/**
 * Presentation-only UI state: camera mode, text size, panel visibility. Not sim or risk state,
 * and not playback (that lives in anim/playback). Framework-free so it's testable in Node;
 * React reads it through useView().
 */
import { useSyncExternalStore } from "react";

/**
 * - `free`: the user orbits by hand (default slide view).
 * - `track`: the camera follows the UAV, keeping whatever angle and zoom the user last set.
 * - `orbit`: follows the UAV and slowly circles it. Hands-free mode for a briefing.
 */
export type CameraMode = "free" | "track" | "orbit";
export const CAMERA_MODES: readonly CameraMode[] = ["free", "track", "orbit"];

/** Root font scale steps (rem multiplier). Everything in the UI and callouts is rem-sized. */
export const TEXT_SCALES = [1, 1.125, 1.25, 1.375, 1.5] as const;
/** Default step: 1.125 reads from the back of a classroom at 1080p without crowding the scene. */
export const DEFAULT_TEXT_SCALE_INDEX = 1;

export interface ViewState {
  cameraMode: CameraMode;
  /** Bumped on every "reset view" request; the camera rig eases back to the slide camera. */
  resetSeq: number;
  textScaleIndex: number;
  sidebarOpen: boolean;
  legendOpen: boolean;
  /** Fade nodes, links, and labels the playing scenario doesn't involve. */
  focusDim: boolean;
}

export interface ViewStore {
  get(): ViewState;
  subscribe(listener: () => void): () => void;
  setCameraMode(mode: CameraMode): void;
  /** Toggle between `mode` and free. */
  toggleCameraMode(mode: Exclude<CameraMode, "free">): void;
  resetView(): void;
  /** Step the text size; clamped to TEXT_SCALES. */
  stepTextScale(delta: number): void;
  toggle(key: "sidebarOpen" | "legendOpen" | "focusDim"): void;
}

const PERSIST_KEY = "ov1.view.v1";
type Persisted = Pick<ViewState, "textScaleIndex" | "legendOpen" | "focusDim">;

/** Storage that may be missing or throw (private mode, blocked site data, Node tests). */
export interface MaybeStorage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

function clampIndex(i: number): number {
  return Math.min(TEXT_SCALES.length - 1, Math.max(0, Math.round(i)));
}

export function createViewStore(storage?: MaybeStorage): ViewStore {
  let state: ViewState = {
    cameraMode: "free",
    resetSeq: 0,
    textScaleIndex: DEFAULT_TEXT_SCALE_INDEX,
    sidebarOpen: true,
    legendOpen: true,
    focusDim: true,
  };
  try {
    const raw = storage?.getItem(PERSIST_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Persisted>;
      if (typeof p.textScaleIndex === "number") state.textScaleIndex = clampIndex(p.textScaleIndex);
      if (typeof p.legendOpen === "boolean") state.legendOpen = p.legendOpen;
      if (typeof p.focusDim === "boolean") state.focusDim = p.focusDim;
    }
  } catch {
    // Unreadable storage: defaults are fine.
  }
  const listeners = new Set<() => void>();
  const set = (patch: Partial<ViewState>) => {
    state = { ...state, ...patch };
    try {
      const p: Persisted = {
        textScaleIndex: state.textScaleIndex,
        legendOpen: state.legendOpen,
        focusDim: state.focusDim,
      };
      storage?.setItem(PERSIST_KEY, JSON.stringify(p));
    } catch {
      // Not persisting is fine.
    }
    for (const l of listeners) l();
  };
  return {
    get: () => state,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    setCameraMode: (cameraMode) => set({ cameraMode }),
    toggleCameraMode: (mode) => set({ cameraMode: state.cameraMode === mode ? "free" : mode }),
    resetView: () => set({ cameraMode: "free", resetSeq: state.resetSeq + 1 }),
    stepTextScale: (d) => set({ textScaleIndex: clampIndex(state.textScaleIndex + d) }),
    toggle: (key) => set({ [key]: !state[key] }),
  };
}

function browserStorage(): MaybeStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export const view: ViewStore = createViewStore(browserStorage());

/** Subscribe to a primitive slice of the view state. */
export function useView<T extends string | number | boolean>(select: (s: ViewState) => T): T {
  return useSyncExternalStore(
    view.subscribe,
    () => select(view.get()),
    () => select(view.get()),
  );
}

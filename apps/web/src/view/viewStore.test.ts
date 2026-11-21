import { describe, expect, it } from "vitest";
import {
  createViewStore,
  DEFAULT_TEXT_SCALE_INDEX,
  type MaybeStorage,
  TEXT_SCALES,
} from "./viewStore";

function memory(): MaybeStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe("view store", () => {
  it("toggles camera modes against free and resets", () => {
    const v = createViewStore();
    v.toggleCameraMode("track");
    expect(v.get().cameraMode).toBe("track");
    v.toggleCameraMode("orbit");
    expect(v.get().cameraMode).toBe("orbit");
    v.toggleCameraMode("orbit");
    expect(v.get().cameraMode).toBe("free");
    v.setCameraMode("track");
    v.resetView();
    expect(v.get()).toMatchObject({ cameraMode: "free", resetSeq: 1 });
  });

  it("clamps the text scale", () => {
    const v = createViewStore();
    v.stepTextScale(99);
    expect(v.get().textScaleIndex).toBe(TEXT_SCALES.length - 1);
    v.stepTextScale(-99);
    expect(v.get().textScaleIndex).toBe(0);
  });

  it("persists text size and toggles, not camera mode", () => {
    const s = memory();
    const a = createViewStore(s);
    a.stepTextScale(1);
    a.toggle("legendOpen");
    a.setCameraMode("orbit");
    const b = createViewStore(s);
    expect(b.get()).toMatchObject({
      textScaleIndex: DEFAULT_TEXT_SCALE_INDEX + 1,
      legendOpen: false,
      cameraMode: "free",
    });
  });

  it("survives storage that throws or holds junk", () => {
    const bad: MaybeStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const v = createViewStore(bad);
    v.toggle("focusDim");
    expect(v.get().focusDim).toBe(false);
    const s = memory();
    s.data.set("ov1.view.v1", "{not json");
    expect(createViewStore(s).get().textScaleIndex).toBe(DEFAULT_TEXT_SCALE_INDEX);
  });
});

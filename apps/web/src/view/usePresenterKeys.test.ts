import { describe, expect, it } from "vitest";
import { stepTarget } from "./usePresenterKeys";

describe("stepTarget", () => {
  it("moves within bounds and stops at the ends", () => {
    expect(stepTarget(-1, 5, 1)).toBe(0);
    expect(stepTarget(2, 5, 1)).toBe(3);
    expect(stepTarget(4, 5, 1)).toBeUndefined();
    expect(stepTarget(0, 5, -1)).toBeUndefined();
    expect(stepTarget(3, 0, 1)).toBeUndefined();
  });
});

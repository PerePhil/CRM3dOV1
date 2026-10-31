/**
 * @ov1/risk: FAIR Monte Carlo engine (SPEC §3.3, §6.4–6.5).
 * Skeleton: distributions + summaries. LEF/LM/ALE/ROSI arrive via backlog tasks.
 */
export * from "./distributions";
export * from "./summary";

/** Return on security investment (SPEC §6.5). */
export const rosi = (aleBefore: number, aleAfter: number, controlCost: number): number => {
  if (!(controlCost > 0)) throw new Error("rosi: controlCost must be > 0");
  return (aleBefore - aleAfter - controlCost) / controlCost;
};

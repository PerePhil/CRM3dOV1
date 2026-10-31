/** Summary statistics for Monte Carlo output (ALE percentiles, LEC). */

export interface Summary {
  n: number;
  mean: number;
  p10: number;
  p50: number;
  p90: number;
  p99: number;
}

/** Linear-interpolated quantile of an already-sorted array (q in [0, 1]). */
export function quantileSorted(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) throw new Error("quantileSorted: empty input");
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (b - a) * (pos - lo);
}

export function summarize(samples: readonly number[]): Summary {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = sorted.reduce((s, x) => s + x, 0) / sorted.length;
  return {
    n: sorted.length,
    mean,
    p10: quantileSorted(sorted, 0.1),
    p50: quantileSorted(sorted, 0.5),
    p90: quantileSorted(sorted, 0.9),
    p99: quantileSorted(sorted, 0.99),
  };
}

/**
 * Loss exceedance curve: for each threshold x, P(loss > x).
 * Returns points sorted by ascending loss, suitable for plotting.
 */
export function lossExceedance(
  samples: readonly number[],
  points = 100,
): { loss: number; pExceed: number }[] {
  const sorted = [...samples].sort((a, b) => a - b);
  return Array.from({ length: points }, (_, i) => {
    const q = i / (points - 1);
    const loss = quantileSorted(sorted, q);
    return { loss, pExceed: 1 - q };
  });
}

/**
 * Sampling distributions for the FAIR engine (SPEC §3.3).
 * Every sampler takes an explicit Rng, so results are reproducible from a seed.
 */
import type { Rng } from "@ov1/core";

export interface PertParams {
  min: number;
  ml: number;
  max: number;
}

/** Default Beta-PERT shape parameter (SPEC §3.3). */
export const PERT_GAMMA = 4;

/** Standard normal via Box–Muller. Uses (0, 1] to avoid log(0). */
export function sampleStdNormal(rng: Rng): number {
  const u1 = 1 - rng.next();
  const u2 = rng.next();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Gamma(shape, 1) via Marsaglia–Tsang (2000). Boosted for shape < 1. */
export function sampleGamma(rng: Rng, shape: number): number {
  if (!(shape > 0)) throw new Error(`sampleGamma: shape must be > 0, got ${shape}`);
  if (shape < 1) {
    const u = 1 - rng.next();
    return sampleGamma(rng, shape + 1) * u ** (1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const x = sampleStdNormal(rng);
    const v0 = 1 + c * x;
    if (v0 <= 0) continue;
    const v = v0 * v0 * v0;
    const u = 1 - rng.next();
    if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
  }
}

export function sampleBeta(rng: Rng, alpha: number, beta: number): number {
  const x = sampleGamma(rng, alpha);
  const y = sampleGamma(rng, beta);
  return x / (x + y);
}

export function pertShape({ min, ml, max }: PertParams, gamma = PERT_GAMMA) {
  const range = max - min;
  return {
    alpha: 1 + (gamma * (ml - min)) / range,
    beta: 1 + (gamma * (max - ml)) / range,
  };
}

/** Analytic mean of Beta-PERT. */
export const pertMean = ({ min, ml, max }: PertParams, gamma = PERT_GAMMA): number =>
  (min + gamma * ml + max) / (gamma + 2);

/** Analytic variance of Beta-PERT. */
export function pertVariance(p: PertParams, gamma = PERT_GAMMA): number {
  const mu = pertMean(p, gamma);
  return ((mu - p.min) * (p.max - mu)) / (gamma + 3);
}

export function samplePert(rng: Rng, p: PertParams, gamma = PERT_GAMMA): number {
  if (!(p.min <= p.ml && p.ml <= p.max)) {
    throw new Error(`samplePert: need min <= ml <= max, got ${JSON.stringify(p)}`);
  }
  if (p.max === p.min) return p.min;
  const { alpha, beta } = pertShape(p, gamma);
  return p.min + (p.max - p.min) * sampleBeta(rng, alpha, beta);
}

/** Lognormal with the given log-space mean and standard deviation. */
export const sampleLognormal = (rng: Rng, mu: number, sigma: number): number =>
  Math.exp(mu + sigma * sampleStdNormal(rng));

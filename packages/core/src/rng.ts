/**
 * FROZEN CONTRACT (SPEC §3.2). Changing this file changes every simulation and risk result.
 * Edits require a `contract`-labeled task and a SPEC.md update in the same PR.
 *
 * Seeded PRNG: xoshiro128** (Blackman & Vigna), state seeded via splitmix32.
 * Same seed → same sequence, on every platform, in Node and in Web Workers.
 */

export interface Rng {
  /** The seed this stream was created from. */
  readonly seed: number;
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform unsigned 32-bit integer. */
  nextUint32(): number;
  /** Uniform float in [min, max). */
  uniform(min: number, max: number): number;
  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /**
   * Independent child stream derived from (this seed, label). Order-independent:
   * `rng.fork(i)` is the same no matter how many numbers the parent has drawn,
   * so Monte Carlo trial i is reproducible and trials can run in parallel workers.
   */
  fork(label: string | number): Rng;
}

const UINT32 = 0x1_0000_0000;

function splitmix32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    t = t ^ (t >>> 15);
    return t >>> 0;
  };
}

/** FNV-1a 32-bit hash, used to derive fork seeds from labels. */
export function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const rotl = (x: number, k: number): number => (x << k) | (x >>> (32 - k));

export function createRng(seed: number): Rng {
  if (!Number.isFinite(seed)) throw new Error(`createRng: seed must be finite, got ${seed}`);
  const normalizedSeed = Math.trunc(seed) >>> 0;
  const sm = splitmix32(normalizedSeed);
  let s0 = sm();
  let s1 = sm();
  let s2 = sm();
  let s3 = sm();
  if ((s0 | s1 | s2 | s3) === 0) s0 = 1; // all-zero state is invalid for xoshiro

  const nextUint32 = (): number => {
    const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0;
    const t = s1 << 9;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3, 11);
    return result;
  };

  const next = (): number => nextUint32() / UINT32;

  return {
    seed: normalizedSeed,
    next,
    nextUint32,
    uniform: (min, max) => min + (max - min) * next(),
    int: (min, max) => {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new Error(`rng.int: invalid range [${min}, ${max}]`);
      }
      return min + Math.floor(next() * (max - min + 1));
    },
    fork: (label) => createRng(hash32(`${normalizedSeed}:${String(label)}`)),
  };
}

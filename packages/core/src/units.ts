/** SI units internally (SPEC §3.2). Helpers for the dB math in SPEC §6.1. */

/** Speed of light in vacuum, m/s. */
export const C_M_PER_S = 299_792_458;

export const dbToLinear = (db: number): number => 10 ** (db / 10);
export const linearToDb = (ratio: number): number => 10 * Math.log10(ratio);
export const wattsToDbw = (watts: number): number => 10 * Math.log10(watts);
export const dbwToWatts = (dbw: number): number => 10 ** (dbw / 10);

export const degToRad = (deg: number): number => (deg * Math.PI) / 180;
export const radToDeg = (rad: number): number => (rad * 180) / Math.PI;

/** Clamp x into [lo, hi]. */
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

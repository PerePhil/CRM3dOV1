/**
 * OV-1 diorama layout (SPEC §8.1). These are RENDER positions in compressed diorama units,
 * not sim positions. The sim works in SI meters and the scene maps sim → diorama.
 * Every catalog node must have an entry (enforced by layout.test.ts).
 */
/** Mutable tuple on purpose: R3F position/args props reject readonly tuples. */
export type Vec3 = [number, number, number];

export const NODE_LAYOUT: Readonly<Record<string, Vec3>> = {
  "N-UAV": [2, 5.5, 0],
  "N-GCS": [-6, 1.6, 4],
  "N-MX": [-9.2, 1.6, 4.2],
  "N-C2": [-12, 1.2, -7],
  "N-SUP": [-16, 0.9, -9.5],
  "N-SAT": [-3, 13, -11],
  "N-GNSS": [8, 14.5, -13],
  "N-ADV-JAM": [10, 1.0, 6],
  "N-ADV-SPOOF": [14, 1.0, -1],
  "N-ADV-CYBER": [16, 1.0, -8],
};

/** Scenery that isn't a catalog node (carrier hull, land masses). */
export const SCENERY = {
  carrier: { position: [-7, 0.4, 4] as Vec3, size: [8, 0.8, 2] as Vec3 },
  friendlyLand: { position: [-13, 0.05, -9] as Vec3, size: [16, 0.1, 10] as Vec3 },
  hostileLand: { position: [15, 0.05, -5] as Vec3, size: [8, 0.1, 12] as Vec3 },
  ocean: { size: [70, 50] as [number, number] },
} as const;

/** Default camera: the classic three-quarter OV-1 "slide" view (SPEC §7). */
export const SLIDE_CAMERA = {
  position: [17, 17, 27] as Vec3,
  target: [0, 3.5, -2] as Vec3,
  fov: 40,
} as const;

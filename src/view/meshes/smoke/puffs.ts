// What every chimney's smoke shares (the houses': houseSmoke.ts; the
// forge's: building/smoke.ts): a puff's shape, a little rounded blob of
// voxels (no corners: it reads as smoke, not a stone), and where a puff is
// `t` of the way through its life: risen from the chimney's mouth, leaning
// off downwind more as it goes (the wind's strength and its gusts), swaying,
// swelling as it rises and thinning away at the last.

import * as THREE from 'three';
import { greedyMesh } from '../voxel/greedyMesh';
import { createGrid, setColor } from '../voxel/voxelShapes';

const R = 2; // the blob's voxels out from its middle
const SIDE = R * 2 + 1;

// A puff of unit size: a ball of voxels, its middle at (0, 0, 0).
export function puffGeometry(): THREE.BufferGeometry {
  const grid = createGrid([SIDE, SIDE, SIDE]);
  for (let x = 0; x < SIDE; x++) {
    for (let y = 0; y < SIDE; y++) for (let z = 0; z < SIDE; z++) if (Math.hypot(x - R, y - R, z - R) <= R + 0.5) setColor(grid, x, y, z, 1);
  }
  return greedyMesh(grid, [0xffffff], 1 / SIDE, new THREE.Vector3(-0.5, -0.5, -0.5));
}

export interface Draft {
  rise: number; // world units risen over a lifetime
  lean: number; // world units blown downwind over a lifetime, in a full wind
  size: number; // world units across at its biggest
}

// Where a puff `t` (0..1) through its life is, from `mouth`, in `wind` (x, z: which way; strength 0..1), at `time`
// seconds (its sway), into `at`; returns how big it is.
export function puffAt(at: THREE.Vector3, mouth: THREE.Vector3, t: number, wind: { x: number; z: number; strength: number }, time: number, phase: number, draft: Draft): number {
  const lean = draft.lean * wind.strength * t * (0.3 + 0.7 * t);
  const sway = Math.sin(time * 1.3 + phase * 20 + t * 4) * 0.06 * t;
  at.set(mouth.x + wind.x * lean - wind.z * sway, mouth.y + draft.rise * t * (1 - wind.strength * 0.35), mouth.z + wind.z * lean + wind.x * sway);
  return draft.size * (0.25 + 0.75 * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5)) * (1 - t ** 4); // (swelling fast, then thinning away)
}

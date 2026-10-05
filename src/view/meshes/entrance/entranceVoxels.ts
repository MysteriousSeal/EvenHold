// What marks a dungeon's way in out in the world (entranceDressing.ts sets them
// down, entranceLife.ts moves them), in voxels, palette first:
// - a bat: a dark silhouette, all wingspan (seen from above against the grass:
//   it's the movement that's caught, the shape only has to read as a bat);
// - a crow: glossy black, a blue-grey sheen on its back, a dark beak, a pale eye;
// - a brazier: an iron bowl on three legs, a ring of rivets, coals in it (its
//   fire's the fire effect's, from dusk to dawn);
// - the glow a way in throws on the ground before it: the sun pool's shape
//   (cave/sunPoolVoxels.ts), its bands in teal for a cave, cold blue for a crypt.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, setColor } from '../voxel/voxelShapes';

export const BAT_PALETTE = [0x2a2024, 0x3e2e30, 0x5a3e3a]; // body, wing, wing lit
export function batGrid(): VoxelGrid {
  const g = createGrid([11, 1, 4]);
  const rows = ['  w     w  ', ' wwW bWwww ', 'wwWWbbbWWww', 'w  W b W  w'].reverse(); // (its trailing edge scalloped; its head forward, +z)
  rows.forEach((row, z) => [...row].forEach((c, x) => c !== ' ' && setColor(g, x, 0, z, c === 'b' ? 1 : c === 'W' ? 3 : 2)));
  return g;
}

export const CROW_PALETTE = [0x1c1b22, 0x2e3240, 0x4a4e5c, 0x34302c, 0xd8d0b8]; // black, sheen, wing edge, beak, eye
export function crowGrid(): VoxelGrid {
  const g = createGrid([3, 4, 7]);
  const set = (x: number, y: number, z: number, c: number) => setColor(g, x, y, z, c);
  for (let z = 1; z <= 4; z++) for (let x = 0; x <= 2; x++) for (let y = 1; y <= 2; y++) set(x, y, z, y === 2 && x === 1 ? 2 : 1); // its body, its back sheened
  for (const x of [0, 2]) for (let z = 1; z <= 3; z++) set(x, 2, z, 3); // its folded wings' edges
  set(1, 0, 3, 4); // a leg
  for (let x = 0; x <= 2; x++) for (let y = 2; y <= 3; y++) set(x, y, 5, 1); // its head
  set(0, 3, 5, 5); // the eyes
  set(2, 3, 5, 5);
  set(1, 2, 6, 4); // its beak
  for (let z = 0; z <= 1; z++) set(1, 2 - z, z === 0 ? 0 : 1, 1); // its tail, down behind
  set(1, 1, 0, 1);
  return g;
}

export const BRAZIER_PALETTE = [0x3e4246, 0x5a5e62, 0x2a2c2e, 0x7a4a32, 0xff9a40]; // iron, its rim, shadow, rust, coals (glowing)
export const BRAZIER_GLOW = 5;
export const BRAZIER_GRID: [number, number, number] = [7, 9, 7];
export function brazierGrid(): VoxelGrid {
  const g = createGrid(BRAZIER_GRID);
  const set = (x: number, y: number, z: number, c: number) => setColor(g, x, y, z, c);
  for (const [x, z] of [[0, 3], [5, 0], [5, 6]]) for (let y = 0; y <= 5; y++) set(x + (y > 3 ? (x === 0 ? 1 : -1) : 0), y, z + (y > 3 ? (z === 0 ? 1 : z === 6 ? -1 : 0) : 0), y === 0 ? 3 : 1); // three legs, splayed
  for (let x = 0; x < 7; x++) for (let z = 0; z < 7; z++) {
    const r = Math.hypot(x - 3, z - 3);
    if (r <= 3.2) set(x, 6, z, r > 2.4 ? 2 : 3); // the bowl
    if (r > 2.4 && r <= 3.2) set(x, 7, z, (x + z) % 3 === 0 ? 4 : 2); // its rim, a rivet or a rust spot here and there
    if (r <= 2.2) set(x, 7, z, BRAZIER_GLOW); // the coals
  }
  return g;
}

// The glow's bands (the sun pool's shape), dimmest first: a cave's teal, a crypt's cold blue.
export const CAVE_GLOW = [0x08201c, 0x10382f, 0x1c5a4a, 0x2e8a72, 0x48c0a0];
export const CRYPT_GLOW = [0x0c1424, 0x16243e, 0x24406a, 0x3a64a0, 0x6a9ad8];

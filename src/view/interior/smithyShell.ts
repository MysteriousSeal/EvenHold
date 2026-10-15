// The smithy's own shell (roomVoxels.ts builds it for a room with a forge): cold, sooty stone round one hot heart.
// Its flags and walls darker and cooler than a house's, the walls blackened over their top third, a plume of soot up
// the back wall behind the forge's flue; on the floor, soot thinning out from the forge's foot (cinders by its mouth),
// a ring of mill scale round the anvil, coal dust round the heap. Single voxels, graded, never a decal.

import type { Furniture } from '../../model/interiors/furniture';
import { COAL, CINDER, PLUME, SCALE, SMITHY_FLAG, SMITHY_FLAG_DARK, SMITHY_FLAG_MORTAR, SMITHY_MORTAR, SMITHY_STONE, SMITHY_STONE_DARK, SOOT, SOOT_LIGHT } from './furniturePalette';

const TILE = 25;

// A quick integer hash, and one in 0..1.
const hash = (a: number, b: number) => ((a * 73856093) ^ (b * 19349663)) >>> 0;
const unit = (a: number, b: number, salt: number) => (hash(a * 31 + salt, b * 17 - salt) % 1000) / 1000;

// The floor at voxel (x, z): flagstones 10-14 across in staggered rows, dark mortar between.
export function smithyFloor(x: number, z: number): number {
  const row = Math.floor(z / 12);
  const shifted = x + (row % 2) * 7;
  if (z % 12 === 0 || shifted % 14 === 0) return SMITHY_FLAG_MORTAR;
  return (row * 7 + Math.floor(shifted / 14) * 3) % 3 === 0 ? SMITHY_FLAG_DARK : SMITHY_FLAG;
}

// A wall at voxel (u along it, y up), `high` voxels tall: coursed stone over a sooty skirting, its top third
// blackened, the line ragged.
export function smithyWall(u: number, y: number, high: number): number {
  if (y < 3) return SOOT;
  if (y >= Math.floor((high * 2) / 3) - (hash(Math.floor(u / 2), 9) % 4)) return hash(u, y) % 9 === 0 ? SOOT : SOOT_LIGHT;
  const course = Math.floor(y / 4);
  if (y % 4 === 0) return SMITHY_MORTAR;
  const shifted = u + course * 5;
  const width = 6 + (course % 3);
  if (shifted % width === 0) return SMITHY_MORTAR;
  return [SMITHY_STONE, SMITHY_STONE_DARK, SMITHY_STONE, SMITHY_STONE_DARK][hash(Math.floor(shifted / width), course) % 4];
}

type Fill = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number) => void;

// What the work leaves, over the floor (y 0, from (x0, z0) in the grid) and up the back wall (z < z0): `high` its
// height, `w` and `d` the floor's size in voxels.
export function smithySoot(fill: Fill, furniture: readonly Furniture[], x0: number, z0: number, w: number, d: number, high: number): void {
  const fleck = (x: number, z: number, c: number) => x >= 0 && z >= 0 && x < w && z < d && fill(x0 + x, 0, z0 + z, x0 + x, 0, z0 + z, c);
  // Single flecks round (cx, cz), `thick` of the floor at its middle thinning to none `r` out.
  const scatter = (cx: number, cz: number, r: number, thick: number, salt: number, color: (x: number, z: number, near: number) => number) => {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      for (let z = Math.floor(cz - r); z <= cz + r; z++) {
        const near = 1 - Math.hypot(x - cx, z - cz) / r;
        if (near > 0 && unit(x, z, salt) < thick * near) fleck(x, z, color(x, z, near));
      }
    }
  };
  const forge = furniture.find((f) => f.kind === 'forge');
  if (forge) {
    const mid = forge.x * TILE + (forge.w * TILE) / 2;
    scatter(mid, 17, TILE * 1.5, 0.35, 1, (x, z, near) => (near > 0.7 && unit(x, z, 2) < 0.25 ? CINDER : unit(x, z, 3) < 0.5 ? SOOT : SOOT_LIGHT)); // its foot
    // The plume up the back wall from over the hood, three tiles wide, narrowing as it climbs, its edge ragged.
    for (let y = 18; y < high; y++) {
      const half = TILE * 1.5 * (1 - (0.6 * (y - 18)) / (high - 18));
      for (let x = Math.floor(mid - half - 3); x <= mid + half + 3; x++) {
        if (Math.abs(x - mid) < half + (unit(x, y, 4) - 0.5) * 6 && x >= 0 && x < w) fill(x0 + x, y, 0, x0 + x, y, z0 - 1, PLUME);
      }
    }
  }
  for (const anvil of furniture.filter((f) => f.kind === 'anvil')) {
    const [cx, cz] = [anvil.x * TILE + 12, anvil.z * TILE + 12];
    scatter(cx, cz, 15, 0.3, 5, (x, z) => (Math.hypot(x - cx, z - cz) < 6 ? SOOT : SCALE)); // a ring of scale, where it falls
  }
  for (const coal of furniture.filter((f) => f.kind === 'coal')) scatter(coal.x * TILE + 12, coal.z * TILE + 12, 15, 0.3, 6, () => COAL); // its dust
}

// A crypt's rock (cryptVoxels.ts: wallTile), a tile of it, `high` voxels:
// dressed stone on all four faces, as any of them may face the floor. The
// ruins' ashlar (meshes/voxel/ashlar.ts) in the crypt's cold greys, the joints
// sunk; a dark damp course at its foot, moss in it; a light cornice course
// under the dark top. Now and then (variant ARCADE) a blind arch sunk into
// each face: a round-headed recess of darker stone, a light ring of wedge
// stones round it and a sill under it.
// Weathered: damp streaking down from the cornice, a block gone here and there.

import { createGrid, fillBox } from '../meshes/voxel/voxelShapes';
import type { VoxelGrid } from '../meshes/voxel/greedyMesh';
import { ashlarBlock, ashlarStone, type Tones } from '../meshes/voxel/ashlar';
import { hashUnit } from '../../util/random';
import { C, TILE } from './cryptVoxels';

export const ARCADE = 2; // the look with a blind arch (rare: cryptView.ts); 0 and 1 plain
const FOOT = 2; // the damp course's top
// (Made when first wanted: the palette's module and this one need each other.)
const TONES = (): Tones => ({ stone: C.stone, dark: C.stoneDark, light: C.stoneLight, mortar: C.mortar });
const RECESS = (): Tones => ({ stone: C.stoneDark, dark: C.stoneDark, light: C.stoneDark, mortar: C.mortar }); // (the arch's back: in shade, all one tone)
const ARCH = [6, 18] as const; // the blind arch's sides, along a face
const SILL = 5;
const archTop = (a: number) => 19 + Math.round(6 * Math.sqrt(Math.max(0, 1 - ((a - 12) / 6.5) ** 2)));

export function cryptWall(high: number, variant: number): VoxelGrid {
  const grid = createGrid([TILE, high, TILE]);
  const set = (u: number, y: number, v: number, color: number) => fillBox(grid, u, y, v, u, y, v, color);
  const cornice = high - 4;
  const arcade = variant === ARCADE;
  for (let u = 0; u < TILE; u++) {
    for (let v = 0; v < TILE; v++) {
      // Which face this column is on (if any), how far along it, how deep in from it.
      const depth = Math.min(u, v, TILE - 1 - u, TILE - 1 - v);
      const along = Math.min(v, TILE - 1 - v) <= Math.min(u, TILE - 1 - u) ? u : v; // (along whichever face is nearest)
      const corner = (u === 0 || u === TILE - 1) && (v === 0 || v === TILE - 1);
      for (let y = 0; y < high; y++) {
        if (y === high - 1) {
          set(u, y, v, C.cap); // the rock's dark top
          continue;
        }
        if (depth > 2) {
          if (y >= high - 3) set(u, y, v, C.cap); // (within: only its top ever seen)
          continue;
        }
        if (y >= cornice) {
          set(u, y, v, y === cornice + 1 ? C.stoneLight : C.stone); // the cornice
          continue;
        }
        if (y <= FOOT) {
          set(u, y, v, depth === 0 && hashUnit(along, y, 170 + variant) < 0.25 ? C.moss : C.stoneDark); // the damp course
          continue;
        }
        const inArch = arcade && !corner && along >= ARCH[0] && along <= ARCH[1] && y > SILL && y < archTop(along);
        if (inArch) {
          if (depth < 2) continue; // (sunk two)
          set(u, y, v, ashlarStone(RECESS(), along, y - FOOT - 1, false, variant, 171)); // its back
          continue;
        }
        const crown = archTop(Math.min(ARCH[1], Math.max(ARCH[0], along)));
        if (arcade && !corner && depth === 0 && along >= ARCH[0] - 1 && along <= ARCH[1] + 1 && y > SILL && y <= crown + 1) {
          set(u, y, v, y > 19 && (along + y) % 3 === 0 ? C.mortar : C.stoneLight); // its jambs and its ring of wedge stones
          continue;
        }
        if (arcade && depth === 0 && !corner && y === SILL && along >= ARCH[0] - 1 && along <= ARCH[1] + 1) {
          set(u, y, v, C.stoneLight); // its sill
          continue;
        }
        const face = depth === 0;
        let color = corner ? (Math.floor(y / 5) % 2 ? C.stoneLight : C.stone) : ashlarStone(TONES(), along, y - FOOT - 1, face, variant, 172);
        if (!color) continue; // (a sunk joint)
        const block = ashlarBlock(along, y - FOOT - 1, variant);
        if (face && block >= 0 && hashUnit(block, Math.floor((y - FOOT - 1) / 5), 173 + variant + u * 3 + v) < 0.04) continue; // a block gone
        // Damp streaking down from the cornice.
        if (face && hashUnit(along, variant, 174 + (u === 0 || v === 0 ? 0 : 1)) < 0.12 && y > cornice - 6 - Math.floor(hashUnit(along, 1, 175) * 18)) color = color === C.stoneLight ? C.stone : C.stoneDark;
        set(u, y, v, color);
      }
    }
  }
  return grid;
}

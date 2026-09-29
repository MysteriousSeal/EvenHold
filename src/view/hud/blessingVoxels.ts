// Pictures for the wells' blessings (blessingHud.ts), in voxels drawn by
// row as seen from the side, a few voxels thick, so the icon view shows
// their profile: a winged leather boot for Swift feet, a flexed arm for
// Strong arm. Grid-aligned only.

import type { VoxelModel } from '../ui/voxelIcon';
import { createGrid, fillBox } from '../meshes/voxel/voxelShapes';

// A model from rows of characters, top row first (x along each row, y up),
// `depth` voxels thick; `key` says which palette color each character is.
function fromRows(rows: string[], depth: number, key: Record<string, number>, palette: number[]): VoxelModel {
  const grid = createGrid([Math.max(...rows.map((r) => r.length)), rows.length, depth]);
  rows.forEach((row, i) => {
    const y = rows.length - 1 - i;
    for (let x = 0; x < row.length; x++) if (key[row[x]]) fillBox(grid, x, y, 0, x, y, depth - 1, key[row[x]]);
  });
  return { grid, palette };
}

// A tall leather boot, its toe forward: a folded cuff (a white wing at its
// back, for speed), laces up the front, a darker toe cap, a black sole
// under heel and toe with the arch raised between.
export const bootModel = (): VoxelModel =>
  fromRows(
    [
      '..CCCCC.....',
      'WWCCCCC.....',
      '.WDLLLL.....',
      '..DLLLl.....',
      '..DLLLL.....',
      '..DLLLl.....',
      '..DLLLLL....',
      '..DLLLLlL...',
      '..DLLLLLLL..',
      '..DLLLLLLTT.',
      '..DDDDDDDTT.',
      '..SSS..SSSS.',
    ],
    3,
    { C: 1, L: 2, D: 3, l: 4, S: 5, W: 6, T: 3 },
    [0xc98a52, 0x9a5a30, 0x6e3c1e, 0xe8d8b0, 0x2e241c, 0xf6f2ea],
  );

// A flexed arm: a red sleeve at the shoulder, the upper arm level with the
// bicep bulging up from it (lit at its peak), the forearm straight up from
// the elbow, the fist clenched and turned in.
export const armModel = (): VoxelModel =>
  fromRows(
    [
      '......FFFF..',
      '......FKKF..',
      '.......FFF..',
      '.......LSS..',
      '....H..LSS..',
      '...HLL.LSS..',
      '..HLLLLLSS..',
      'RRLLLLLLSS..',
      'RRLLLLLLLS..',
      'RRSSSSSSSS..',
    ],
    4,
    { L: 1, S: 2, H: 3, F: 1, K: 2, R: 4 },
    [0xe0a878, 0xb87c52, 0xf4c898, 0x9a3a2a],
  );

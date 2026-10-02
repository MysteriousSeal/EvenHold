// Pictures for the wells' blessings (blessingHud.ts), in voxels drawn by
// row as seen from the side, a few voxels thick, so the icon view shows
// their profile: a winged leather boot for Swift feet, a flexed arm for
// Strong arm, an open book for Wise mind, a feather for Quiet step, a heart
// for Second wind, an eye for Keen eye; a snowflake for Chilled (a
// draugr's frost), a cobweb for Webbed (a spider's). Grid-aligned only.

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

// An open book: cream pages fanning up from the spine, lines of ink on
// them, a blue leather cover under, gold motes of wisdom rising.
export const bookModel = (): VoxelModel =>
  fromRows(
    [
      '...G.....G...',
      '......G......',
      'PPP.......PPP',
      'PlPPP...PPPlP',
      'PPlPPP.PPPlPP',
      'PPPPPPPPPPPPP',
      'CCCCCCCCCCCCC',
      '.DDDDDDDDDDD.',
    ],
    5,
    { P: 1, l: 2, C: 3, D: 4, G: 5 },
    [0xf2e6c8, 0x8a6a4a, 0x3a5aa0, 0x28407a, 0xffd35a],
  );

// A soft white feather, stepping up to the right, shaded along one edge,
// on a brown quill.
export const featherModel = (): VoxelModel =>
  fromRows(
    [
      '........VVV',
      '.......VVVV',
      '......VVVVS',
      '.....VVVVS.',
      '....VVVVS..',
      '...VVVVS...',
      '..VVVVS....',
      '..VVVS.....',
      '.QVS.......',
      'Q..........',
    ],
    2,
    { V: 1, S: 2, Q: 3 },
    [0xf2f0ea, 0xa8b4c8, 0x8a6a4a],
  );

// A red heart, darker down its right, a pink shine at its top left.
export const heartModel = (): VoxelModel =>
  fromRows(
    ['.RRR.RRR.', 'RRSRRRRRR', 'RSSRRRRRD', 'RRRRRRRRD', '.RRRRRRD.', '..RRRRD..', '...RRD...', '....D....'],
    3,
    { R: 1, D: 2, S: 3 },
    [0xd03a3a, 0x9a2424, 0xffb0b0],
  );

// A wide eye: a dark lid round it, the white, a blue iris, a black pupil
// with a glint.
export const eyeModel = (): VoxelModel =>
  fromRows(
    ['...LLLLL...', '.LLWWWWWLL.', 'LWWWIHIWWWL', 'LWWIIPIIWWL', 'LWWWIIIWWWL', '.LLWWWWWLL.', '...LLLLL...'],
    2,
    { L: 1, W: 2, I: 3, P: 4, H: 2 },
    [0x2e241c, 0xf6f2ea, 0x3a7ac8, 0x1a1a22],
  );

// A snowflake, ice-blue, white at its heart and its tips: Chilled (a draugr's frost).
export const snowflakeModel = (): VoxelModel =>
  fromRows(
    [
      '...W.W.W...',
      '....WIW....',
      '.W...I...W.',
      'W.I..I..I.W',
      '...IIIII...',
      'WIIIIWIIIIW',
      '...IIIII...',
      'W.I..I..I.W',
      '.W...I...W.',
      '....WIW....',
      '...W.W.W...',
    ],
    2,
    { I: 1, W: 2 },
    [0x6cc8f0, 0xeefaff],
  );


// A cobweb, pale silk on a dark gap: its spokes from a corner out, three
// threads strung across them, a small dark spider at its heart: Webbed (a
// cave spider's web).
export const webModel = (): VoxelModel =>
  fromRows(
    [
      'S....S....S',
      '.S...S...S.',
      '..SSSSSSS..',
      '..S.S.S.S..',
      'SSSS.S.SSSS',
      '...S.K.S...',
      'SSSS.S.SSSS',
      '..S.S.S.S..',
      '..SSSSSSS..',
      '.S...S...S.',
      'S....S....S',
    ],
    1,
    { S: 1, K: 2 },
    [0xe8e2d6, 0x2a2026],
  );

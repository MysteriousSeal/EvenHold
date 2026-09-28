// The quest voxels at the world's 0.04 scale:
// - a village's notice board: two timber posts on stepped sandstone
//   footings (the well's and the lanterns' stone), a board of planks in a
//   dark frame with parchment notes pinned on both faces (a red wax pin
//   each), under a small stepped roof of slate shingles;
// - the "!" floating over a quest's marked foes: a chunky 2x2 gold bar and
//   dot, lit on top and shaded under, so it reads from any side.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';

export const QUEST_VOXEL_SIZE = 0.04;

export const BOARD_GRID: [number, number, number] = [17, 21, 5];
export const BOARD_PALETTE = [0xdcc49c, 0xa88c66, 0x7a5232, 0x4a3020, 0x946840, 0xf2e6c8, 0xd8c69c, 0xb02a24, 0x5a6878, 0x46525e, 0x7a8a9a];
const [STONE, STONE_DARK, TIMBER, TIMBER_DARK, PLANK, PAPER, PAPER_DARK, WAX, SLATE, SLATE_DARK, SLATE_LIGHT] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

// A note pinned on one face (z) of the board: paper, a ruled line or two, and a pin.
function note(g: VoxelGrid, x0: number, y0: number, w: number, h: number, z: number): void {
  fillBox(g, x0, y0, z, x0 + w - 1, y0 + h - 1, z, (x, y) => (y < y0 + h - 1 && y > y0 && (y - y0) % 2 === 0 && x > x0 && x < x0 + w - 1 ? PAPER_DARK : PAPER));
  setColor(g, x0 + Math.floor(w / 2), y0 + h - 1, z, WAX);
}

export function buildNoticeBoard(): VoxelGrid {
  const g = createGrid(BOARD_GRID);
  for (const x0 of [0, 13]) {
    fillBox(g, x0, 0, 0, x0 + 3, 0, 4, STONE_DARK); // footings
    fillBox(g, x0 + 1, 1, 1, x0 + 2, 1, 3, STONE);
    fillBox(g, x0 + 1, 2, 2, x0 + 2, 16, 2, (_x, y) => (y === 4 ? TIMBER_DARK : TIMBER)); // posts
  }
  // The board: a dark frame round rows of planks, notes on both faces.
  fillBox(g, 1, 6, 2, 15, 16, 2, (x, y) => (x <= 2 || x >= 14 || y === 6 || y === 16 ? TIMBER_DARK : y % 3 === 0 ? TIMBER : PLANK));
  note(g, 3, 10, 4, 5, 1);
  note(g, 8, 11, 3, 4, 1);
  note(g, 11, 8, 3, 4, 1);
  note(g, 4, 7, 3, 3, 1);
  note(g, 3, 9, 3, 5, 3);
  note(g, 7, 8, 4, 6, 3);
  note(g, 11, 11, 3, 4, 3);
  // The roof: slate shingles in courses, stepping up to a ridge.
  fillBox(g, 0, 17, 0, 16, 17, 4, (x, _y, z) => (z === 0 || z === 4 ? SLATE_DARK : x % 2 === 0 ? SLATE : SLATE_LIGHT));
  fillBox(g, 1, 18, 1, 15, 18, 3, (x) => (x % 2 === 1 ? SLATE : SLATE_LIGHT));
  fillBox(g, 2, 19, 2, 14, 19, 2, SLATE_DARK);
  fillBox(g, 7, 20, 2, 9, 20, 2, SLATE_DARK); // a cap on the ridge
  return g;
}

export const MARK_GRID: [number, number, number] = [2, 9, 2];
export const MARK_PALETTE = [0xffc94a, 0xfff0a8, 0xc07a18];

export function buildQuestMark(): VoxelGrid {
  const g = createGrid(MARK_GRID);
  fillBox(g, 0, 0, 0, 1, 1, 1, (_x, y) => (y === 0 ? 3 : 2)); // the dot
  fillBox(g, 0, 3, 0, 1, 8, 1, (_x, y) => (y === 3 ? 3 : y === 8 ? 2 : 1)); // the bar
  return g;
}

// The "?" over a board with a quest to hand in: the same gold, a stroke two
// voxels thick hooking round and down to its dot.
export const ASK_GRID: [number, number, number] = [5, 8, 2];
const ASK_ROWS = ['.###.', '##.##', '...##', '..##.', '..##.', '.....', '..##.', '..##.']; // top to bottom

export function buildTurnInMark(): VoxelGrid {
  const g = createGrid(ASK_GRID);
  ASK_ROWS.forEach((row, i) => {
    const y = ASK_ROWS.length - 1 - i;
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '#') continue;
      const above = ASK_ROWS[i - 1]?.[x] === '#';
      const below = ASK_ROWS[i + 1]?.[x] === '#';
      fillBox(g, x, y, 0, x, y, 1, !above ? 2 : !below ? 3 : 1); // lit on top, shaded under
    }
  });
  return g;
}

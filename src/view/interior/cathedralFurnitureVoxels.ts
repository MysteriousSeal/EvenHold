// The cathedral's own pieces (model/cathedral/cathedralLayout.ts), painted as every piece is (furnitureVoxels.ts): u
// along the wall it stands against (or along x, standing free), v out from it toward the door, y up; 25 voxels a tile.

import type { Furniture } from '../../model/interiors/furniture';
import { BRASS, BRASS_DARK, COAL, EMBER, INDIGO, INDIGO_DARK, IRON, IRON_LIGHT, LINEN, PALE_STONE, PARCHMENT, RED, RED_DARK, SOOT, STONE, STONE_DARK, WOOD, WOOD_DARK, WOOD_LIGHT, type Box } from './furniturePalette';

type CathedralKind = 'altar' | 'pillar' | 'pew' | 'candleStand' | 'lectern' | 'reliquaryStair' | 'cellBars';

// Dressed stone, in blocks: pale, a darker one now and then.
const dressed = (u: number, y: number, v: number) => ((Math.floor((u + v + (Math.floor(y / 4) % 2) * 3) / 6) + Math.floor(y / 4)) % 5 === 0 ? STONE : PALE_STONE);

// A cluster of candles on a dish or tray: `n` of them along u from `u0`, each a voxel wide, its wick lit.
function candles(box: Box, u0: number, y: number, v: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const tall = 2 + ((i * 7) % 3);
    box(u0 + i * 2, y, v, u0 + i * 2, y + tall, v, LINEN);
    box(u0 + i * 2, y + tall + 1, v, u0 + i * 2, y + tall + 1, v, EMBER);
  }
}

export const CATHEDRAL_PAINTERS: Record<CathedralKind, (box: Box, len: number, dep: number, item: Furniture) => void> = {
  // The high altar: a block of stone under a linen cloth, a red frontal hung down its face, two gilt candlesticks and a
  // book on it; behind, up the wall, its retable: a gilt frame round panels of the saints (indigo and red, their faces
  // pale), a cross over all.
  altar: (box, len) => {
    box(8, 1, 6, len - 9, 21, 20, dressed);
    box(7, 22, 5, len - 8, 23, 21, LINEN);
    box(18, 10, 21, len - 19, 21, 21, (u, y) => (y === 21 || u === 18 || u === len - 19 ? BRASS : RED));
    box(len / 2 - 2, 13, 21, len / 2 + 1, 18, 21, (u, y) => (u === len / 2 - 1 || u === len / 2 || y === 16 ? BRASS : RED)); // (a gold cross on the frontal)
    for (const u of [14, len - 15]) {
      box(u - 1, 24, 12, u + 1, 24, 14, BRASS_DARK);
      box(u, 25, 13, u, 30, 13, BRASS);
      box(u, 31, 13, u, 33, 13, LINEN);
      box(u, 34, 13, u, 34, 13, EMBER);
    }
    box(len / 2 - 4, 24, 10, len / 2 + 3, 24, 16, (u) => (u === len / 2 || u === len / 2 - 1 ? RED_DARK : PARCHMENT)); // (the book, open)
    // The retable.
    box(4, 1, 0, len - 5, 58, 3, (u, y) => {
      const panel = Math.floor((u - 4) / ((len - 8) / 3));
      const inU = (u - 4) % Math.floor((len - 8) / 3);
      const frame = y < 24 || y > 54 || inU < 2 || inU > Math.floor((len - 8) / 3) - 3 || y === 39;
      if (frame) return y % 6 === 0 ? BRASS_DARK : BRASS;
      const mid = Math.abs(inU - (len - 8) / 6) < 3;
      return mid && (y === 50 || y === 35) ? LINEN : mid ? (panel === 1 ? RED : INDIGO) : y < 39 ? INDIGO_DARK : WOOD_DARK;
    });
    box(len / 2 - 1, 59, 1, len / 2, 70, 2, BRASS);
    box(len / 2 - 4, 65, 1, len / 2 + 3, 66, 2, BRASS);
  },
  // A pillar of the nave: square on a stepped base, its shaft banded, a capital spreading to carry the arch over it.
  pillar: (box) => {
    box(4, 0, 4, 20, 3, 20, STONE);
    box(6, 4, 6, 18, 5, 18, PALE_STONE);
    box(8, 6, 8, 16, 33, 16, (u, y, v) => (y % 10 === 0 ? STONE : dressed(u, y, v)));
    box(6, 34, 6, 18, 36, 18, PALE_STONE);
    box(4, 37, 4, 20, 38, 20, STONE_DARK);
  },
  // A pew, a seat of its row (drawn facing the altar, its back at v = 0): an oak seat, its back high behind it, a
  // cushioned kneeler along the floor before it; a solid end board where it ends its row (`side`, as it faces: -1 its
  // left, 1 its right).
  pew: (box, len, _dep, item) => {
    const ends = item.side === undefined ? [] : [item.side < 0 ? len - 2 : 0];
    for (const u of ends) box(u, 0, 0, u + 1, 20, 18, (_u, y, v) => (y === 20 || v === 0 ? WOOD_LIGHT : WOOD_DARK));
    box(0, 0, 0, len - 1, 19, 2, (u, y) => (y === 19 ? WOOD_LIGHT : u % 12 === 6 ? WOOD_DARK : WOOD)); // (its back)
    box(0, 8, 3, len - 1, 9, 13, (_u, y, v) => (v === 13 ? WOOD_LIGHT : y === 9 ? WOOD : WOOD_DARK)); // (its seat)
    box(0, 0, 12, len - 1, 7, 12, WOOD_DARK);
    box(0, 2, 18, len - 1, 3, 22, (_u, y) => (y === 3 ? RED : RED_DARK)); // (the kneeler, cushioned)
    box(0, 0, 19, len - 1, 1, 21, WOOD_DARK);
  },
  // Votive candles: an iron stand, a tray of them burning on it, a box for the offerings at its foot.
  candleStand: (box) => {
    box(11, 0, 11, 13, 1, 13, IRON);
    box(12, 2, 12, 12, 17, 12, IRON);
    box(4, 18, 6, 20, 18, 18, (u, _y, v) => (u === 4 || u === 20 || v === 6 || v === 18 ? IRON_LIGHT : IRON));
    for (const v of [8, 12, 16]) candles(box, 6 + (v % 4), 19, v, 6);
    box(15, 0, 16, 21, 5, 21, (u, y) => (y === 5 && u > 16 && u < 20 ? COAL : WOOD_DARK)); // (the offerings' box, its slot)
  },
  // A lectern: a turned post on a cross foot, a sloped desk, the great book open on it.
  lectern: (box) => {
    box(5, 0, 11, 19, 1, 13, WOOD_DARK);
    box(11, 0, 5, 13, 1, 19, WOOD_DARK);
    box(11, 2, 11, 13, 17, 13, (_u, y) => (y % 5 === 0 ? WOOD_LIGHT : WOOD));
    for (let v = 6; v <= 18; v++) {
      const y = 18 + Math.floor((18 - v) / 3);
      box(5, y, v, 19, y, v, WOOD);
      if (v > 7 && v < 17) box(6, y + 1, v, 18, y + 1, v, (u) => (u === 12 ? RED_DARK : u === 6 || u === 18 ? RED : PARCHMENT));
    }
  },
  // The way down to the reliquary: a stone kerb round a dark stairwell, its steps going down into the black, an iron
  // grille along its open side, its gate shut, and a lantern on a post at its corner.
  reliquaryStair: (box, len, dep) => {
    box(0, 0, 0, len - 1, 4, dep - 1, (u, y, v) => (u < 3 || u > len - 4 || v < 3 || v > dep - 4 ? (y === 4 ? PALE_STONE : STONE) : 0));
    for (let v = 3; v < dep - 3; v++) {
      const step = Math.floor((v - 3) / 6); // (the farther, the deeper: darker)
      box(3, 0, v, len - 4, 0, v, step === 0 ? STONE_DARK : step === 1 ? SOOT : COAL);
      if ((v - 3) % 6 === 0) box(3, 1, v, len - 4, 1, v, step === 0 ? STONE : STONE_DARK); // (each step's nosing)
    }
    for (let u = 1; u <= len - 2; u += 3) box(u, 5, dep - 2, u, 26, dep - 2, IRON); // (the grille)
    for (const y of [5, 15, 26]) box(1, y, dep - 2, len - 2, y, dep - 2, IRON_LIGHT);
    box(len / 2 - 1, 16, dep - 1, len / 2, 18, dep - 1, BRASS); // (its lock)
    box(len - 3, 5, dep - 3, len - 2, 34, dep - 2, WOOD_DARK); // (the lantern's post)
    box(len - 5, 35, dep - 4, len - 1, 35, dep, IRON);
    box(len - 4, 36, dep - 3, len - 2, 38, dep - 1, EMBER);
    box(len - 5, 39, dep - 4, len - 1, 39, dep, IRON);
  },
  // A cell's bars: iron uprights floor to beam on its tile, a crossbar low and high, a beam over them.
  cellBars: (box) => {
    for (let u = 1; u < 25; u += 4) for (let v = 1; v < 25; v += 4) if (u === 1 || u === 21 || v === 1 || v === 21) box(u, 0, v, u, 34, v, IRON);
    for (const y of [6, 26]) box(1, y, 1, 21, y, 21, (u, _y, v) => (u === 1 || u === 21 || v === 1 || v === 21 ? IRON_LIGHT : 0));
    box(0, 35, 0, 24, 36, 24, (u, _y, v) => (u < 2 || u > 22 || v < 2 || v > 22 ? WOOD_DARK : 0));
  },
};

// The hero's cottage's own pieces (model/homestead/cottageLayout.ts): their chest, bound in iron with a brass lock (the
// strongbox's store, at home); the trophy wall, two rows of pegs along the left wall, each trophy on its plaque
// (trophyVoxels.ts) and a bare peg where there's none yet; a spot still to be built, chalked out (on the floor, or the
// wall); and, a cottage for sale, the reeve's notice nailed to the back wall under its red seal.

import type { Furniture } from '../../model/interiors/furniture';
import { BRASS, BRASS_DARK, INK, IRON, IRON_LIGHT, LINEN, PARCHMENT, RED, RED_DARK, SOOT, WOOD, WOOD_DARK, WOOD_LIGHT, type Box } from './furniturePalette';
import { CELL_H, CELL_W, paintTrophy } from './trophyVoxels';

export type HomesteadKind = 'homeChest' | 'trophyWall' | 'cottageSpot' | 'saleNotice';

const ROWS = [8 + CELL_H + 2, 8]; // the trophy wall's rows' bottoms (top row first: filled first)
const PEGS = 5; // to a row
const GAP = 1; // between the plaques
const RAIL = 1; // voxels out from the wall the rails stand
const CHALK = LINEN;

// The wall's cells along it, top row then bottom, left to right: where each plaque goes.
function cells(len: number): Array<[number, number]> {
  const start = Math.floor((len - (PEGS * CELL_W + (PEGS - 1) * GAP)) / 2);
  return ROWS.flatMap((y) => Array.from({ length: PEGS }, (_, i): [number, number] => [start + i * (CELL_W + GAP), y]));
}

// Dashes along the edges of a rectangle (u0..u1, v0..v1) at height y, chalked; a cross in its middle.
function chalked(box: Box, u0: number, v0: number, u1: number, v1: number, y: number): void {
  const dash = (n: number) => n % 4 !== 3;
  box(u0, y, v0, u1, y, v0, (u) => (dash(u) ? CHALK : 0));
  box(u0, y, v1, u1, y, v1, (u) => (dash(u) ? CHALK : 0));
  box(u0, y, v0, u0, y, v1, (_u, _y, v) => (dash(v) ? CHALK : 0));
  box(u1, y, v0, u1, y, v1, (_u, _y, v) => (dash(v) ? CHALK : 0));
  const [cu, cv] = [Math.round((u0 + u1) / 2), Math.round((v0 + v1) / 2)];
  for (let k = -3; k <= 3; k++) {
    box(cu + k, y, cv + k, cu + k, y, cv + k, CHALK);
    box(cu + k, y, cv - k, cu + k, y, cv - k, CHALK);
  }
}

export const HOMESTEAD_PAINTERS: Record<HomesteadKind, (box: Box, len: number, dep: number, item: Furniture) => void> = {
  // A stout chest on the floor against the wall: dark planks, iron straps over its lid and down its front, brass
  // corners, a big brass lock plate, and the hero's own mark burnt into the lid.
  homeChest: (box) => {
    const strap = (u: number) => u === 6 || u === 18;
    box(2, 1, 4, 22, 9, 20, (u, y) => (strap(u) ? IRON : y % 3 === 1 ? WOOD_DARK : WOOD)); // the body
    box(2, 10, 4, 22, 11, 20, (u) => (strap(u) ? IRON : WOOD_LIGHT)); // the lid, domed
    box(2, 12, 6, 22, 12, 18, (u) => (strap(u) ? IRON : WOOD_LIGHT));
    box(2, 13, 9, 22, 13, 15, (u) => (strap(u) ? IRON_LIGHT : WOOD));
    for (const [u, v] of [[2, 4], [22, 4], [2, 20], [22, 20]]) box(u, 1, v, u, 11, v, BRASS); // the corners
    box(10, 4, 21, 14, 9, 21, BRASS); // the lock plate
    box(11, 4, 21, 13, 4, 21, BRASS_DARK);
    box(12, 6, 21, 12, 7, 21, SOOT); // its keyhole
    box(11, 10, 21, 13, 11, 21, IRON); // the hasp over it
    box(11, 13, 11, 13, 13, 13, WOOD_DARK); // the mark burnt in the lid
  },
  // Two rails along the wall, a plaque to each peg: what's hung on them (`hung`, in order), and a bare iron peg for
  // each still to be filled.
  trophyWall: (box, len, _dep, item) => {
    for (const y of ROWS) {
      box(2, y - 1, 0, len - 3, y - 1, RAIL, WOOD_DARK); // the rail under the row
      box(2, y - 1, RAIL, len - 3, y - 1, RAIL, WOOD_LIGHT);
    }
    const hung = item.hung ?? [];
    cells(len).forEach(([u, y], i) => {
      if (hung[i]) paintTrophy(box, hung[i], u, y);
      else box(u + 6, y + 6, 0, u + 6, y + 6, 2, IRON); // a peg, waiting
    });
  },
  // Where something's to be built: on the floor, its footprint chalked; on the wall (the trophy wall's), its boards'.
  cottageSpot: (box, len, dep, item) => {
    if (item.upgrade === 'trophies') {
      const at = (u: number, y: number) => box(u, y, 0, u, y, 0, CHALK);
      for (let u = 3; u < len - 3; u++) if (u % 4 !== 3) [at(u, 7), at(u, 32)];
      for (let y = 7; y <= 32; y++) if (y % 4 !== 3) [at(3, y), at(len - 4, y)];
      for (const y of [20, 7]) for (let u = 6; u < len - 6; u += 14) box(u + 6, y + 7, 0, u + 6, y + 7, 1, IRON); // nails, already in
      return;
    }
    chalked(box, 2, 2, len - 3, dep - 3, 1);
  },
  // The reeve's notice: a sheet of parchment nailed up, its lines inked, a red wax seal at its foot, a nail at each
  // corner; a coil of the cottage's key hung from the nail beside it.
  saleNotice: (box) => {
    box(6, 12, 0, 18, 27, 0, PARCHMENT);
    for (const y of [24, 22, 20, 18, 16]) box(8, y, 1, y === 24 ? 16 : y === 16 ? 12 : 16, y, 1, INK); // the writing
    box(14, 13, 1, 16, 15, 1, RED); // the seal
    box(15, 12, 1, 15, 12, 1, RED_DARK);
    for (const [u, y] of [[6, 27], [18, 27], [6, 12], [18, 12]]) box(u, y, 1, u, y, 1, IRON); // the nails
    box(20, 22, 0, 20, 22, 2, IRON); // a nail beside it, and the key hung on it
    box(20, 17, 2, 20, 21, 2, BRASS);
    box(19, 15, 2, 21, 16, 2, BRASS);
    box(21, 18, 2, 21, 18, 2, BRASS_DARK);
  },
};

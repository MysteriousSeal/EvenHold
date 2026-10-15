// The hero's trophies (model/homestead/trophies.ts), each on its own plaque on their cottage's trophy wall
// (homesteadVoxels.ts): a cell CELL_W voxels along the wall and CELL_H high, the plaque flat against it (v 0-1), what's
// on it standing out from it (v 2 on). Big, plain shapes in strong colours: they're seen from across the room.

import type { TrophyId } from '../../model/homestead/trophies';
import {
  BONE,
  BONE_DARK,
  BRASS,
  BRASS_DARK,
  FUR,
  FUR_DARK,
  FUR_LIGHT,
  GLASS_GREEN,
  INK,
  IRON,
  IRON_EDGE,
  IRON_LIGHT,
  PARCHMENT,
  RED,
  RED_DARK,
  SCALE,
  SOOT,
  STONE,
  STONE_DARK,
  WOOD,
  WOOD_DARK,
  WOOD_LIGHT,
  type Box,
} from './furniturePalette';

export const CELL_W = 13;
export const CELL_H = 11;

type Cell = (u0: number, y0: number, v0: number, u1: number, y1: number, v1: number, color: number) => void;

// The plaque: a dark board, its corners cut, a lighter rim along its top and a nail.
function plaque(at: Cell): void {
  at(1, 0, 0, 11, 10, 0, WOOD_LIGHT); // (its rim, lighter than the wall and the rails)
  at(0, 1, 0, 12, 9, 0, WOOD_LIGHT);
  at(1, 1, 1, 11, 9, 1, WOOD_DARK);
  at(1, 9, 1, 11, 9, 1, WOOD);
}

const PAINT: Record<TrophyId, (at: Cell) => void> = {
  // A crypt lord's skull, a crown of tarnished gold on it: the brow, black sockets, a nose hole, teeth.
  lordSkull: (at) => {
    at(3, 2, 2, 9, 7, 5, BONE); // the cranium
    at(4, 8, 2, 8, 8, 4, BONE);
    at(3, 2, 5, 9, 2, 5, BONE_DARK); // the jaw's shadow
    at(4, 4, 5, 5, 5, 5, SOOT); // the sockets
    at(7, 4, 5, 8, 5, 5, SOOT);
    at(6, 3, 5, 6, 3, 5, SOOT); // the nose
    for (const u of [4, 6, 8]) at(u, 2, 5, u, 2, 5, SOOT); // between the teeth
    at(3, 8, 3, 9, 8, 5, BRASS); // the crown's band
    for (const u of [3, 6, 9]) at(u, 9, 4, u, 10, 4, BRASS); // its points
    at(6, 8, 5, 6, 8, 5, RED); // a stone in it
    at(3, 8, 5, 9, 8, 5, BRASS_DARK);
  },
  // The brood mother's fangs: two great curved fangs, black chitin to their pale tips, crossed, a drop of venom.
  broodFangs: (at) => {
    for (let k = 0; k < 7; k++) {
      at(3 + k, 8 - k, 2, 3 + k, 8 - k, 3, k < 4 ? SOOT : BONE); // the one, down to the right
      at(9 - k, 8 - k, 3, 9 - k, 8 - k, 4, k < 4 ? SCALE : BONE_DARK); // the other, down to the left, before it
    }
    at(2, 8, 2, 4, 9, 3, SOOT); // their roots
    at(8, 8, 3, 10, 9, 4, SCALE);
    at(6, 1, 4, 6, 1, 4, GLASS_GREEN); // venom at the tips
  },
  // The bandit king's crown: a broad gold band, five points, red and green stones, dented.
  kingCrown: (at) => {
    at(2, 3, 2, 10, 5, 4, BRASS);
    at(2, 3, 4, 10, 3, 4, BRASS_DARK); // its lower rim, shadowed
    for (const u of [2, 4, 6, 8, 10]) at(u, 6, 3, u, u === 6 ? 8 : 7, 4, BRASS);
    for (const u of [2, 6, 10]) at(u, u === 6 ? 9 : 8, 4, u, u === 6 ? 9 : 8, 4, BRASS_DARK); // a ball atop the tall points
    at(4, 4, 5, 4, 4, 5, RED); // the stones
    at(6, 4, 5, 6, 4, 5, GLASS_GREEN);
    at(8, 4, 5, 8, 4, 5, RED);
    at(9, 5, 4, 9, 5, 4, BRASS_DARK); // a dent
  },
  // A captain's sword, broken: the hilt and a hand's length of blade, the rest of the blade below it, crossed with it.
  captainBlade: (at) => {
    at(6, 6, 2, 6, 9, 3, IRON_LIGHT); // the stump of the blade, up
    at(6, 9, 3, 6, 9, 3, IRON_EDGE);
    at(3, 5, 2, 9, 5, 3, IRON); // the cross-guard
    at(6, 2, 2, 6, 4, 3, WOOD_DARK); // the grip, wound
    at(6, 1, 2, 6, 1, 3, BRASS); // the pommel
    for (let k = 0; k < 6; k++) at(2 + k, 2 + k, 4, 2 + k, 2 + k, 4, k === 5 ? IRON_EDGE : IRON_LIGHT); // the broken-off blade, aslant before it
    at(7, 7, 4, 8, 7, 4, IRON_EDGE); // its jagged end
  },
  // An outlaw's poster, crossed through: parchment nailed up, his likeness inked, a red cross over it all.
  outlawPoster: (at) => {
    at(2, 1, 2, 10, 9, 2, PARCHMENT);
    at(4, 5, 3, 8, 8, 3, INK); // the likeness: a head
    at(5, 6, 3, 5, 6, 3, PARCHMENT); // its eyes
    at(7, 6, 3, 7, 6, 3, PARCHMENT);
    for (const y of [2, 3]) at(3, y, 3, 9, y, 3, y === 2 ? INK : PARCHMENT); // the writing
    for (let k = 0; k < 9; k++) {
      at(2 + k, 1 + k, 4, 2 + k, 1 + k, 4, RED); // the cross
      at(10 - k, 1 + k, 4, 10 - k, 1 + k, 4, RED_DARK);
    }
    at(6, 9, 3, 6, 9, 3, IRON); // the nail
  },
  // A bear's head: broad, brown, round ears, a pale muzzle, a black nose, its mouth open on its teeth.
  bearHead: (at) => {
    at(3, 3, 2, 9, 8, 4, FUR);
    at(2, 8, 2, 4, 10, 3, FUR); // the ears
    at(8, 8, 2, 10, 10, 3, FUR);
    at(3, 9, 3, 3, 9, 3, FUR_DARK);
    at(9, 9, 3, 9, 9, 3, FUR_DARK);
    at(4, 2, 5, 8, 5, 6, FUR_LIGHT); // the muzzle
    at(5, 5, 7, 7, 5, 7, SOOT); // the nose
    at(5, 2, 6, 7, 2, 6, RED_DARK); // the open mouth
    at(4, 2, 6, 4, 3, 6, BONE); // its fangs
    at(8, 2, 6, 8, 3, 6, BONE);
    at(4, 6, 5, 4, 6, 5, SOOT); // the eyes
    at(8, 6, 5, 8, 6, 5, SOOT);
  },
  // A boar's head: long, bristled dark, a pink-dark snout, and tusks curling up.
  boarHead: (at) => {
    at(4, 3, 2, 8, 8, 4, FUR_DARK);
    at(5, 8, 3, 7, 9, 4, SOOT); // the bristled crest
    at(3, 7, 2, 3, 9, 3, FUR_DARK); // the ears, pricked
    at(9, 7, 2, 9, 9, 3, FUR_DARK);
    at(5, 2, 5, 7, 5, 7, FUR); // the long snout
    at(5, 2, 8, 7, 3, 8, RED_DARK); // its end
    at(4, 3, 6, 4, 5, 7, BONE); // the tusks, up
    at(8, 3, 6, 8, 5, 7, BONE);
    at(5, 6, 5, 5, 6, 5, RED); // small mean eyes
    at(7, 6, 5, 7, 6, 5, RED);
  },
  // A lynx's pelt, stretched flat: tawny, dark spots, the head at the top with its tufted ears, the legs spread.
  lynxPelt: (at) => {
    at(4, 2, 2, 8, 7, 2, FUR_LIGHT); // the body
    at(2, 2, 2, 3, 3, 2, FUR_LIGHT); // the legs
    at(9, 2, 2, 10, 3, 2, FUR_LIGHT);
    at(2, 6, 2, 3, 7, 2, FUR_LIGHT);
    at(9, 6, 2, 10, 7, 2, FUR_LIGHT);
    at(5, 8, 2, 7, 9, 3, FUR_LIGHT); // the head
    at(5, 10, 3, 5, 10, 3, SOOT); // the tufted ears
    at(7, 10, 3, 7, 10, 3, SOOT);
    for (const [u, y] of [[5, 3], [7, 4], [6, 6], [4, 5], [8, 6], [6, 2]]) at(u, y, 3, u, y, 3, FUR_DARK); // spots
    at(6, 1, 2, 6, 1, 2, SOOT); // the stub of a tail
  },
  // A pack leader's pelt: grey, darker down the back, the head with its ears up and its muzzle down.
  wolfPelt: (at) => {
    at(4, 2, 2, 8, 7, 2, STONE);
    at(6, 2, 3, 6, 7, 3, STONE_DARK); // the dark down its back
    at(2, 2, 2, 3, 3, 2, STONE);
    at(9, 2, 2, 10, 3, 2, STONE);
    at(2, 6, 2, 3, 7, 2, STONE);
    at(9, 6, 2, 10, 7, 2, STONE);
    at(5, 7, 3, 7, 9, 4, STONE); // the head
    at(5, 10, 4, 5, 10, 4, STONE_DARK); // the ears
    at(7, 10, 4, 7, 10, 4, STONE_DARK);
    at(6, 7, 5, 6, 7, 5, SOOT); // the nose
    at(5, 9, 5, 5, 9, 5, BRASS); // yellow eyes
    at(7, 9, 5, 7, 9, 5, BRASS);
  },
};

// `id` on its plaque, in the cell whose bottom left is (u, y) along the wall: what's on it drawn twice as deep as it's
// laid out (seen along the wall, from the side, it has to stand well out from it to be made out).
const deep = (v: number) => (v < 2 ? v : 2 + (v - 2) * 2);
export function paintTrophy(box: Box, id: TrophyId, u: number, y: number): void {
  const at: Cell = (u0, y0, v0, u1, y1, v1, color) => box(u + u0, y + y0, deep(v0), u + u1, y + y1, v1 < 2 ? v1 : deep(v1) + 1, color);
  plaque(at);
  PAINT[id](at);
}

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
  CLAY,
  CLAY_DARK,
  GLASS_CLEAR,
  GLASS_GREEN,
  LINEN,
  BREAD,
  TWINE,
  INK,
  IRON,
  IRON_EDGE,
  IRON_LIGHT,
  PARCHMENT,
  RED,
  RED_DARK,
  SCALE,
  SOOT,
  SOOT_LIGHT,
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
  // A witch-finder's hat: a tall charcoal felt capotain, stepped in at its top, a narrow stiff brim, a black band and
  // a pewter buckle at its front.
  finderHat: (at) => {
    at(2, 2, 2, 10, 2, 6, SCALE); // the brim
    at(2, 2, 6, 10, 2, 6, SOOT); // its edge
    at(4, 3, 3, 8, 7, 5, SCALE); // the crown
    at(5, 8, 3, 7, 9, 4, SCALE); // stepped in at the top
    at(4, 3, 5, 8, 4, 5, SOOT); // the band
    at(6, 3, 6, 6, 4, 6, IRON_LIGHT); // the buckle
    at(5, 6, 5, 5, 7, 5, SOOT_LIGHT); // the felt's shade
  },
  // The Gilded Deacon's monstrance, empty (the finger fell out of it): a gilt sunburst on a stem and foot, its rays
  // alternating long and short, the glass at its heart clear and nothing in it.
  monstrance: (at) => {
    at(4, 0, 2, 8, 0, 4, BRASS_DARK); // the foot
    at(6, 1, 3, 6, 3, 3, BRASS); // the stem
    at(5, 2, 3, 7, 2, 3, BRASS_DARK); // its knop
    for (const [du, dy] of [[0, 3], [0, -3], [3, 0], [-3, 0], [2, 2], [-2, 2], [2, -2], [-2, -2]]) at(6 + du, 7 + dy, 3, 6 + du, 7 + dy, 3, Math.abs(du) === Math.abs(dy) ? BRASS_DARK : BRASS); // the rays
    for (const [du, dy] of [[0, 4], [4, 0], [-4, 0]]) at(6 + du, 7 + dy, 3, 6 + du, 7 + dy, 3, BRASS);
    at(5, 6, 3, 7, 8, 3, BRASS); // the case
    at(6, 7, 4, 6, 7, 4, GLASS_CLEAR); // its glass, empty
  },
  // Brannoc the Unburied's axe: a long haft, a broad head rusted brown at the edge, grave-earth on it.
  brannocAxe: (at) => {
    for (let k = 0; k < 9; k++) at(2 + k, 1 + k, 2, 2 + k, 1 + k, 2, WOOD_DARK); // the haft, aslant
    at(7, 6, 3, 10, 10, 3, IRON); // the head
    at(10, 6, 3, 11, 10, 3, CLAY_DARK); // its edge, rusted
    at(8, 7, 4, 8, 7, 4, CLAY_DARK);
  },
  // Ysolde of the Nails' skull: bone, iron nails driven in round its crown like a halo.
  ysoldeSkull: (at) => {
    at(4, 2, 2, 8, 7, 4, BONE);
    at(5, 4, 4, 5, 5, 4, SOOT);
    at(7, 4, 4, 7, 5, 4, SOOT);
    at(4, 2, 4, 8, 2, 4, BONE_DARK);
    for (const [u, y] of [[3, 7], [4, 8], [6, 8], [8, 8], [9, 7], [6, 9]]) at(u, y, 4, u, y + 1, 4, IRON_LIGHT); // the nails
  },
  // Godric Twice-Hanged's noose: a coil of rope, its loop and knot, twice frayed.
  godricNoose: (at) => {
    at(6, 6, 2, 6, 10, 3, TWINE); // the rope down from the peg
    at(5, 5, 2, 7, 6, 4, TWINE); // the knot
    at(4, 1, 3, 4, 4, 3, TWINE); // the loop
    at(8, 1, 3, 8, 4, 3, TWINE);
    at(5, 1, 3, 7, 1, 3, TWINE);
    at(7, 9, 3, 7, 9, 3, BREAD); // frayed
  },
  // The Weeping's eye: a great dark spider's eye wrapped in silk, a tear of venom from it.
  weepingEye: (at) => {
    at(3, 2, 2, 9, 8, 4, LINEN); // the silk
    at(5, 4, 4, 7, 6, 5, SOOT); // the eye
    at(5, 6, 5, 5, 6, 5, IRON_LIGHT); // its glint
    at(6, 1, 4, 6, 3, 4, GLASS_GREEN); // the tear
  },
  // Gullet's jaw: a ring of hooked teeth, pale, in raw red gum.
  gulletJaw: (at) => {
    at(2, 2, 2, 10, 8, 3, RED_DARK);
    at(4, 4, 2, 8, 6, 3, SOOT); // the throat
    for (const [u, y] of [[3, 8], [5, 9], [7, 9], [9, 8], [3, 2], [5, 1], [7, 1], [9, 2], [2, 5], [10, 5]]) at(u, y, 4, u, y, 4, BONE); // the teeth, hooked in
  },
  // Shroud's silk: a sheet of grey-white silk, draped from the peg, a husk caught in it.
  shroudSilk: (at) => {
    at(3, 1, 2, 9, 9, 2, LINEN);
    at(4, 2, 3, 8, 8, 3, PARCHMENT);
    for (const u of [4, 6, 8]) at(u, 1, 3, u, 9, 3, LINEN); // its folds
    at(5, 4, 4, 6, 6, 4, FUR_DARK); // a husk, wrapped
  },
  // Hob's fire-pot: a round clay pot, cracked, soot up its side, a rag fuse.
  hobPot: (at) => {
    at(4, 1, 2, 8, 6, 5, CLAY);
    at(5, 7, 3, 7, 7, 4, CLAY_DARK); // its neck
    at(6, 8, 3, 6, 9, 3, LINEN); // the rag
    at(8, 3, 5, 8, 6, 5, SOOT); // soot
    for (let k = 0; k < 4; k++) at(5 + (k % 2), 2 + k, 6, 5 + (k % 2), 2 + k, 6, SOOT); // the crack
  },
  // Wat Ninefingers' gauntlet: an iron glove, four fingers and a thumb, one finger short.
  watGauntlet: (at) => {
    at(4, 1, 2, 8, 3, 4, IRON); // the cuff
    at(4, 4, 2, 8, 6, 4, IRON_LIGHT); // the back of the hand
    for (const u of [4, 6, 8]) at(u, 7, 3, u, 9, 3, IRON_LIGHT); // three fingers whole
    at(5, 7, 3, 5, 7, 3, IRON_EDGE); // the fourth, a stump
    at(3, 4, 3, 3, 6, 3, IRON); // the thumb
  },
  // Meg of the Gibbet's crossbow: the stock down, the bow across, its string, a bolt laid in it.
  megCrossbow: (at) => {
    at(6, 1, 2, 6, 8, 3, WOOD); // the stock
    at(2, 7, 3, 10, 7, 3, IRON); // the bow
    at(2, 6, 3, 2, 6, 3, IRON);
    at(10, 6, 3, 10, 6, 3, IRON);
    at(3, 5, 3, 9, 5, 3, LINEN); // the string
    at(6, 5, 4, 6, 10, 4, IRON_LIGHT); // the bolt
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

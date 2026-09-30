// The smithy's own furniture in voxels (see furnitureVoxels.ts for how
// pieces are painted): where the smith trades (a stout counter, a ledger and
// a scale on it), what he works with (bellows by the forge, a grindstone, a
// board of tools), and what he sells, on show (a wall of weapons, a suit of
// armour on a stand). The forge, anvil, trough and rack are furnitureVoxels.ts'.

import { WOOD, WOOD_DARK, WOOD_LIGHT, IRON, IRON_LIGHT, STONE, STONE_DARK, BRASS, BRASS_DARK, FUR_DARK, CLAY, CLAY_DARK, PARCHMENT, INK, COAL, WATER, type Box } from './furniturePalette';

export type SmithyKind = 'smithCounter' | 'bellows' | 'weaponWall' | 'armorStand' | 'grindstone' | 'toolBoard';

export const SMITHY_PAINTERS: Record<SmithyKind, (box: Box, len: number, dep: number) => void> = {
  // Two tiles of oak, its front (+v, toward the door) banded in iron under a
  // lit top; on it an open ledger and a brass scale.
  smithCounter: (box, len) => {
    box(1, 1, 7, len - 2, 2, 19, WOOD_DARK); // plinth
    box(2, 3, 8, len - 3, 12, 18, (u, y, v) => (v === 18 && (u % 12 === 2 || y === 5) ? IRON : WOOD)); // body, banded
    box(0, 13, 6, len - 1, 14, 20, (_u, y, v) => (y === 13 ? WOOD_DARK : v === 20 ? WOOD_LIGHT : WOOD)); // the top, its edge lit
    box(8, 15, 11, 17, 15, 16, (u, _y, v) => (u === 12 || u === 13 ? CLAY_DARK : (v === 13 || v === 15) && u !== 8 && u !== 17 ? INK : PARCHMENT)); // the ledger, open
    box(37, 15, 11, 39, 15, 13, BRASS_DARK); // the scale: its foot,
    box(38, 16, 12, 38, 21, 12, BRASS); // post,
    box(34, 22, 12, 42, 22, 12, BRASS); // beam,
    for (const u of [34, 42]) {
      box(u, 20, 12, u, 21, 12, BRASS_DARK); // its strings
      box(u - 1, 19, 11, u + 1, 19, 13, BRASS); // and pans
    }
  },
  // By the forge on the back wall: leather folds (pleated, clay and dark)
  // between a board below and one above, a handle out front, an iron nozzle.
  bellows: (box) => {
    for (const [u, v] of [[5, 3], [19, 3], [5, 13], [19, 13]]) box(u, 1, v, u, 2, v, WOOD_DARK); // feet
    box(4, 3, 2, 20, 3, 14, WOOD_DARK); // the lower board
    for (let y = 4; y <= 8; y++) box(5, y, 3, 19, y, 13 - (y - 4), y % 2 === 0 ? CLAY : CLAY_DARK); // the leather, folded
    box(4, 9, 2, 20, 9, 10, WOOD); // the upper board
    box(10, 10, 8, 14, 10, 15, WOOD_LIGHT); // its handle
    box(11, 4, 14, 13, 5, 18, IRON); // the nozzle
  },
  // Hung on a wall: a dark board with a sword, an axe and a spear pegged to it.
  weaponWall: (box) => {
    box(2, 12, 0, 22, 28, 1, (u, y) => (u === 2 || u === 22 || y === 12 || y === 28 ? WOOD_DARK : FUR_DARK)); // the board, framed
    box(6, 14, 2, 6, 23, 2, IRON_LIGHT); // the sword: its blade,
    box(4, 24, 2, 8, 24, 2, BRASS); // guard,
    box(6, 25, 2, 6, 26, 2, WOOD_DARK); // grip
    box(6, 27, 2, 6, 27, 2, BRASS_DARK); // and pommel
    box(12, 13, 2, 12, 27, 2, WOOD); // the axe: its haft,
    box(13, 22, 2, 15, 26, 2, (u) => (u === 15 ? IRON_LIGHT : IRON)); // its head, the edge bright
    box(18, 13, 2, 18, 24, 2, WOOD); // the spear: its shaft,
    box(17, 25, 2, 19, 25, 2, IRON); // socket,
    box(18, 26, 2, 18, 27, 2, IRON_LIGHT); // and point
  },
  // A suit of armour on a stand: a cross foot, a post, a mail shirt belted
  // in leather with a brass buckle, a helm with its eye slit toward the room.
  armorStand: (box) => {
    box(5, 1, 11, 19, 2, 13, WOOD_DARK); // the foot, crossed
    box(11, 1, 5, 13, 2, 19, WOOD_DARK);
    box(11, 3, 11, 13, 14, 13, WOOD); // the post
    box(7, 15, 9, 17, 25, 15, (u, y) => ((u + y) % 2 === 0 ? IRON_LIGHT : IRON)); // mail
    box(5, 24, 9, 19, 26, 15, (u, y) => ((u + y) % 2 === 0 ? IRON_LIGHT : IRON)); // its shoulders
    box(7, 17, 9, 17, 17, 15, FUR_DARK); // the belt
    box(12, 17, 16, 12, 17, 16, BRASS); // its buckle
    box(11, 27, 11, 13, 27, 13, WOOD); // the neck
    box(8, 28, 8, 16, 32, 16, (_u, y, v) => (v === 16 && y === 30 ? COAL : IRON)); // the helm, its slit
    box(9, 33, 9, 15, 33, 15, IRON_LIGHT); // its crown, lit
  },
  // A stone wheel on an axle between two posts, over a little trough of
  // water, a crank to one side and a pedal at its foot.
  grindstone: (box) => {
    box(8, 1, 8, 16, 3, 16, (u, y, v) => (y === 3 && u > 8 && u < 16 && v > 8 && v < 16 ? WATER : WOOD_DARK)); // the trough
    for (const u of [5, 18]) box(u, 1, 10, u + 1, 12, 14, WOOD); // the posts
    box(5, 10, 12, 20, 10, 12, IRON); // the axle
    for (let y = 4; y <= 16; y++) {
      for (let v = 6; v <= 18; v++) {
        const d = Math.hypot(y - 10, v - 12);
        if (d <= 6) box(10, y, v, 13, y, v, d > 5 ? STONE_DARK : STONE); // the wheel, its rim darker
      }
    }
    box(20, 10, 12, 20, 13, 12, WOOD_LIGHT); // the crank's handle
    box(3, 1, 17, 9, 1, 19, WOOD_LIGHT); // the pedal
  },
  // Hung on a wall: a board of his tools, tongs, two hammers and a file.
  toolBoard: (box) => {
    box(3, 13, 0, 21, 29, 1, (u, y) => (u === 3 || u === 21 || y === 13 || y === 29 ? WOOD_DARK : WOOD)); // the board, framed
    for (const u of [6, 8]) box(u, 15, 2, u, 26, 2, IRON); // the tongs' jaws and handles,
    box(6, 22, 2, 8, 22, 2, IRON_LIGHT); // their pivot
    box(12, 15, 2, 12, 24, 2, WOOD_DARK); // a hammer: its handle,
    box(10, 25, 2, 14, 27, 2, IRON); // its head
    box(17, 16, 2, 17, 26, 2, IRON_LIGHT); // a file,
    box(17, 14, 2, 17, 15, 2, WOOD_DARK); // its handle
    box(20, 17, 2, 20, 23, 2, WOOD); // a small hammer
    box(19, 24, 2, 20, 25, 2, IRON);
  },
};

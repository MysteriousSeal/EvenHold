// The smithy's own furniture in voxels (see furnitureVoxels.ts for how
// pieces are painted): the forge and what stands round it (its bellows, the
// quench trough, the anvil, a heap of coal, a grindstone), where the smith
// trades (a stout counter, a ledger and a scale on it), what he works with (a
// board of tools, the salvage bench), and what he sells, on show (a rack and
// a wall of weapons, suits of armour on stands). The soot and scale on the
// floor round them are the room's (smithyShell.ts).

import { WOOD, WOOD_DARK, WOOD_LIGHT, IRON, IRON_LIGHT, STONE, STONE_DARK, BRASS, BRASS_DARK, FUR_DARK, CLAY, CLAY_DARK, RED, RED_DARK, PARCHMENT, INK, COAL, SOOT, FIRE, EMBER, QUENCH, QUENCH_LIGHT, HOT_IRON, CINDER, SOOT_LIGHT, IRON_EDGE, SMITHY_STONE, SMITHY_STONE_DARK, SMITHY_MORTAR, SCALE, FUR as RUST, type Box } from './furniturePalette';
import type { Furniture } from '../../model/interiors/furniture';
import { hashUnit } from '../../util/random';

export type SmithyKind = 'forge' | 'anvil' | 'trough' | 'rack' | 'coal' | 'barStock' | 'scrapHeap' | 'bladeCrate' | 'wheelRim' | 'smithCounter' | 'bellows' | 'weaponWall' | 'armorStand' | 'grindstone' | 'toolBoard' | 'salvageBench';

// Water standing in a vessel over u0..u1, v0..v1 at height y: dark, its rim a voxel lighter where it meets the sides.
const water = (box: Box, u0: number, v0: number, u1: number, v1: number, y: number) => box(u0, y, v0, u1, y, v1, (u, _y, v) => (u === u0 || u === u1 || v === v0 || v === v1 ? QUENCH_LIGHT : QUENCH));

// A horseshoe hung flat on a wall at (u, y), v out from it: five wide, six high, its opening up (to hold its luck).
export const horseshoe = (box: Box, u: number, y: number, v: number) => {
  box(u + 1, y, v, u + 3, y, v, IRON); // its toe,
  for (const side of [u, u + 4]) box(side, y + 1, v, side, y + 5, v, (_u, yy) => (yy === y + 5 ? IRON_LIGHT : IRON)); // its branches, their heels worn bright
};

export const SMITHY_PAINTERS: Record<SmithyKind, (box: Box, len: number, dep: number, item: Furniture) => void> = {
  // The forge, the room's heart, on the back wall: its hearth laid in the
  // room's cold stone (joints staggered, heat-stained above the mouth), its
  // firebox mouth hot all through, its front ledge the brightest stone in the
  // room; a bed of coals on top white-hot at its heart and black at its rim
  // (the fire burns there: fireOf), a bar of stock in it glowing at its
  // buried end and out over the ledge, the tongs left beside it; over it all
  // a stepped hood black with soot on two iron posts, its rim lit from below,
  // and a sooted flue up the wall.
  forge: (box, len) => {
    const mid = (len - 1) / 2;
    const m = Math.floor(mid); // (in whole voxels)
    box(1, 1, 0, len - 2, 10, 16, (u, y, v) => {
      const course = Math.floor(y / 3);
      if (y % 3 === 1 || (u + course * 4) % 8 === 0) return SMITHY_MORTAR; // the joints
      if (v === 16 && y >= 7 && Math.abs(u - mid) < 12 - (10 - y) * 2) return SOOT; // stained above the mouth
      return (Math.floor((u + course * 4) / 8) + course) % 3 === 0 ? SMITHY_STONE_DARK : SMITHY_STONE;
    });
    box(0, 11, 0, len - 1, 11, 17, (_u, _y, v) => (v >= 14 ? STONE : v === 13 ? STONE_DARK : SMITHY_STONE_DARK)); // its top, the front ledge lit
    box(18, 3, 13, len - 19, 8, 17, 0); // the firebox mouth,
    box(18, 3, 13, len - 19, 8, 13, (u, y) => (y === 8 ? FIRE : hashUnit(u, y, 9) < 0.3 ? FIRE : EMBER)); // hot at its back,
    box(18, 2, 14, len - 19, 2, 17, (u, _y, v) => (hashUnit(u, v, 8) < 0.35 ? EMBER : FIRE)); // and on its floor
    box(8, 12, 3, len - 9, 12, 12, (u, _y, v) => {
      const heat = 1 - Math.hypot((u - mid) / 17, (v - 7.5) / 5.5) + (hashUnit(u, v, 3) - 0.5) * 0.35; // hottest at the heart
      return u === 8 || u === len - 9 || v === 3 || v === 12 || heat < 0.2 ? COAL : heat < 0.55 ? FIRE : EMBER;
    }); // the bed of coals
    box(m - 3, 13, 6, m + 3, 13, 9, (u, _y, v) => (hashUnit(u, v, 5) < 0.6 ? EMBER : FIRE)); // heaped at its heart
    for (let v = 6; v <= 15; v++) {
      const y = v <= 11 ? 13 : 12; // (out over the ledge, lower)
      box(m + 5, y, v, m + 6, y + 1, v, v <= 8 ? EMBER : v <= 11 ? HOT_IRON : IRON); // the bar: buried, glowing, cooling
    }
    for (const u of [m - 7, m - 4]) box(u, 12, 13, u, 12, 17, IRON); // the tongs on the ledge: their arms,
    box(m - 6, 12, 14, m - 5, 12, 14, IRON_LIGHT); // their pivot
    for (const u of [5, len - 7]) box(u, 12, 13, u + 1, 19, 14, IRON); // the hood's posts
    for (let y = 20; y <= 24; y++) {
      const inset = y - 20;
      const front = 14 - inset; // (stepping back gently: its top shades the flue from the fire)
      box(4 + inset, y, 0, len - 5 - inset, y, front, (u, yy, v) => (yy === 20 ? (v >= 13 ? CINDER : IRON) : (u + yy * 4) % 9 === 0 ? SOOT_LIGHT : SOOT)); // the hood, stepped in, on its rim
    }
    box(17, 25, 0, len - 18, 33, 4, (u, y) => (y === 33 ? SOOT : (u + Math.floor(y / 3) * 4) % 8 === 0 || y % 3 === 0 ? SOOT : COAL)); // the flue, coursed, blackest of all (the fire lights its face)
  },

  // An anvil on a stump: the stump banded in iron, its top ringed; a narrow
  // iron waist, a broad face (its working top lit, catching the forge), a
  // horn stepping to a bright point on one side, a square heel on the other,
  // the hardy hole in it; a hammer laid on the face, and a little slack tub
  // of water, banded, against the stump's side.
  anvil: (box) => {
    box(8, 1, 8, 16, 6, 16, (u, y, v) => (y === 3 ? IRON : y === 6 ? ((u + v) % 3 === 0 ? WOOD_DARK : WOOD_LIGHT) : WOOD_DARK)); // the stump
    box(10, 7, 10, 14, 8, 14, IRON); // the waist
    box(6, 9, 9, 19, 11, 15, (_u, y) => (y === 11 ? IRON_LIGHT : IRON)); // the face
    box(3, 10, 10, 5, 11, 14, (_u, y) => (y === 11 ? IRON_LIGHT : IRON)); // the horn,
    box(1, 10, 11, 2, 10, 13, IRON_EDGE); // to its point
    box(20, 9, 10, 21, 11, 14, IRON); // the heel
    box(17, 11, 12, 17, 11, 12, COAL); // the hardy hole
    box(9, 12, 10, 12, 13, 11, (_u, y) => (y === 13 ? IRON_LIGHT : IRON)); // a hammer on the face: its head,
    box(13, 12, 10, 20, 12, 10, WOOD_DARK); // its handle
    box(17, 1, 17, 22, 7, 22, (u, y, v) => (y === 2 || y === 6 ? IRON : u === 17 || u === 22 || v === 17 || v === 22 || y === 1 ? WOOD : 0)); // the slack tub,
    water(box, 18, 18, 21, 21, 5); // its water
  },

  // The quench trough: heavy planks on a dark foot, bound in iron all
  // round, a lit rim, dark water standing inside (its edge catching the
  // light), a ladle hung over the side.
  trough: (box, len, _dep, item) => {
    const back = item.wall === 'back' ? -5 : 0; // against the back wall: drawn right up to it
    const b: Box = (u0, y0, v0, u1, y1, v1, color) => box(u0, y0, v0 + back, u1, y1, v1 + back, typeof color === 'number' ? color : (u, y, v) => color(u, y, v - back));
    b(2, 1, 5, len - 3, 1, 19, WOOD_DARK); // the foot
    b(2, 2, 5, len - 3, 9, 19, (u, y) => (u % 16 === 8 || y === 4 ? IRON : WOOD)); // the sides, banded
    b(2, 9, 5, len - 3, 9, 19, WOOD_LIGHT); // the rim
    b(4, 2, 7, len - 5, 9, 17, 0); // hollow,
    b(4, 2, 7, len - 5, 6, 17, QUENCH); // full of water,
    water(b, 4, 7, len - 5, 17, 7); // its top
    b(len - 10, 10, 9, len - 10, 10, 19, WOOD_LIGHT); // the ladle's handle, over the rim,
    b(len - 11, 7, 10, len - 9, 9, 12, IRON); // its cup in the water
  },

  // A weapon rack against the wall: two posts, a slotted base and a lit top
  // rail, swords and spears standing in it by turns, leaning on the rail.
  rack: (box, len) => {
    box(2, 1, 2, len - 3, 2, 9, (u) => (u % 8 === 0 ? SOOT : WOOD_DARK)); // the base, slotted
    for (const u of [2, len - 3]) box(u, 1, 2, u + 1, 18, 4, WOOD_DARK); // the posts
    box(2, 18, 2, len - 3, 19, 4, (_u, y) => (y === 19 ? WOOD_LIGHT : WOOD)); // the rail
    for (let i = 0, u = 8; u < len - 6; u += 8, i++) {
      if (i % 2 === 0) {
        box(u, 3, 5, u, 13, 5, IRON_LIGHT); // a sword: its blade,
        box(u - 1, 14, 5, u + 1, 14, 5, BRASS); // guard,
        box(u, 15, 4, u, 17, 4, WOOD_DARK); // grip, against the rail
      } else {
        box(u, 3, 5, u, 17, 4, WOOD); // a spear: its shaft,
        box(u, 20, 3, u, 22, 3, IRON_LIGHT); // its point, over the rail
      }
    }
    box(3, 31, 0, len - 4, 31, 1, WOOD_DARK); // over it, a peg rail of horseshoes for sale
    for (let u = 5; u + 4 < len - 4; u += 10) horseshoe(box, u, 24, 1);
  },

  // A heap of coal, stepping up to a peak, its lumps catching the light
  // here and there, a shovel stuck in it.
  coal: (box) => {
    const layers: Array<[number, number]> = [[3, 2], [6, 4], [9, 5], [11, 6]]; // [inset, top] of each step
    let from = 1;
    for (const [inset, top] of layers) {
      box(inset, from, inset, 24 - inset, top, 24 - inset, (u, y, v) => {
        if ((u === inset || u === 24 - inset) && (v === inset || v === 24 - inset)) return 0;
        const n = hashUnit(u * 3 + y, v, 8);
        return n < 0.08 ? IRON : n < 0.4 ? SOOT : COAL; // glinting lumps
      });
      from = top + 1;
    }
    box(16, 4, 11, 18, 5, 13, IRON); // the shovel's blade, in the heap,
    box(17, 6, 12, 17, 15, 12, WOOD); // its handle
    box(16, 16, 12, 18, 16, 12, WOOD_DARK); // its grip
  },

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
  // between a board below and one above, a handle out front, an iron nozzle
  // reaching into the forge's side.
  bellows: (box, _len, _dep, item) => {
    for (const [u, v] of [[5, 3], [19, 3], [5, 13], [19, 13]]) box(u, 1, v, u, 2, v, WOOD_DARK); // feet
    box(4, 3, 2, 20, 3, 14, WOOD_DARK); // the lower board
    for (let y = 4; y <= 8; y++) box(5, y, 3, 19, y, 13 - (y - 4), y % 2 === 0 ? CLAY : CLAY_DARK); // the leather, folded
    box(4, 9, 2, 20, 9, 10, WOOD); // the upper board
    box(10, 10, 8, 14, 10, 15, WOOD_LIGHT); // its handle
    const toForge = item.side ?? 1; // (along the wall, the way the forge is)
    if (toForge > 0) box(20, 5, 6, 24, 6, 8, IRON); // the nozzle, into the forge's side
    else box(0, 5, 6, 4, 6, 8, IRON);
    // Over it, on the wall by the fire, a rail of the tools he works it with: three tongs and two hammers hung.
    box(1, 25, 0, 23, 25, 2, WOOD_DARK);
    for (const u of [3, 8, 13]) {
      for (const arm of [u, u + 2]) box(arm, 15, 3, arm, 24, 3, IRON); // a pair of tongs: its arms,
      box(u, 20, 3, u + 2, 20, 3, IRON_LIGHT); // their rivet,
      box(u + 1, 14, 3, u + 1, 14, 3, IRON_LIGHT); // their jaws met
    }
    for (const u of [18, 21]) {
      box(u, 18, 3, u, 24, 3, WOOD_DARK); // a hammer: its handle,
      box(u - 1, 16, 3, u + 1, 17, 4, (_u, y) => (y === 17 ? IRON_LIGHT : IRON)); // its head
    }
  },
  // A bundle of iron bars, stock for the forge, stood on end in a corner, leaning back against the wall, bound with a
  // leather strap: their sides dark with scale, their cut ends bright.
  barStock: (box) => {
    for (let i = 0; i < 7; i++) {
      const u = 6 + i * 2 + (i % 2);
      const top = 18 + ((i * 5) % 4);
      for (let y = 1; y <= top; y++) {
        const v = 7 - Math.floor((y * 4) / top) + (i % 3 === 0 ? 1 : 0); // (leaning in toward the wall as it rises)
        box(u, y, v, u + 1, y, v + 1, y === top ? IRON_EDGE : SCALE);
      }
    }
    box(6, 11, 4, 20, 12, 7, (u, _y, v) => (v === 7 || u === 6 || u === 20 ? CLAY_DARK : 0)); // the strap round them
  },
  // A crate of new blades by the counter, hilts up: an oak box, banded, the
  // swords stood in it, their grips, guards and pommels showing, one drawn
  // half out, its blade bright.
  bladeCrate: (box) => {
    box(5, 1, 6, 19, 9, 18, (u, y, v) => (y === 1 || y === 9 || u === 5 || u === 19 || v === 6 || v === 18 ? ((u + v + y) % 7 === 0 ? WOOD_DARK : WOOD) : 0)); // the crate,
    box(5, 5, 6, 19, 5, 18, (u, _y, v) => (u === 5 || u === 19 || v === 6 || v === 18 ? IRON : 0)); // banded
    box(6, 2, 7, 18, 8, 17, WOOD_DARK); // its dark inside, full
    for (const [u, v] of [[8, 9], [12, 10], [16, 9], [9, 14], [14, 15]]) {
      box(u - 1, 10, v, u + 1, 10, v, BRASS); // a guard,
      box(u, 11, v, u, 13, v, WOOD_DARK); // its grip
      box(u, 14, v, u, 14, v, BRASS_DARK); // and pommel
    }
    box(12, 11, 13, 12, 17, 13, (_u, y) => (y === 17 ? IRON_EDGE : IRON_LIGHT)); // one drawn half out, bright
    box(11, 18, 13, 13, 18, 13, BRASS);
    box(12, 19, 13, 12, 20, 13, WOOD_DARK);
  },
  // A cartwheel's iron tyre, waiting to be shrunk on, stood on its edge and
  // leant toward the wall at the right, lit along its top.
  wheelRim: (box) => {
    for (let y = 1; y <= 15; y++) {
      for (let v = 4; v <= 20; v++) {
        if (Math.abs(Math.hypot(v - 12, y - 8) - 7) < 0.6) box(20 + (y >> 2), y, v, 21 + (y >> 2), y, v, y > 10 ? IRON_LIGHT : IRON);
      }
    }
  },
  // A heap of scrap waiting by the salvage bench: rusted iron stepped up to a peak, a broken blade sticking up from
  // it, a dented helm, a horseshoe, a bar or two.
  scrapHeap: (box) => {
    const layers: Array<[number, number]> = [[4, 2], [7, 4], [10, 6]]; // [inset, top] of each step
    let from = 1;
    for (const [inset, top] of layers) {
      box(inset, from, inset + 2, 24 - inset, top, 22 - inset, (u, y, v) => {
        const n = hashUnit(u * 3 + y, v, 11);
        return n < 0.35 ? CLAY_DARK : n < 0.6 ? RUST : n < 0.85 ? SCALE : IRON;
      });
      from = top + 1;
    }
    box(9, 7, 11, 9, 14, 11, (_u, y) => (y === 14 ? IRON_EDGE : IRON_LIGHT)); // a blade, snapped,
    box(8, 7, 11, 10, 7, 11, BRASS_DARK); // its guard in the heap
    box(13, 7, 12, 17, 9, 15, (_u, y) => (y === 9 ? IRON_LIGHT : IRON)); // a helm, dented
    box(14, 10, 13, 16, 10, 14, IRON);
    box(5, 3, 18, 15, 3, 19, SCALE); // a bar, along its foot
    horseshoe(box, 17, 1, 20); // a horseshoe, propped
  },
  // Hung on a wall: a dark board with a sword, an axe and a spear pegged to it.
  weaponWall: (box) => {
    box(2, 12, 0, 22, 28, 1, (u, y) => (u === 2 || u === 22 || y === 12 || y === 28 ? WOOD_DARK : FUR_DARK)); // the board, framed
    box(6, 14, 2, 6, 23, 2, (_u, y) => (y === 14 ? IRON_EDGE : IRON_LIGHT)); // the sword: its blade, its point bright,
    box(4, 24, 2, 8, 24, 2, BRASS); // guard,
    box(6, 25, 2, 6, 26, 2, WOOD_DARK); // grip
    box(6, 27, 2, 6, 27, 2, BRASS_DARK); // and pommel
    box(12, 13, 2, 12, 27, 2, WOOD); // the axe: its haft,
    box(13, 22, 2, 15, 26, 2, (u) => (u === 15 ? IRON_EDGE : IRON)); // its head, the edge bright
    box(18, 13, 2, 18, 24, 2, WOOD); // the spear: its shaft,
    box(17, 25, 2, 19, 25, 2, IRON); // socket,
    box(18, 26, 2, 18, 27, 2, IRON_EDGE); // and point
  },
  // A suit of armour on a stand, backed against the wall, its front toward
  // the room: a cross foot and a post, and one of four suits (`suit`), each
  // its own at a glance: chain mail and a nasal cap; plate, broad pauldrons
  // and a great helm; studded leather and a leather cap; a red brigandine
  // riveted in brass under a wide-brimmed kettle helm.
  armorStand: (box, _len, _dep, item) => {
    const c = 10; // its middle, out from the wall
    const front = c + 3; // the torso's front face
    box(5, 1, c - 1, 19, 2, c + 1, WOOD_DARK); // the foot, crossed
    box(11, 1, c - 7, 13, 2, c + 7, WOOD_DARK);
    box(11, 3, c - 1, 13, 14, c + 1, WOOD); // the post
    box(10, 26, c - 2, 14, 29, c + 2, WOOD); // the head
    const torso = (color: (u: number, y: number, v: number) => number) => box(7, 15, c - 3, 17, 25, c + 3, color);
    const belt = (color: number) => {
      box(7, 17, c - 3, 17, 17, c + 3, color);
      box(12, 17, front + 1, 12, 17, front + 1, BRASS); // its buckle
    };
    switch (item.suit ?? 0) {
      case 1: // plate
        torso((u, y) => (u === 7 || u === 17 || y === 15 ? IRON : u === 12 ? IRON_LIGHT : y > 21 ? IRON_LIGHT : IRON)); // smooth, a ridge down its middle
        box(4, 23, c - 4, 20, 27, c + 4, (_u, y) => (y === 27 ? IRON_LIGHT : IRON)); // broad pauldrons, their tops lit
        box(7, 16, c - 3, 17, 16, c + 3, IRON); // a plate belt
        box(8, 27, c - 4, 16, 33, c + 4, (u, y, v) => (y === 33 ? IRON_LIGHT : v === c + 4 && y === 30 && u > 8 && u < 16 ? COAL : v === c + 4 && y === 28 && (u === 11 || u === 13) ? COAL : IRON)); // the great helm, flat-topped: its slit and breaths
        break;
      case 2: // studded leather
        torso((u, y, v) => (v === front && (u + y) % 3 === 0 ? BRASS : u === 7 || u === 17 ? CLAY_DARK : CLAY));
        box(6, 24, c - 3, 18, 25, c + 3, CLAY_DARK); // leather shoulders
        belt(FUR_DARK);
        box(9, 29, c - 3, 15, 31, c + 3, CLAY_DARK); // the cap,
        box(10, 32, c - 2, 14, 32, c + 2, CLAY); // its crown
        break;
      case 3: // brigandine
        torso((u, y, v) => (v === front && u % 2 === 0 && y % 3 === 0 ? BRASS : v === front && u % 2 === 0 ? RED : RED_DARK)); // dark red cloth, riveted, the rivets' columns brighter
        box(6, 24, c - 3, 18, 25, c + 3, RED_DARK); // its shoulders
        belt(FUR_DARK);
        box(6, 29, c - 6, 18, 29, c + 6, IRON); // the kettle helm's brim,
        box(9, 30, c - 3, 15, 32, c + 3, IRON); // its dome,
        box(10, 33, c - 2, 14, 33, c + 2, IRON_LIGHT); // lit on top
        break;
      default: // chain mail
        torso((u, y) => ((u + y) % 2 === 0 ? IRON_LIGHT : IRON));
        box(5, 24, c - 3, 19, 26, c + 3, (u, y) => ((u + y) % 2 === 0 ? IRON_LIGHT : IRON)); // mail over the shoulders
        belt(FUR_DARK);
        box(9, 29, c - 3, 15, 31, c + 3, IRON); // the nasal cap,
        box(10, 32, c - 2, 14, 32, c + 2, IRON_LIGHT); // its crown lit,
        box(12, 26, c + 3, 12, 28, c + 3, IRON_LIGHT); // its nose guard
    }
  },

  // A stone wheel on an axle between two posts, over a little trough of
  // water, a crank to one side and a pedal at its foot.
  grindstone: (box) => {
    box(8, 1, 8, 16, 3, 16, (u, y, v) => (y === 3 && u > 8 && u < 16 && v > 8 && v < 16 ? (u === 9 || u === 15 || v === 9 || v === 15 ? QUENCH_LIGHT : QUENCH) : WOOD_DARK)); // the trough
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
  // The salvage bench (skills/salvage.ts): a heavy workbench on two trestles, a thick plank top with its grain in
  // darker runs, an iron vice at its left end (bright along the jaws, a scrap plank held in them, the screw out the
  // front toward the door), and the day's work left on it: a mallet along the back, tongs along the front, a heap of
  // rusted scrap by the vice. Its silhouette the vice's block up off the slab: a bench to work at, not to sit on.
  salvageBench: (box) => {
    const [U, V] = [3, 8]; // its corner in the tile (18 along, 9 deep, centred)
    const b = (u0: number, y0: number, v0: number, u1: number, y1: number, v1: number, color: number) => box(U + u0, y0 + 1, V + v0, U + u1, y1 + 1, V + v1, color);
    const [PLANK, GRAIN, TRESTLE, VICE, EDGE, RUST, PALE] = [WOOD, WOOD_DARK, WOOD_DARK, IRON, IRON_LIGHT, RED_DARK, WOOD_LIGHT]; // (the room's palette)
    for (const u of [2, 15]) {
      b(u - 1, 0, 1, u + 1, 0, 7, TRESTLE); // a trestle's foot, across
      b(u, 1, 3, u, 8, 5, TRESTLE); // its post
      b(u - 1, 7, 2, u + 1, 8, 6, TRESTLE); // the bearer under the top
    }
    b(4, 4, 4, 13, 4, 4, TRESTLE); // a stretcher between them
    b(0, 9, 0, 17, 10, 8, PLANK); // the top, a thick slab
    for (const v of [2, 5]) b(0, 10, v, 17, 10, v, GRAIN); // its grain
    b(0, 8, 0, 17, 8, 0, GRAIN); // an apron along the back
    b(0, 11, 2, 3, 13, 6, VICE); // the vice's jaws
    b(0, 14, 2, 3, 14, 6, EDGE); // bright along the top
    b(1, 12, 3, 2, 13, 5, PLANK); // a scrap plank held in them
    b(0, 12, 7, 0, 12, 8, VICE); // the screw, out the front
    b(0, 11, 8, 0, 13, 8, EDGE); // its handle, upright
    b(11, 11, 6, 14, 13, 7, PALE); // a mallet's head, along the back
    b(6, 11, 6, 10, 11, 6, TRESTLE); // its handle, toward the vice
    b(6, 11, 1, 12, 11, 1, VICE); // tongs along the front: two arms
    b(6, 11, 2, 11, 11, 2, VICE);
    b(12, 11, 1, 13, 11, 2, EDGE); // meeting at the jaws
    b(4, 11, 3, 6, 11, 5, RUST); // scraps of rusted iron, heaped by the vice
    b(5, 12, 4, 5, 12, 4, RUST);
    b(7, 11, 4, 7, 11, 4, VICE);
  },
  // Hung on a wall: a board of his tools, tongs, two hammers and a file
  // (its foot over a counter's top, should one stand below).
  toolBoard: (box) => {
    box(3, 17, 0, 21, 30, 1, (u, y) => (u === 3 || u === 21 || y === 17 || y === 30 ? WOOD_DARK : WOOD)); // the board, framed
    for (const u of [6, 8]) box(u, 19, 2, u, 28, 2, IRON); // the tongs' jaws and handles,
    box(6, 25, 2, 8, 25, 2, IRON_LIGHT); // their pivot
    box(12, 19, 2, 12, 25, 2, WOOD_DARK); // a hammer: its handle,
    box(10, 26, 2, 14, 28, 2, IRON); // its head
    box(17, 21, 2, 17, 28, 2, IRON_LIGHT); // a file,
    box(17, 19, 2, 17, 20, 2, WOOD_DARK); // its handle
    box(20, 20, 2, 20, 25, 2, WOOD); // a small hammer
    box(19, 26, 2, 20, 27, 2, IRON);
  },

};

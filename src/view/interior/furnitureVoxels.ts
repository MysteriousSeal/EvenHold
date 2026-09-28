// Furniture in voxels, painted straight into the room's grid (roomVoxels.ts)
// at the world's 0.04 scale, 25 voxels to a floor tile. Each piece is
// drawn in its own frame: u along the wall it stands against, v out from
// it, y up; pieces against the left wall turn to face into the room.

import type { Furniture } from '../../model/interiors/furniture';
import type { VoxelGrid } from '../meshes/voxel/greedyMesh';
import { fillBox } from '../meshes/voxel/voxelShapes';

const TILE = 25;

// Colors, after the room's own (roomVoxels.ts ROOM_PALETTE): palette index + 1.
export const FURNITURE_PALETTE = [
  0x8a5a35, // 14 wood
  0x5e3f28, // 15 wood, dark
  0xb08a5a, // 16 wood, light
  0x9a3a2a, // 17 red cloth
  0x2f9c9a, // 18 teal cloth
  0xe8dcc0, // 19 linen
  0xff8a2a, // 20 fire
  0xffd070, // 21 embers
  0x5a5e66, // 22 iron
  0x8d939c, // 23 iron, light
  0x2e2a28, // 24 soot
  0xd4b060, // 25 brass
  0x3dbdb8, // 26 water
  0x1e1c1a, // 27 coal
  0x9a948a, // 28 stone
  0x7e786e, // 29 stone, dark
];
const [WOOD, WOOD_DARK, WOOD_LIGHT, RED, TEAL, LINEN, FIRE, EMBER, IRON, IRON_LIGHT, SOOT, BRASS, WATER, COAL, STONE, STONE_DARK] = FURNITURE_PALETTE.map((_, i) => 14 + i);

// A tankard of ale standing at (u, y, v): a wooden body with iron hoops,
// a white head of foam, and a handle on its side.
function tankard(box: Box, u: number, y: number, v: number): void {
  box(u, y, v, u + 2, y + 3, v + 2, (_u, yy) => (yy === y || yy === y + 3 ? IRON : WOOD_LIGHT));
  box(u, y + 4, v, u + 2, y + 4, v + 2, LINEN); // foam
  box(u + 3, y + 1, v + 1, u + 3, y + 2, v + 1, IRON); // handle
}

type Box = (u0: number, y0: number, v0: number, u1: number, y1: number, v1: number, color: number | ((u: number, y: number, v: number) => number)) => void;

// How each piece looks, drawn in a frame `len` voxels along the wall and `dep` out from it.
const PAINTERS: Record<Furniture['kind'], (box: Box, len: number, dep: number) => void> = {
  // A rustic stone fireplace: irregular stones in mixed shades and dark
  // mortar, a stepped arch over the opening (sooted above), a thick timber
  // mantel with a candle, a clay pot and a pewter plate, a chimney breast
  // narrowing upward. Inside, logs on a bed of embers (the flames rise from
  // them, fire.ts) and an iron pot hung from a crane; split logs stacked
  // against the right side.
  hearth: (box) => {
    const MORTAR = 7;
    const shades = [STONE, STONE_DARK, 11, 5];
    // Irregular stones: courses 4 high, blocks 5-8 wide, their joints staggered by course.
    const stone = (u: number, y: number) => {
      const course = Math.floor(y / 4);
      if (y % 4 === 0) return MORTAR;
      const shifted = u + course * 3;
      const width = 5 + (course % 4);
      if (shifted % width === 0) return MORTAR;
      return shades[(course * 7 + Math.floor(shifted / width) * 5) % shades.length];
    };
    const stones = (u0: number, y0: number, v0: number, u1: number, y1: number, v1: number) => box(u0, y0, v0, u1, y1, v1, (u, y) => stone(u, y));
    // The stepped arch's underside over the opening (u 12-37): higher toward the middle.
    const archTop = (u: number) => 14 + Math.min(4, Math.floor(Math.min(u - 12, 37 - u) / 3));
    box(1, 1, 0, 48, 2, 15, (u, _y, v) => ((u + v * 3) % 9 === 0 ? MORTAR : (u * 3 + v) % 5 === 0 ? STONE_DARK : STONE)); // hearth slab
    stones(3, 3, 0, 11, 20, 11); // left jamb
    stones(38, 3, 0, 46, 20, 11); // right jamb
    for (let u = 12; u <= 37; u++) stones(u, archTop(u) + 1, 0, u, 20, 11); // the arch
    for (let u = 12; u <= 37; u++) box(u, archTop(u) + 1, 11, u, archTop(u) + 2, 11, SOOT); // soot above the opening
    box(12, 3, 0, 37, 16, 2, SOOT); // the back of the fire
    // Mantel, with a candle, a clay pot and a pewter plate on it.
    box(1, 21, 0, 48, 23, 13, (u, y) => (y === 21 ? WOOD_DARK : u % 11 === 0 ? WOOD_DARK : WOOD));
    box(7, 24, 8, 8, 27, 9, LINEN); // candle
    box(7, 28, 8, 7, 28, 8, EMBER); // its flame
    box(19, 24, 5, 23, 27, 9, RED); // clay pot
    box(20, 28, 6, 22, 28, 8, WOOD_DARK); // its lid
    box(32, 24, 3, 37, 29, 3, IRON_LIGHT); // pewter plate, standing
    // Chimney breast, narrowing.
    stones(6, 24, 0, 43, 28, 7);
    stones(10, 29, 0, 39, 33, 5);
    // The fire: a bed of embers, logs on it.
    box(13, 3, 3, 36, 3, 9, (u, _y, v) => ((u + v) % 3 === 0 ? FIRE : EMBER));
    box(15, 4, 4, 34, 5, 5, WOOD_DARK);
    box(17, 4, 6, 32, 5, 7, WOOD);
    box(19, 6, 5, 30, 6, 6, (u) => (u % 4 === 0 ? SOOT : WOOD_DARK));
    // An iron crane from the left jamb, a black pot hanging over the fire.
    box(12, 3, 3, 12, 15, 3, IRON); // upright
    box(12, 15, 3, 18, 15, 3, IRON); // arm, swung to the side of the flames
    box(16, 12, 3, 16, 14, 3, IRON); // chain
    box(13, 7, 1, 19, 11, 5, (_u, y) => (y === 11 ? IRON : SOOT)); // pot, rim on top
    // Three big logs stacked against the right jamb (two, and one resting
    // in the groove between them), lying toward the room: a rounded end
    // five voxels across, dark bark with a knot or two, and a cut face of
    // pale wood rings around a darker heart. Staggered in depth.
    const log = (u0: number, y0: number, front: number) => {
      for (let du = 0; du < 5; du++) {
        for (let dy = 0; dy < 5; dy++) {
          if ((du === 0 || du === 4) && (dy === 0 || dy === 4)) continue; // rounded corners
          const ring = Math.max(Math.abs(du - 2), Math.abs(dy - 2)); // 0 heart, 1 inner, 2 bark
          box(u0 + du, y0 + dy, 11, u0 + du, y0 + dy, front, (_u, _y, v) => {
            if (v === front) return ring === 0 ? WOOD : ring === 1 ? WOOD_LIGHT : WOOD_DARK; // the cut end
            return (v * 3 + du + u0) % 9 === 0 ? SOOT : WOOD_DARK; // bark, and a knot
          });
        }
      }
    };
    log(38, 1, 17);
    log(43, 1, 16);
    log(40, 5, 17);
  },
  // A wooden bed, lengthwise along the wall: a tall headboard at one end
  // and a low footboard at the other, a thick straw mattress, a pillow at
  // the head, a red blanket folded back at the top and hanging over the
  // sides, edged in teal.
  bed: (box, len, dep) => {
    box(1, 1, 2, len - 2, 4, dep - 3, WOOD); // the frame
    box(1, 1, 2, 3, 14, dep - 3, WOOD_DARK); // headboard
    box(1, 15, 3, 3, 15, dep - 4, WOOD); // its top rail
    box(len - 4, 1, 2, len - 2, 8, dep - 3, WOOD_DARK); // footboard
    box(4, 5, 3, len - 5, 7, dep - 4, WOOD_LIGHT); // straw mattress
    box(5, 8, 5, 12, 10, dep - 6, LINEN); // pillow
    box(14, 8, 3, 16, 8, dep - 4, LINEN); // the sheet, turned down
    box(17, 8, 3, len - 5, 8, dep - 4, (_u, _y, v) => (v === 3 || v === dep - 4 ? TEAL : RED)); // blanket
    for (const v of [2, dep - 3]) box(17, 5, v, len - 5, 8, v, RED); // hanging over the sides
  },
  // A table: dark legs, a rich wooden top, a linen runner down the middle with
  // a red edge, a lit candle on it and a wooden bowl.
  table: (box) => {
    for (const [u, v] of [[3, 3], [20, 3], [3, 20], [20, 20]]) box(u, 1, v, u + 1, 8, v + 1, WOOD_DARK);
    box(1, 9, 1, 23, 10, 23, (u) => (u % 6 === 0 ? WOOD_DARK : WOOD)); // richer than the floor, so it stands out
    box(1, 11, 8, 23, 11, 16, (_u, _y, v) => (v === 8 || v === 16 ? RED : LINEN)); // runner
    box(11, 12, 11, 12, 16, 12, LINEN); // candle
    box(11, 17, 11, 11, 17, 11, EMBER); // its flame
    box(16, 12, 3, 20, 13, 7, (u, y, v) => (y === 13 && u > 16 && u < 20 && v > 3 && v < 7 ? SOOT : WOOD_DARK)); // a bowl
  },
  // A chair, its back toward v = 0 and its seat facing +v (turned toward its
  // table in paintFurniture), pulled up to the front of its tile so it sits
  // right at the table's edge.
  chair: (box) => {
    const f = 6; // pulled forward, toward the table
    for (const [u, v] of [[7, 7 + f], [16, 7 + f], [7, 16 + f], [16, 16 + f]]) box(u, 1, v, u + 1, 6, v + 1, WOOD_DARK); // legs
    box(6, 7, 6 + f, 17, 8, 17 + f, WOOD); // seat
    box(7, 9, 8 + f, 16, 9, 16 + f, RED); // a red cushion
    for (const u of [6, 16]) box(u, 9, 6 + f, u + 1, 20, 7 + f, WOOD_DARK); // back posts
    box(6, 14, 6 + f, 17, 15, 7 + f, WOOD); // back rails
    box(6, 19, 6 + f, 17, 20, 7 + f, WOOD);
  },
  // A wooden chest: a planked body, a lid stepped up in the middle like a
  // rounded top, two iron bands wrapping over it and down the front, iron
  // corners, and a brass lock plate with a keyhole.
  chest: (box) => {
    const band = (u: number) => u === 7 || u === 17;
    box(3, 1, 5, 21, 8, 19, (u, y) => (band(u) ? IRON : y % 3 === 0 ? WOOD_DARK : WOOD)); // body, in planks
    box(3, 9, 5, 21, 10, 19, (u) => (band(u) ? IRON : WOOD_LIGHT)); // lid
    box(3, 11, 7, 21, 11, 17, (u) => (band(u) ? IRON : WOOD_LIGHT)); // stepped up
    box(3, 12, 9, 21, 12, 15, (u) => (band(u) ? IRON : WOOD));
    for (const [u, v] of [[3, 5], [21, 5], [3, 19], [21, 19]]) box(u, 1, v, u, 10, v, IRON); // corners
    box(11, 6, 20, 13, 9, 20, BRASS); // lock plate
    box(12, 7, 20, 12, 7, 20, SOOT); // keyhole
  },
  // A tall shelf against the wall, pots and a book on it.
  shelf: (box) => {
    for (const u of [2, 22]) box(u, 1, 1, u, 26, 7, WOOD_DARK);
    for (const y of [8, 16, 24]) box(2, y, 1, 22, y, 7, WOOD);
    box(5, 9, 2, 8, 12, 5, STONE); // a pot
    box(14, 17, 2, 16, 21, 6, RED); // a book
    box(17, 17, 2, 19, 20, 6, TEAL);
  },
  // A barrel: an eight-sided body in stepped voxels, bulging at the
  // middle, of vertical staves, two iron hoops, a lid with a rim and a bung.
  barrel: (box) => {
    const H = 16;
    for (let y = 1; y <= H; y++) {
      const r = y <= 2 || y >= H - 1 ? 6 : y <= 4 || y >= H - 3 ? 7 : 8; // bulging at the middle
      for (let du = -r; du <= r; du++) {
        for (let dv = -r; dv <= r; dv++) {
          if (Math.abs(du) + Math.abs(dv) > r + Math.floor(r / 2)) continue; // cut the corners: eight sides
          const top = y === H;
          const hoop = y === 4 || y === H - 3;
          const edge = Math.abs(du) + Math.abs(dv) >= r + Math.floor(r / 2) - 1 || Math.abs(du) === r || Math.abs(dv) === r;
          const color = top
            ? edge
              ? WOOD_DARK // the lid's rim
              : du === 3 && dv === 0
                ? SOOT // the bung
                : (du + 20) % 4 === 0
                  ? WOOD_DARK
                  : WOOD_LIGHT
            : hoop
              ? IRON
              : ((Math.abs(dv) >= Math.abs(du) ? du : dv) + 20) % 3 === 0
                ? WOOD_DARK // stave seams, running straight up each side
                : WOOD;
          box(12 + du, y, 12 + dv, 12 + du, y, 12 + dv, color);
        }
      }
    }
  },
  // A woven rug, flat on the floor: a teal field, a red border, a linen band.
  rug: (box, len, dep) =>
    box(4, 1, 4, len - 5, 1, dep - 5, (u, _y, v) => {
      const edge = Math.min(u - 4, v - 4, len - 5 - u, dep - 5 - v);
      return edge < 2 ? RED : edge < 4 ? LINEN : TEAL;
    }),
  // The inn's counter: a slim wooden bar (a third of a tile deep, in the
  // middle of its tiles) under an overhanging lighter top, tankards on it.
  counter: (box, len) => {
    box(1, 1, 8, len - 2, 11, 16, (u) => (u % 6 === 0 ? WOOD_DARK : WOOD));
    box(0, 12, 7, len - 1, 12, 17, WOOD_LIGHT);
    for (let u = 10; u < len - 6; u += 30) tankard(box, u, 13, 10);
  },
  // A keg on its side on a wooden cradle, pointing out into the room: an
  // eight-sided body of staves (v along its length), two iron hoops, the
  // front end in lighter wood with a dark rim and a brass tap.
  keg: (box) => {
    for (const v of [5, 16]) box(4, 1, v, 20, 3, v + 1, WOOD_DARK); // the cradle's two chocks
    const cu = 12;
    const cy = 10; // the keg's axis
    const r = 7;
    for (let du = -r; du <= r; du++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(du) + Math.abs(dy) > r + Math.floor(r / 2)) continue; // eight-sided, stepped
        const rim = Math.abs(du) + Math.abs(dy) >= r + Math.floor(r / 2) - 1 || Math.abs(du) === r || Math.abs(dy) === r;
        box(cu + du, cy + dy, 2, cu + du, cy + dy, 21, (_u, _y, v) => {
          if (v === 21) return rim ? WOOD_DARK : WOOD_LIGHT; // the front end
          if (v === 6 || v === 17) return IRON; // hoops
          return ((Math.abs(dy) >= Math.abs(du) ? du : dy) + 20) % 3 === 0 ? WOOD_DARK : WOOD; // staves
        });
      }
    }
    box(11, 7, 22, 13, 9, 22, BRASS); // the tap
    box(12, 5, 23, 12, 7, 23, BRASS); // its spout, pointing down
  },
  // The forge: a stone base, glowing coals in its hearth, a hood and a flue up the wall.
  forge: (box, len) => {
    box(1, 1, 0, len - 2, 11, 16, (u, y) => ((u + y) % 6 === 0 ? STONE_DARK : STONE));
    box(8, 11, 4, len - 9, 12, 12, (u, _y, v) => ((u + v) % 3 === 0 ? FIRE : EMBER));
    box(4, 20, 0, len - 5, 24, 14, IRON); // hood
    box(15, 25, 0, len - 16, 33, 7, SOOT); // flue
  },
  anvil: (box) => {
    box(9, 1, 9, 15, 5, 15, WOOD_DARK); // stump
    box(10, 6, 11, 14, 7, 13, IRON);
    box(5, 8, 10, 19, 10, 14, (u) => (u < 8 ? IRON_LIGHT : IRON)); // the horn at one end
  },
  trough: (box, len) => {
    box(2, 1, 5, len - 3, 8, 19, WOOD);
    box(4, 5, 7, len - 5, 7, 17, WATER);
  },
  // A weapon rack against the wall: two uprights, crossbars, blades resting on them.
  rack: (box, len) => {
    for (const u of [3, len - 4]) box(u, 1, 1, u, 20, 3, WOOD_DARK);
    for (const y of [8, 16]) box(3, y, 3, len - 4, y, 4, WOOD);
    for (let u = 8; u < len - 8; u += 7) box(u, 4, 5, u, 21, 5, IRON_LIGHT);
  },
  // An armchair turned to the fire: a deep red seat and back, wooden arms and legs.
  armchair: (box) => {
    for (const [u, v] of [[4, 5], [19, 5], [4, 19], [19, 19]]) box(u, 1, v, u + 1, 4, v + 1, WOOD_DARK); // legs
    box(4, 5, 5, 20, 8, 20, RED); // seat
    box(4, 9, 4, 20, 20, 7, (u, y) => (y >= 19 || u === 4 || u === 20 ? WOOD_DARK : RED)); // back, framed
    for (const u of [3, 21]) box(u, 5, 5, u, 12, 20, WOOD); // arms
  },
  // A bear's hide spread on the floor: a brown pelt, darker at the edges, the head at the far end.
  bearRug: (box, len, dep) => {
    box(6, 1, 4, len - 7, 1, dep - 5, (u, _y, v) => (u === 6 || u === len - 7 || v === 4 || v === dep - 5 ? WOOD_DARK : (u + v) % 5 === 0 ? WOOD_DARK : WOOD));
    for (const [u, v] of [[3, 6], [len - 5, 6], [3, dep - 9], [len - 5, dep - 9]]) box(u, 1, v, u + 2, 1, v + 3, WOOD_DARK); // paws
    box(len / 2 - 4, 1, dep - 4, len / 2 + 3, 3, dep - 1, WOOD_DARK); // head
    box(len / 2 - 2, 3, dep - 1, len / 2 + 1, 3, dep - 1, SOOT); // its snout
  },
  // A tall stool at the bar, a footrest round its legs, pulled up to the
  // front of its tile so it sits right at the counter.
  barStool: (box) => {
    const f = 7; // toward the bar
    for (const [u, v] of [[8, 8 + f], [15, 8 + f], [8, 15 + f], [15, 15 + f]]) box(u, 1, v, u + 1, 11, v + 1, WOOD_DARK);
    box(8, 5, 8 + f, 16, 5, 16 + f, WOOD); // footrest
    box(7, 12, 7 + f, 17, 13, 17 + f, WOOD); // seat
    box(8, 14, 9 + f, 16, 14, 16 + f, RED); // cushion
  },
  // Shelves of bottles behind the bar: a dark back panel in a framed case
  // under a crown moulding, three lipped shelves stocked with tall bottles
  // (turquoise, red wine, amber or clear glass, each corked), squat clay jugs
  // with handles and little flasks.
  bottleShelf: (box, len) => {
    box(1, 1, 0, len - 2, 31, 1, WOOD_DARK); // back panel
    for (const u of [1, len - 2]) box(u, 1, 0, u, 31, 8, WOOD); // sides
    box(0, 32, 0, len - 1, 33, 9, WOOD_DARK); // crown moulding
    box(1, 1, 0, len - 2, 2, 8, WOOD); // plinth
    const shelves = [10, 20];
    for (const y of shelves) {
      box(2, y, 1, len - 3, y, 7, WOOD);
      box(2, y + 1, 7, len - 3, y + 1, 7, WOOD_DARK); // a lip along the front
    }
    const glass = [TEAL, RED, BRASS, WATER];
    // Stock each shelf (and the floor of the case) with a run of vessels.
    for (const y of [3, 11, 21]) {
      let u = 4;
      let n = y;
      while (u < len - 6) {
        const kind = n % 5;
        if (kind === 0 || kind === 2 || kind === 4) {
          // A tall bottle: body, shoulder, neck, cork.
          const color = glass[(n + u) % glass.length];
          box(u, y, 3, u + 1, y + 4, 4, color);
          box(u, y + 5, 3, u, y + 6, 3, color);
          box(u, y + 7, 3, u, y + 7, 3, WOOD_DARK);
          u += 4;
        } else if (kind === 1) {
          // A squat clay jug with a handle.
          box(u, y, 2, u + 2, y + 3, 4, RED);
          box(u + 1, y + 4, 3, u + 1, y + 4, 3, RED);
          box(u + 3, y + 1, 3, u + 3, y + 2, 3, WOOD_DARK);
          u += 6;
        } else {
          // A little flask.
          box(u, y, 3, u + 1, y + 2, 4, LINEN);
          box(u, y + 3, 3, u, y + 3, 3, WOOD_DARK);
          u += 4;
        }
        n++;
      }
    }
  },
  // A tavern table laid for a meal: two plates, a loaf of bread, tankards, a candle.
  tavernTable: (box) => {
    for (const [u, v] of [[3, 3], [20, 3], [3, 20], [20, 20]]) box(u, 1, v, u + 1, 8, v + 1, WOOD_DARK);
    box(1, 9, 1, 23, 10, 23, (u) => (u % 6 === 0 ? WOOD_DARK : WOOD));
    for (const [u, v] of [[3, 3], [15, 15]]) box(u, 11, v, u + 5, 11, v + 5, IRON_LIGHT); // plates
    box(4, 12, 4, 7, 13, 6, WOOD_LIGHT); // bread on one
    box(16, 12, 16, 19, 12, 18, EMBER); // a roast on the other
    for (const [u, v] of [[17, 4], [4, 17]]) tankard(box, u, 11, v);
    box(11, 11, 11, 12, 15, 12, LINEN); // candle
    box(11, 16, 11, 11, 16, 11, EMBER);
  },
  // Antlers mounted on a wooden shield, high on the wall.
  antlers: (box) => {
    box(9, 18, 0, 15, 24, 1, WOOD); // plaque
    box(11, 20, 2, 13, 22, 3, WOOD_DARK); // the skull
    for (const [u0, u1] of [[3, 10], [14, 21]]) box(u0, 25, 2, u1, 25, 2, LINEN); // beams
    for (const u of [3, 6, 18, 21]) box(u, 25, 2, u, 29, 2, LINEN); // tines
  },
  // A kite shield on the wall, EvenHold's turquoise with a sand stripe, crossed swords behind.
  wallShield: (box) => {
    for (const y of [16, 30]) box(3, y, 0, 21, y, 1, IRON_LIGHT); // swords, crossed flat behind
    box(7, 18, 1, 17, 28, 2, (u, y) => (u === 7 || u === 17 || y === 28 ? IRON : u === 12 ? LINEN : TEAL));
    box(9, 16, 1, 15, 17, 2, TEAL); // tapering to its foot
    box(11, 15, 1, 13, 15, 2, IRON);
  },
  // A notice board by the door: a framed board with pinned papers.
  noticeBoard: (box) => {
    box(3, 10, 0, 21, 24, 1, (u, y) => (u === 3 || u === 21 || y === 10 || y === 24 ? WOOD_DARK : WOOD));
    for (const [u, y] of [[5, 18], [12, 13], [15, 19]]) box(u, y, 2, u + 4, y + 4, 2, LINEN); // papers
    for (const [u, y] of [[7, 22], [14, 17], [17, 23]]) box(u, y, 3, u, y, 3, RED); // pins
  },
  // A lantern on an iron bracket, glowing (its light is added in roomView.ts).
  wallLantern: (box) => {
    box(11, 22, 0, 13, 22, 5, IRON); // bracket
    box(10, 15, 4, 14, 21, 8, (u, y, v) => (y === 15 || y === 21 || (u === 10 || u === 14) && (v === 4 || v === 8) ? IRON : EMBER));
  },
  coal: (box) => {
    box(3, 1, 3, 21, 3, 21, COAL);
    box(7, 4, 7, 17, 5, 17, COAL);
    box(10, 6, 10, 14, 6, 14, SOOT);
  },
};

// Paints `items` into the room's grid, whose floor tile (0, 0) starts at voxel (x0, z0).
export function paintFurniture(grid: VoxelGrid, items: readonly Furniture[], x0: number, z0: number): void {
  for (const item of items) {
    const onLeft = item.wall === 'left';
    const len = (onLeft ? item.d : item.w) * TILE;
    const dep = (onLeft ? item.w : item.d) * TILE;
    const ox = x0 + item.x * TILE;
    const oz = z0 + item.z * TILE;
    if (item.facing) {
      paintFacing(grid, item, ox, oz);
      continue;
    }
    // u along the wall, v out from it: back wall u = x, v = z; left wall u = z, v = x.
    const box: Box = (u0, y0, v0, u1, y1, v1, color) => {
      const paint = typeof color === 'number' ? color : (x: number, y: number, z: number) => (onLeft ? color(z - oz, y, x - ox) : color(x - ox, y, z - oz));
      if (onLeft) fillBox(grid, ox + v0, y0, oz + u0, ox + v1, y1, oz + u1, paint);
      else fillBox(grid, ox + u0, y0, oz + v0, ox + u1, y1, oz + v1, paint);
    };
    PAINTERS[item.kind](box, len, dep);
  }
}

// A one-tile piece drawn with its back at v = 0 and its front toward +v,
// turned to face `item.facing`.
function paintFacing(grid: VoxelGrid, item: Furniture, ox: number, oz: number): void {
  const [dx, dz] = item.facing!;
  const last = TILE - 1;
  // Local (u, v) to the tile's (x, z): the front (+v) turned toward (dx, dz).
  const toTile = (u: number, v: number): [number, number] =>
    dz === 1 ? [u, v] : dz === -1 ? [last - u, last - v] : dx === 1 ? [v, last - u] : [last - v, u];
  const box: Box = (u0, y0, v0, u1, y1, v1, color) => {
    for (let u = u0; u <= u1; u++) {
      for (let v = v0; v <= v1; v++) {
        const [x, z] = toTile(u, v);
        fillBox(grid, ox + x, y0, oz + z, ox + x, y1, oz + z, typeof color === 'number' ? color : (_x, y) => color(u, y, v));
      }
    }
  };
  PAINTERS[item.kind](box, TILE, TILE);
}

// Where a room's fire burns (in its hearth, or on its forge), in floor-tile
// coordinates and world height, if it has one.
export function fireOf(items: readonly Furniture[]): { x: number; y: number; z: number; forge: boolean } | null {
  const fire = items.find((f) => f.kind === 'hearth' || f.kind === 'forge');
  if (!fire) return null;
  const forge = fire.kind === 'forge';
  return { x: fire.x + fire.w / 2 - 0.5, y: (forge ? 12 : 6) * 0.04, z: fire.z - 0.5 + (forge ? 8 : 5) / 25, forge };
}

// Furniture in voxels, painted straight into the room's grid (roomVoxels.ts)
// at the world's 0.04 scale, 25 voxels to a floor tile. Each piece is
// drawn in its own frame: u along the wall it stands against, v out from
// it, y up; pieces against the left wall turn to face into the room.

import type { Furniture } from '../../model/interiors/furniture';
import type { VoxelGrid } from '../meshes/voxel/greedyMesh';
import { fillBox } from '../meshes/voxel/voxelShapes';
import {
  WOOD,
  WOOD_DARK,
  WOOD_LIGHT,
  RED,
  TEAL,
  LINEN,
  FIRE,
  EMBER,
  IRON,
  IRON_LIGHT,
  SOOT,
  BRASS,
  WATER,
  COAL,
  STONE,
  STONE_DARK,
  RED_DARK,
  RED_LIGHT,
  FUR,
  FUR_LIGHT,
  CLAY,
  CLAY_DARK,
  GLASS_GREEN,
  WINE,
  BREAD,
  PARCHMENT,
  type Box,
} from './furniturePalette';
import { INN_PAINTERS } from './innFurnitureVoxels';

const TILE = 25;

// How each piece looks, drawn in a frame `len` voxels along the wall and `dep` out from it.
const PAINTERS: Record<Furniture['kind'], (box: Box, len: number, dep: number) => void> = {
  ...INN_PAINTERS,
  bench: () => {}, // outdoors only, on the squares (meshes/plaza/benchVoxels.ts): never in a room
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
  // A wooden bed, lengthwise along the wall: posts with round knobs at its
  // four corners, a panelled headboard and a low footboard, a straw
  // mattress in striped ticking, a plump pillow at the head, and a red wool
  // blanket, its fold catching the light, hanging over the sides in shadow,
  // edged in teal.
  bed: (box, len, dep) => {
    box(1, 1, 2, len - 2, 4, dep - 3, WOOD); // the frame
    box(2, 1, 3, 3, 13, dep - 4, (_u, y, v) => (y === 13 || v === 3 || v === dep - 4 ? WOOD_DARK : WOOD)); // headboard, panelled
    box(len - 4, 1, 3, len - 3, 8, dep - 4, WOOD_DARK); // footboard
    for (const u of [1, len - 2]) {
      for (const v of [2, dep - 3]) {
        const top = u === 1 ? 15 : 10;
        box(u, 1, v, u, top, v, WOOD_DARK); // a post
        box(u, top + 1, v, u, top + 1, v, WOOD_LIGHT); // its knob
      }
    }
    box(4, 5, 3, len - 5, 7, dep - 4, (u) => (u % 3 === 0 ? PARCHMENT : LINEN)); // mattress, in ticking
    box(5, 8, 5, 12, 10, dep - 6, (_u, y, v) => (y === 8 || v === 5 ? PARCHMENT : LINEN)); // pillow
    box(14, 8, 3, 16, 8, dep - 4, LINEN); // the sheet, turned down
    box(17, 8, 3, len - 5, 8, dep - 4, (u, _y, v) => (v === 3 || v === dep - 4 ? TEAL : u === 17 ? RED_LIGHT : RED)); // blanket, its fold lit
    for (const v of [2, dep - 3]) box(17, 5, v, len - 5, 8, v, (_u, y) => (y === 5 ? TEAL : RED_DARK)); // hanging over the sides
  },
  // A table: dark legs, a rich wooden top, a linen runner down the middle with
  // a red edge, a candle in a brass stick, and a clay bowl of apples.
  table: (box) => {
    for (const [u, v] of [[3, 3], [20, 3], [3, 20], [20, 20]]) box(u, 1, v, u + 1, 8, v + 1, WOOD_DARK);
    box(1, 9, 1, 23, 10, 23, (u, y) => (y === 9 ? WOOD_DARK : u % 6 === 0 ? WOOD_DARK : WOOD)); // richer than the floor, so it stands out
    box(1, 11, 8, 23, 11, 16, (_u, _y, v) => (v === 8 || v === 16 ? RED : LINEN)); // runner
    box(10, 12, 10, 13, 12, 13, BRASS); // candlestick
    box(11, 13, 11, 12, 17, 12, LINEN); // candle
    box(11, 18, 11, 11, 18, 11, EMBER); // its flame
    box(15, 12, 3, 21, 13, 8, (u, y, v) => (y === 13 && u > 15 && u < 21 && v > 3 && v < 8 ? CLAY_DARK : CLAY)); // a bowl
    for (const [u, v, color] of [[16, 4, RED], [18, 5, RED_LIGHT], [17, 6, GLASS_GREEN], [19, 4, RED]]) box(u, 14, v, u + 1, 15, v + 1, color); // apples
  },
  // A chair, its back toward v = 0 and its seat facing +v (turned toward its
  // table in paintFurniture), pulled up to the front of its tile so it sits
  // right at the table's edge.
  chair: (box) => {
    const f = 6; // pulled forward, toward the table
    for (const [u, v] of [[7, 7 + f], [16, 7 + f], [7, 16 + f], [16, 16 + f]]) box(u, 1, v, u + 1, 6, v + 1, WOOD_DARK); // legs
    box(6, 7, 6 + f, 17, 8, 17 + f, WOOD); // seat
    box(7, 9, 8 + f, 16, 9, 16 + f, (u, _y, v) => (v === 16 + f ? RED_LIGHT : u === 7 || u === 16 || v === 8 + f ? RED_DARK : RED)); // a red cushion
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
  // A dresser against the wall: sides and a back, a crown along its top and
  // a base, three shelves: clay jars, a row of leather-bound books with gilt
  // bands, a wheel of cheese and a bundle of candles.
  shelf: (box) => {
    box(3, 1, 0, 21, 27, 0, WOOD_DARK); // back
    for (const u of [2, 22]) box(u, 1, 0, u, 27, 7, WOOD); // sides
    box(1, 28, 0, 23, 29, 8, (_u, y) => (y === 29 ? WOOD_LIGHT : WOOD_DARK)); // crown
    box(2, 1, 1, 22, 2, 7, WOOD_DARK); // base
    for (const y of [9, 18]) box(3, y, 1, 21, y, 7, (_u, _y, v) => (v === 7 ? WOOD_LIGHT : WOOD)); // shelves, their lit edges
    // The bottom: two clay jars, one tall, with dark necks.
    box(4, 3, 2, 7, 7, 5, (_u, y) => (y === 7 ? CLAY_DARK : CLAY));
    box(10, 3, 2, 12, 5, 4, (_u, y) => (y === 5 ? CLAY_DARK : CLAY));
    box(15, 3, 3, 19, 4, 6, (_u, y) => (y === 4 ? BREAD : PARCHMENT)); // a cheese
    // The middle: books upright, their spines out, gilt bands across them.
    [RED_DARK, FUR, TEAL, WINE, FUR_LIGHT, GLASS_GREEN].forEach((color, i) => {
      const u = 4 + i * 2;
      const top = 15 + (i % 3 === 1 ? 1 : 0);
      box(u, 10, 2, u + 1, top, 6, (_u, y, v) => (v === 6 && y === 12 ? BRASS : color));
    });
    box(17, 10, 3, 20, 10, 6, WOOD_LIGHT); // a book lying flat
    // The top: a bundle of candles and a jug.
    box(4, 19, 3, 6, 22, 5, LINEN);
    box(5, 23, 4, 5, 23, 4, SOOT);
    box(14, 19, 2, 17, 23, 5, (_u, y) => (y === 21 ? CLAY_DARK : CLAY));
    box(18, 20, 3, 18, 22, 3, CLAY_DARK); // its handle
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
  // A woven rug, flat on the floor: a teal field, a red border (darker at
  // its edge), a linen band, a red medallion in the middle, and linen
  // fringes along its two short ends.
  rug: (box, len, dep) => {
    const cu = (len - 1) / 2;
    const cv = (dep - 1) / 2;
    box(4, 1, 4, len - 5, 1, dep - 5, (u, _y, v) => {
      const edge = Math.min(u - 4, v - 4, len - 5 - u, dep - 5 - v);
      if (edge < 1) return RED_DARK;
      if (edge < 2) return RED;
      if (edge < 4) return LINEN;
      const mu = Math.abs(u - cu);
      const mv = Math.abs(v - cv);
      if (mu <= 4 && mv <= 3) return mu <= 1 && mv <= 1 ? LINEN : RED; // the medallion
      return TEAL;
    });
    for (const u of [2, 3, len - 4, len - 3]) {
      for (let v = 5; v <= dep - 6; v += 2) box(u, 1, v, u, 1, v, LINEN); // fringes
    }
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

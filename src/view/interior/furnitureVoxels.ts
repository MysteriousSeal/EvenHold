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

type Box = (u0: number, y0: number, v0: number, u1: number, y1: number, v1: number, color: number | ((u: number, y: number, v: number) => number)) => void;

// How each piece looks, drawn in a frame `len` voxels along the wall and `dep` out from it.
const PAINTERS: Record<Furniture['kind'], (box: Box, len: number, dep: number) => void> = {
  // A stone fireplace: a hearth slab, sides and a mantel, fire and embers
  // inside, the chimney breast rising to the top of the wall.
  hearth: (box, len) => {
    box(1, 1, 0, len - 2, 2, 12, (u, _y, v) => ((u + v) % 5 === 0 ? STONE_DARK : STONE)); // slab
    box(2, 3, 0, 7, 20, 9, (u, y) => ((u + y) % 6 === 0 ? STONE_DARK : STONE)); // sides
    box(len - 8, 3, 0, len - 3, 20, 9, (u, y) => ((u + y) % 6 === 0 ? STONE_DARK : STONE));
    box(1, 21, 0, len - 2, 23, 11, WOOD_DARK); // mantel
    box(8, 3, 0, len - 9, 20, 2, SOOT); // the back of the fire
    box(10, 3, 3, len - 11, 3, 8, (u, _y, v) => ((u + v) % 3 === 0 ? FIRE : EMBER)); // a bed of embers
    box(11, 4, 4, len - 12, 5, 5, WOOD_DARK); // logs, one across the back,
    box(13, 4, 6, len - 14, 5, 7, WOOD); // one in front
    box(15, 6, 5, len - 16, 6, 6, (u) => (u % 4 === 0 ? SOOT : WOOD_DARK)); // one on top, charred; the flames rise from them (fire.ts)
    box(5, 24, 0, len - 6, 33, 6, (u, y) => ((u * 3 + y) % 7 === 0 ? STONE_DARK : STONE)); // chimney breast
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
  table: (box) => {
    for (const [u, v] of [[3, 3], [20, 3], [3, 20], [20, 20]]) box(u, 1, v, u + 1, 8, v + 1, WOOD_DARK);
    box(1, 9, 1, 23, 10, 23, (u) => (u % 5 === 0 ? WOOD_DARK : WOOD));
  },
  // A chair, its back at v = 0 and its seat facing +v (turned toward its table in paintFurniture).
  chair: (box) => {
    for (const [u, v] of [[7, 7], [16, 7], [7, 16], [16, 16]]) box(u, 1, v, u + 1, 6, v + 1, WOOD_DARK); // legs
    box(6, 7, 6, 17, 8, 17, WOOD); // seat
    for (const u of [6, 16]) box(u, 9, 6, u + 1, 20, 7, WOOD_DARK); // back posts
    box(6, 14, 6, 17, 15, 7, WOOD); // back rails
    box(6, 19, 6, 17, 20, 7, WOOD);
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
  longTable: (box, len) => {
    for (const u of [3, len - 5]) box(u, 1, 10, u + 1, 8, 14, WOOD_DARK);
    box(1, 9, 3, len - 2, 10, 21, (u) => (u % 7 === 0 ? WOOD_DARK : WOOD));
    box(8, 11, 8, 10, 13, 10, BRASS); // a tankard
  },
  bench: (box, len) => {
    for (const u of [3, len - 5]) box(u, 1, 9, u + 1, 4, 15, WOOD_DARK);
    box(1, 5, 8, len - 2, 6, 16, WOOD);
  },
  // The inn's counter: a long wooden bar, a lighter top, tankards on it.
  counter: (box, len, dep) => {
    box(1, 1, 2, len - 2, 11, dep - 4, (u) => (u % 6 === 0 ? WOOD_DARK : WOOD));
    box(0, 12, 1, len - 1, 12, dep - 3, WOOD_LIGHT);
    box(10, 13, 8, 12, 15, 10, BRASS);
    box(40, 13, 10, 42, 15, 12, BRASS);
  },
  keg: (box) => box(4, 1, 3, 20, 10, 18, (u, y) => (u === 8 || u === 16 ? IRON : y === 10 ? WOOD_DARK : WOOD)),
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

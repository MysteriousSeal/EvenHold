// A bandit camp's pieces at the world's 0.04 voxel scale, each one tile
// (25 x 25 voxels) facing local +Z (the camp's center), palette first:
// fire stones, bark and char, glowing flames; mismatched hides and canvas
// with dark seams, fur; timber and iron; crate wood; roast meat; burlap;
// a blood-red banner; and gold that glints (glows).

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';
import { hashUnit } from '../../../util/random';

export const CAMP_VOXEL_SIZE = 0.04;
export const CAMP_GRID: [number, number, number] = [25, 24, 25];

const ENTRIES = {
  stone: 0x8e8b82,
  stoneDark: 0x6f6c64,
  bark: 0x5c4330,
  char: 0x2b2522,
  flameDeep: 0xff7a2a,
  flame: 0xffb347,
  flameHeart: 0xffe39a,
  hideTan: 0xb08a5c,
  hideBrown: 0x7a5638,
  canvas: 0xc9b89a,
  seam: 0x4a3526,
  fur: 0xd9d2c4,
  furDark: 0x8e867a,
  pole: 0x5a3a22,
  poleDark: 0x3e2818,
  iron: 0x3d3d42,
  steel: 0xb9bec6,
  crate: 0x9a7040,
  crateDark: 0x6e4e2c,
  meat: 0x8a4a2a,
  meatDark: 0x5e2e1a,
  burlap: 0xb89a6a,
  burlapDark: 0x8e7450,
  banner: 0x8b2a22,
  bannerDark: 0x5e1a16,
  rope: 0xc2a26b,
  gold: 0xf0c64a,
  inside: 0x2e2620,
} as const;

export const CAMP_PALETTE: number[] = Object.values(ENTRIES);
const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;
export const CAMP_GLOWING = new Set([C.flameDeep, C.flame, C.flameHeart, C.gold]);

// Campfire in a stone ring, a roasting spit over it on forked posts, and
// log seats around the edge of the tile.
export function buildCampfire(): VoxelGrid {
  const grid = createGrid(CAMP_GRID);
  for (let x = 8; x <= 16; x++) {
    for (let z = 8; z <= 16; z++) {
      if (Math.max(Math.abs(x - 12), Math.abs(z - 12)) === 4 && (x + z) % 2 === 0) setColor(grid, x, 0, z, (x * 3 + z) % 3 === 0 ? C.stoneDark : C.stone);
    }
  }
  fillBox(grid, 9, 0, 12, 15, 0, 12, (x) => (x === 12 ? C.char : C.bark));
  fillBox(grid, 12, 1, 9, 12, 1, 15, (_x, _y, z) => (z === 12 ? C.char : C.bark));
  fillBox(grid, 11, 1, 11, 13, 2, 13, (x, y, z) => (x === 12 && z === 12 ? C.flameHeart : y === 1 ? C.flameDeep : C.flame));
  fillBox(grid, 12, 3, 12, 12, 4, 12, (_x, y) => (y === 3 ? C.flame : C.flameHeart));
  setColor(grid, 11, 3, 12, C.flameDeep);
  // Spit: forked posts either side, an iron rod, a roast turning on it.
  for (const x of [6, 18]) {
    fillBox(grid, x, 0, 12, x, 8, 12, C.pole);
    setColor(grid, x, 9, 11, C.pole);
    setColor(grid, x, 9, 13, C.pole);
  }
  fillBox(grid, 6, 8, 12, 18, 8, 12, C.iron);
  fillBox(grid, 10, 6, 11, 14, 7, 13, (x) => (x === 10 || x === 14 ? C.meatDark : C.meat));
  // Log seats on three sides.
  fillBox(grid, 7, 0, 20, 17, 1, 21, (x) => (x === 7 || x === 17 ? C.hideTan : C.bark));
  fillBox(grid, 2, 0, 7, 3, 1, 17, (_x, _y, z) => (z === 7 || z === 17 ? C.hideTan : C.bark));
  fillBox(grid, 21, 0, 7, 22, 1, 17, (_x, _y, z) => (z === 7 || z === 17 ? C.hideTan : C.bark));
  return grid;
}

// A-frame tent of patched hides: ridge along Z, doorway at the +Z end
// facing the fire, closed at the back, a fur rug before the door.
export function buildTent(): VoxelGrid {
  const grid = createGrid(CAMP_GRID);
  const mid = 12;
  const patch = (x: number, y: number, z: number) => {
    if (z % 7 === 0 || (y % 5 === 0 && z > 1)) return C.seam; // stitched seams
    const h = hashUnit(Math.floor(x / 5), Math.floor(y / 4) * 10 + Math.floor(z / 7), 71);
    return h < 0.4 ? C.hideTan : h < 0.75 ? C.hideBrown : C.canvas;
  };
  for (let y = 0; y < 14; y++) {
    const half = 11 - Math.floor((y * 11) / 14); // stepped slope
    for (const side of [-1, 1]) {
      for (let d = 0; d <= 1; d++) {
        const x = mid + side * Math.max(0, half - d);
        fillBox(grid, x, y, 1, x, y, 20, (_x, yy, z) => patch(x, yy, z));
      }
    }
    fillBox(grid, mid - half, y, 1, mid + half, y, 1, (x, yy, z) => patch(x, yy, z)); // closed back
    fillBox(grid, mid - half + 1, y, 20, mid + half - 1, y, 20, C.inside); // doorway
  }
  fillBox(grid, mid, 14, 0, mid, 14, 21, C.poleDark); // ridge pole
  for (const z of [0, 21]) fillBox(grid, mid, 0, z, mid, 14, z, C.pole);
  fillBox(grid, 9, 0, 21, 15, 0, 24, (x, _y, z) => ((x + z) % 3 === 0 ? C.furDark : C.fur)); // fur rug
  for (const [x, z] of [
    [1, 2],
    [23, 2],
    [1, 19],
    [23, 19],
  ]) {
    setColor(grid, x, 0, z, C.poleDark); // pegs
  }
  return grid;
}

// Weapon rack (spears and swords between two posts) and a tall banner pole
// flying a tattered red banner with crossed swords.
export function buildRack(): VoxelGrid {
  const grid = createGrid(CAMP_GRID);
  for (const x of [4, 16]) fillBox(grid, x, 0, 12, x, 10, 12, C.pole);
  for (const y of [4, 9]) fillBox(grid, 4, y, 12, 16, y, 12, C.poleDark);
  for (const x of [6, 9, 12]) {
    fillBox(grid, x, 1, 13, x, 12, 13, C.pole); // spears
    fillBox(grid, x, 13, 13, x, 14, 13, C.steel);
  }
  fillBox(grid, 14, 2, 11, 14, 8, 11, C.steel); // a sword hung on the rack
  fillBox(grid, 13, 8, 11, 15, 8, 11, C.iron);
  fillBox(grid, 21, 0, 12, 21, 23, 12, C.poleDark); // banner pole
  for (let y = 12; y <= 21; y++) {
    for (let x = 15; x <= 20; x++) {
      if (y === 12 && x % 2 === 0) continue; // tattered hem
      const emblem = (x - 15 === 21 - y - 2) || (x - 15 === y - 14); // crossed swords
      setColor(grid, x, y, 12, emblem && y > 13 && y < 20 ? C.bannerDark : C.banner);
    }
  }
  return grid;
}

// A stack of crates (framed planks) and a banded barrel.
export function buildCrates(): VoxelGrid {
  const grid = createGrid(CAMP_GRID);
  const crate = (x0: number, y0: number, z0: number, s: number) =>
    fillBox(grid, x0, y0, z0, x0 + s - 1, y0 + s - 1, z0 + s - 1, (x, y, z) => {
      const edges = [x === x0 || x === x0 + s - 1, y === y0 || y === y0 + s - 1, z === z0 || z === z0 + s - 1].filter(Boolean).length;
      return edges >= 2 || y === y0 + Math.floor(s / 2) ? C.crateDark : C.crate;
    });
  crate(3, 0, 5, 8);
  crate(11, 0, 4, 8);
  crate(6, 8, 6, 7);
  for (let y = 0; y <= 7; y++) {
    fillBox(grid, 15, y, 15, 19, y, 19, (x, _y, z) => ((x === 15 || x === 19) && (z === 15 || z === 19) ? 0 : y === 1 || y === 6 ? C.iron : C.crate));
  }
  return grid;
}

// The loot: an open chest spilling gold, and two sacks of stolen grain.
export function buildLoot(): VoxelGrid {
  const grid = createGrid(CAMP_GRID);
  fillBox(grid, 6, 0, 8, 16, 5, 14, (x, y) => (y === 2 || x === 6 || x === 16 ? C.iron : C.crate));
  fillBox(grid, 7, 5, 9, 15, 5, 13, C.gold); // coins heaped inside
  fillBox(grid, 6, 6, 7, 16, 11, 7, (_x, y) => (y === 9 ? C.iron : C.crateDark)); // lid, thrown open
  for (const [x, z] of [
    [9, 16],
    [12, 17],
    [17, 16],
  ]) {
    setColor(grid, x, 0, z, C.gold); // spilled coins
  }
  for (const [x0, z0] of [
    [2, 16],
    [17, 3],
  ]) {
    for (let y = 0; y <= 5; y++) {
      const r = y >= 4 ? 1 : 2;
      fillBox(grid, x0 + 2 - r, y, z0 + 2 - r, x0 + 2 + r, y, z0 + 2 + r, y === 4 ? C.rope : y % 2 === 0 ? C.burlap : C.burlapDark);
    }
  }
  return grid;
}

// Palisade along the tile's local -Z edge: sharpened stakes of uneven
// height, two rope lashings.
export function buildPalisade(): VoxelGrid {
  const grid = createGrid(CAMP_GRID);
  for (let x = 0; x < 25; x += 3) {
    const top = 13 + Math.floor(hashUnit(x, 0, 72) * 4);
    fillBox(grid, x, 0, 0, Math.min(24, x + 1), top, 1, (xx) => (xx === x ? C.pole : C.poleDark));
    setColor(grid, x, top + 1, 0, C.pole); // sharpened point
  }
  for (const y of [4, 10]) fillBox(grid, 0, y, 2, 24, y, 2, C.rope);
  return grid;
}

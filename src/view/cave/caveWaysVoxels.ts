// A cave's ways out and its hoard, in voxels (cave/caveVoxels.ts the rest):
// - the way up, at its door: worn steps of earth two tiles wide, low (seen
//   from above), between shoulders of rock, roots bracing them, the world
//   creeping in at the top and the daylight lying across it (drawn unlit);
// - the crack in the nest's far wall: a tile of rock split top to bottom by a
//   jagged cleft right through it, half a tile across at its widest, its lips
//   pale at its face (its outline reading from across the nest) (its way out, once the brood mother's slain);
//   the rubble choking it till then, light leaking at its seams; the daylight
//   in it, once it's open;
// - her hoard: a cocoon of silk wound tight about what she's gathered; torn
//   open, gold spilling out of it, a sword's hilt standing up.

import { createGrid, setColor } from '../meshes/voxel/voxelShapes';
import type { VoxelGrid } from '../meshes/voxel/greedyMesh';
import { hashUnit } from '../../util/random';
import { C, TALL, TILE } from './cavePalette';
import { ROCK_HIGH, lumpy, rockTile } from './caveRockVoxels';

const set = (g: VoxelGrid, x: number, y: number, z: number, c: number) => {
  if (x >= 0 && y >= 0 && z >= 0 && x < g.size[0] && y < g.size[1] && z < g.size[2]) setColor(g, x, y, z, c);
};

// The way up: two tiles across (u), a tile deep (v: 0 at the floor's side, climbing away from it toward the camera,
// so it's kept low: all of it seen from above). Five uneven steps of earth worn by feet, each lip braced by a root,
// stones set in the treads, moss at their edges; low shoulders of rock either side, climbing with them, roots trailing
// down their inner faces; up top, the world creeping in (grass, a flower or two, fallen leaves) and the daylight lying
// across the upper steps (dithered: brightest at the top, fading down them).
const STEPS = 5;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((b) => (b + 0.5) / 16);
export function wayUp(): VoxelGrid {
  const W = TILE * 2;
  const g = createGrid([W, 22, TILE]);
  const SHOULDER = 6;
  const tread = (u: number, v: number) => {
    const k = Math.min(STEPS - 1, Math.floor(v / (TILE / STEPS)));
    return 2 + k * 3 + Math.round((lumpy(u, k, 820, 6) - 0.5) * 2); // (uneven: worn more where feet go)
  };
  for (let u = 0; u < W; u++) {
    for (let v = 0; v < TILE; v++) {
      const edge = Math.min(u, W - 1 - u);
      const shoulder = SHOULDER + Math.round(lumpy(v, u < W / 2 ? 0 : 1, 821, 4) * 3);
      if (edge < shoulder) {
        // A low shoulder of rock, climbing with the steps; moss and grass on its top, more of it higher up.
        const top = tread(u, v) + 4 + Math.round(lumpy(u, v, 822, 3) * 3);
        for (let y = 0; y < top; y++) {
          const crown = y === top - 1;
          const tone = lumpy(u + y, v, 823, 3);
          set(g, u, y, v, crown && hashUnit(u, v, 824) < 0.25 + v / 40 ? (v > 16 ? C.grass : C.moss) : (y + Math.round(tone * 3)) % 8 < 2 ? C.strata : tone < 0.4 ? C.rockDark : C.rock);
        }
        // Roots trailing down its inner face.
        if (edge === shoulder - 1 && (v * 7 + u) % 9 === 0) for (let y = top; y > top - 6 && y >= 0; y--) set(g, u + (u < W / 2 ? 1 : -1), y, v, y % 3 ? C.root : C.rootLight);
        continue;
      }
      const high = tread(u, v);
      const k = Math.min(STEPS - 1, Math.floor(v / (TILE / STEPS)));
      const lip = v % (TILE / STEPS) === 0 && v > 0; // (each step's front edge)
      for (let y = 0; y <= high; y++) {
        const top = y === high;
        const roll = hashUnit(u, v * 7 + y, 825);
        let color: number = y < high - 1 ? C.earthDark : C.earth;
        if (lip && y >= high - 1) color = (u + k) % 7 === 0 ? C.rootLight : C.root; // a root bracing its lip
        else if (top && roll < 0.05) color = C.pebble;
        else if (top && edge < shoulder + 3 && roll < 0.4) color = C.moss; // (moss along the edges, out of the way of feet)
        else if (top && roll > 0.82) color = C.earthLight;
        if (top && k >= 3) {
          // Up top: the world creeping in, and the daylight across it (dithered, brightest highest).
          if (roll < 0.12 + (k - 3) * 0.15) color = roll < 0.03 ? C.leaf : C.grass;
          if (roll > 0.985) color = C.flower;
          const sun = (v - TILE * 0.55) / (TILE * 0.45) - Math.abs(u - (W - 1) / 2) / W; // (0 .. 1 up the top steps, its middle)
          if (sun > BAYER[(u % 4) + (v % 4) * 4]) color = sun > 0.6 + BAYER[(u % 4) + (v % 4) * 4] * 0.4 ? C.day : C.dayDeep;
        }
        set(g, u, y, v, color);
      }
      // Grass blades standing up at the top, by the shoulders.
      if (k >= 3 && edge < shoulder + 4 && hashUnit(u, v, 826) < 0.3) set(g, u, high + 1, v, hashUnit(v, u, 827) < 0.5 ? C.grassLight : C.grass);
    }
  }
  return g;
}

// The slit through the crack's rock, at height y: its half-width (jagged; 0 above its top).
const slit = (y: number) => (y > TALL - 5 ? 0 : 3 + 4.6 * Math.sin((Math.PI * (y + 2)) / (TALL - 1)) + (hashUnit(y, 0, 830) - 0.5) * 1.6); // (a cleft half a tile across at its widest: seen from across the nest)
const inSlit = (u: number, y: number) => Math.abs(u - (TILE - 1) / 2 - Math.round(Math.sin(y * 0.4) * 1.2)) <= slit(y);

// The crack's rock: a rock tile with the slit through it, from its face toward the floor (+Z) right through.
export function crackRock(): VoxelGrid {
  const g = rockTile(1);
  for (let u = 0; u < TILE; u++) for (let y = 0; y < g.size[1]; y++) for (let v = 0; v < TILE; v++) if (inSlit(u, y)) setColor(g, u, y, v, 0);
  // Its lips worn: in shadow within, pale stone framing it at its face (its outline reading from afar).
  for (let u = 0; u < TILE; u++) for (let y = 0; y < TALL - 4; y++) if (!inSlit(u, y) && (inSlit(u - 1, y) || inSlit(u + 1, y) || inSlit(u, y - 1))) for (let v = 0; v < TILE; v++) if (g.cells[u + TILE * (y + ROCK_HIGH * v)]) setColor(g, u, y, v, v >= TILE - 3 ? C.strata : C.crevice);
  return g;
}

// The rubble choking it, boulders heaped in the slit, light leaking at a seam or two.
export function crackRubble(): VoxelGrid {
  const g = createGrid([TILE, ROCK_HIGH, TILE]);
  for (let u = 0; u < TILE; u++) for (let y = 0; y < TALL - 4; y++) {
    if (!inSlit(u, y)) continue;
    for (let v = 6; v < TILE; v++) {
      const block = hashUnit(Math.floor(u / 3), Math.floor(y / 3) + Math.floor(v / 4) * 11, 831);
      set(g, u, y, v, v === 6 && hashUnit(u, y, 832) < 0.12 ? C.dayDeep : block < 0.35 ? C.rockDark : block > 0.75 ? C.rockLight : C.rock);
    }
  }
  return g;
}

// The daylight in it, once open: filling the cleft right up to its lips (its face blazing, seen across the nest),
// warmer at its edges.
export function crackLight(): VoxelGrid {
  const g = createGrid([TILE, ROCK_HIGH, TILE]);
  for (let u = 0; u < TILE; u++) for (let y = 0; y < TALL - 4; y++) {
    if (!inSlit(u, y)) continue;
    const edge = !inSlit(u - 1, y) || !inSlit(u + 1, y) || !inSlit(u, y + 1);
    for (let v = 0; v < TILE - 1; v++) set(g, u, y, v, edge ? C.dayDeep : C.day);
  }
  return g;
}

export const HOARD: [number, number, number] = [14, 12, 18];

// Her hoard: a cocoon of silk wound tight (banded by its threads); `torn`, split open along its top, gold spilling
// out over its lip, a sword's hilt standing up out of it.
export function hoard(torn: boolean): VoxelGrid {
  const g = createGrid(HOARD);
  const [cx, cy, cz] = [6.5, 4.5, 8.5];
  for (let x = 0; x < HOARD[0]; x++) for (let y = 0; y < HOARD[1]; y++) for (let z = 0; z < HOARD[2]; z++) {
    const d = ((x - cx) / 6.5) ** 2 + ((y - cy) / 4.8) ** 2 + ((z - cz) / 8.5) ** 2;
    if (d > 1) continue;
    if (torn && y >= 4 && Math.abs(x - cx) < 3.5 && d > 0.25) continue; // (split along its top)
    if (torn && y >= 6 && d <= 0.25) continue;
    set(g, x, y, z, (z + Math.floor(y / 2)) % 4 === 0 ? C.silkShade : C.silk);
  }
  if (!torn) return g;
  // Inside: gold heaped up, spilling over the lip on one side; the hilt.
  for (let x = 4; x <= 9; x++) for (let z = 3; z <= 14; z++) {
    const high = 5 + Math.round(lumpy(x, z, 840, 3) * 2);
    for (let y = 3; y <= high; y++) set(g, x, y, z, (x + z + y) % 3 === 0 ? C.goldDark : C.gold);
  }
  for (let z = 6; z <= 10; z++) for (let x = 10; x <= 13; x++) set(g, x, Math.max(0, 13 - x - (z % 2)), z, (x + z) % 2 ? C.gold : C.goldDark); // (spilling out)
  for (let y = 6; y <= 11; y++) set(g, 6, y, 9, y === 8 ? C.iron : y > 8 ? C.leather : C.iron); // the hilt, its guard
  set(g, 5, 8, 9, C.iron);
  set(g, 7, 8, 9, C.iron);
  set(g, 6, 11, 9, C.gold); // (its pommel)
  return g;
}

// A ruin's tower (ruinVoxels.ts: its `tower` piece), a stump of it on its
// tile: round, on a battered plinth; coursed stone in rings, the blocks
// shorter course to course where it narrows, the joints sunk; a band of light
// stone at mid height; corbels in a ring under what's left of its
// battlements, merlons and crenels, broken down on one side (by variant);
// arrow slits toward the ruin's middle and to a side. Hollow at the top:
// looking down, the inside of its wall and rubble and grass down in it.
// Weathered: blocks gone, moss on the merlons, ivy climbing from its foot.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { hashUnit } from '../../../util/random';
import { C, RUIN_GRID } from './ruinVoxels';

const MID = 12; // its middle, across and along
const R = 10.5; // its wall's outer radius, over the plinth
const INNER = 6.5; // the hollow's
const BAND = 14; // the light band's height

export function ruinTower(variant: number): VoxelGrid {
  const grid = createGrid(RUIN_GRID);
  const set = (u: number, y: number, v: number, color: number) => fillBox(grid, u, y, v, u, y, v, color);
  const high = 28 + variant * 2; // to the corbels
  const ruined = (a: number) => variant >= 2 && Math.cos(a - variant) > 0.55; // a side broken down
  for (let u = 0; u <= 24; u++) {
    for (let v = 0; v <= 24; v++) {
      const [du, dv] = [u - MID, v - MID];
      const d = Math.hypot(du, dv);
      const a = Math.atan2(dv, du);
      // The plinth: wider, battered (stepping in), dark.
      for (let y = 0; y <= 3; y++) if (d <= R + 2 - y * 0.5 && d > INNER) set(u, y, v, y === 3 ? C.stone : C.stoneDark);
      if (d > R + 1.5 || d <= INNER) {
        if (d <= INNER) set(u, 3, v, hashUnit(u, v, 140 + variant) < 0.5 ? C.grass : hashUnit(u, v, 141) < 0.5 ? C.dirt : C.stoneDark); // the floor down inside
        if (d <= INNER && hashUnit(Math.floor(u / 2), Math.floor(v / 2), 142 + variant) < 0.25) set(u, 4, v, C.stone); // rubble in it
        continue;
      }
      const top = ruined(a) ? high - 8 - Math.floor(hashUnit(Math.floor(a * 4), variant, 143) * 6) : high;
      const surface = d > R - 1; // the outer skin
      const ring = d > R; // the corbels' ring, standing out under the battlements
      for (let y = 4; y <= top; y++) {
        if (ring && y < top - 2) continue;
        const course = Math.floor((y - 4) / 4);
        const row = (y - 4) % 4;
        const blocks = 14 - course; // fewer blocks round as it rises
        const along = ((a + Math.PI) / (2 * Math.PI)) * blocks + (course % 2) * 0.5;
        const joint = row === 3 || along % 1 < 1 / 7;
        if (y === BAND || y === BAND + 1) {
          set(u, y, v, y === BAND + 1 && surface ? C.stoneLight : C.stone); // the band
          continue;
        }
        if (joint && surface) continue; // (sunk)
        const block = Math.floor(along);
        if (surface && course > 0 && hashUnit(block, course, 144 + variant) < 0.05) continue; // a block gone
        const tone = [C.stone, C.stoneDark, C.stoneLight, C.stone][Math.floor(hashUnit(block, course, 145 + variant) * 4)];
        const ivy = surface && y < 4 + 4 + Math.floor(hashUnit(Math.floor(a * 3), variant, 146) * 14) && hashUnit(Math.floor(a * 3), variant, 147) < 0.3 + variant * 0.1;
        set(u, y, v, joint ? C.mortar : ivy && hashUnit(u + v, y, 148) < 0.75 ? (hashUnit(u, y, 149) < 0.5 ? C.ivy : C.ivyLight) : row === 2 && surface ? (tone === C.stoneDark ? C.stone : C.stoneLight) : tone);
      }
      // The battlements over the corbels: merlons and crenels round the rim, moss on them.
      if (!ruined(a) && d > R - 2.5) {
        const merlon = Math.floor(((a + Math.PI) / (2 * Math.PI)) * 12) % 2 === 0;
        const crown = top + (merlon ? 4 : 1) - (merlon && hashUnit(Math.floor(a * 2), variant, 150) < 0.25 ? 3 : 0);
        for (let y = top + 1; y <= crown; y++) set(u, y, v, y === crown && hashUnit(u, v, 151 + variant) < 0.6 ? C.moss : y === crown ? C.stoneLight : C.stone);
      } else if (hashUnit(u, v, 152 + variant) < 0.5) set(u, top, v, C.moss);
    }
  }
  // Arrow slits: toward the middle (+Z), and to a side; dark, a light lintel over each.
  for (const [u0, v0, alongZ] of [[MID, 24, false], [variant % 2 ? 2 : 22, MID, true]] as const) {
    for (let y = 10; y <= 20; y++) {
      if (y === BAND || y === BAND + 1) continue;
      for (let k = 0; k <= 3; k++) {
        const [u, v] = alongZ ? [u0 + (u0 < MID ? k : -k), v0] : [u0, v0 - k];
        if (Math.hypot(u - MID, v - MID) <= R + 1) set(u, y, v, k === 3 ? C.slit : 0);
      }
    }
    for (let k = -1; k <= 1; k++) {
      const [u, v] = alongZ ? [u0 + (u0 < MID ? 2 : -2), v0 + k] : [u0 + k, v0 - 2];
      set(u, 21, v, C.stoneLight);
    }
  }
  return grid;
}

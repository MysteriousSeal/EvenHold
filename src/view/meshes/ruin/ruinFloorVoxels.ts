// A ruin's floor (ruinVoxels.ts: its `floor` piece), a tile of it, two
// voxels thick on the ground: old flagstones gone to the weather. Each of the
// four patterns lays its own rows of stones of uneven lengths, the joints
// never where the next row's are, and joints only between stones within a
// tile, never along its edges, so the paving runs on from tile to tile with
// no grid showing. The joints sunk, grass in them (tufts standing up here
// and there); a stone's edge a shade darker than its face (a bevel, by
// colour); some stones sunk a voxel, some gone, bare earth and grass where
// they were; moss creeping over a few, a crack across one or two.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { hashUnit, mulberry32 } from '../../../util/random';
import { C, RUIN_GRID } from './ruinVoxels';

const T = 25; // voxels a side

export function ruinFloor(variant: number): VoxelGrid {
  const grid = createGrid(RUIN_GRID);
  const set = (u: number, y: number, v: number, color: number) => fillBox(grid, u, y, v, u, y, v, color);
  const rng = mulberry32(5300 + variant * 17);
  const stone = new Int16Array(T * T).fill(-1);
  const joint = new Uint8Array(T * T);
  let id = 0;
  for (let v0 = 0; v0 < T; ) {
    const deep = Math.min(T - v0, 5 + Math.floor(rng() * 5));
    let u0 = -Math.floor(rng() * 7); // (its first stone running on in from the tile before)
    while (u0 < T) {
      const long = 6 + Math.floor(rng() * 6);
      for (let u = Math.max(0, u0); u < Math.min(T, u0 + long); u++) for (let v = v0; v < v0 + deep; v++) stone[u * T + v] = id;
      const end = u0 + long - 1;
      if (end >= 0 && end < T - 1) for (let v = v0; v < v0 + deep; v++) joint[end * T + v] = 1;
      id++;
      u0 += long;
    }
    v0 += deep;
    if (v0 < T - 1) for (let u = 0; u < T; u++) joint[u * T + v0 - 1] = 1;
  }
  const roll = (s: number, salt: number) => hashUnit(s, variant, salt);
  for (let u = 0; u < T; u++) {
    for (let v = 0; v < T; v++) {
      const s = stone[u * T + v];
      if (joint[u * T + v]) {
        // A sunk joint: grass in it, or the bare earth; now and then a tuft standing up out of it.
        set(u, 0, v, hashUnit(u, v, 124 + variant) < 0.65 ? C.grass : C.dirt);
        if (hashUnit(u, v, 125 + variant) < 0.06) set(u, 1, v, C.grass);
        if (hashUnit(u, v, 126 + variant) < 0.02) set(u, 2, v, C.grass);
        continue;
      }
      const gone = roll(s, 127) < 0.1;
      if (gone) {
        // A stone gone: earth and grass where it lay, a tuft or two.
        set(u, 0, v, hashUnit(u, v, 128) < 0.55 ? C.grass : C.dirt);
        if (hashUnit(u, v, 129) < 0.12) set(u, 1, v, C.grass);
        continue;
      }
      const tone = [C.stone, C.stoneLight, C.stone, C.stoneDark][Math.floor(roll(s, 130) * 4)];
      const shade = tone === C.stoneLight ? C.stone : tone === C.stone ? C.stoneDark : C.mortar;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([du, dv]) => {
        const [nu, nv] = [u + du, v + dv];
        return nu >= 0 && nv >= 0 && nu < T && nv < T && joint[nu * T + nv] === 1;
      });
      const sunk = roll(s, 131) < 0.18;
      const moss = roll(s, 132) < 0.25 && hashUnit(Math.floor(u / 2), Math.floor(v / 2), 133 + s) < 0.45;
      const crack = roll(s, 134) < 0.15 && v === Math.round(stoneMiddle(stone, s) + Math.sin(u * 1.2 + s) * 1.2);
      const top = crack ? C.mortar : moss ? (hashUnit(u, v, 135) < 0.5 ? C.moss : C.mossDark) : edge ? shade : tone;
      set(u, 0, v, sunk ? top : shade);
      if (!sunk) set(u, 1, v, top);
    }
  }
  return grid;
}

// A stone's middle row (its v), for a crack across it.
function stoneMiddle(stone: Int16Array, s: number): number {
  let [sum, n] = [0, 0];
  for (let i = 0; i < stone.length; i++) if (stone[i] === s) [sum, n] = [sum + (i % T), n + 1];
  return n ? sum / n : -1;
}

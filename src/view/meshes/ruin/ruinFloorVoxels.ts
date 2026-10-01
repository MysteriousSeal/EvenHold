// A ruin's floor (ruinVoxels.ts: its `floor` piece), a tile of it, two
// voxels thick on the ground: old flagstones gone to the weather, four
// patterns of them laid as flagstones are (voxel/flagstones.ts), no grid
// showing. The joints sunk, grass in them (tufts standing up here
// and there); a stone's edge a shade darker than its face (a bevel, by
// colour); some stones sunk a voxel, some gone, bare earth and grass where
// they were; moss creeping over a few, a crack across one or two.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { hashUnit, mulberry32 } from '../../../util/random';
import { C, RUIN_GRID } from './ruinVoxels';
import { layFlagstones, type Flagstones } from '../voxel/flagstones';

const T = 25; // voxels a side

export function ruinFloor(variant: number): VoxelGrid {
  const grid = createGrid(RUIN_GRID);
  const set = (u: number, y: number, v: number, color: number) => fillBox(grid, u, y, v, u, y, v, color);
  const flags = layFlagstones(mulberry32(5300 + variant * 17), { size: T, deep: [5, 5], long: [6, 6], lead: 7 });
  const roll = (s: number, salt: number) => hashUnit(s, variant, salt);
  for (let u = 0; u < T; u++) {
    for (let v = 0; v < T; v++) {
      const s = flags.stone(u, v);
      if (flags.joint(u, v)) {
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
      const edge = flags.byJoint(u, v);
      const sunk = roll(s, 131) < 0.18;
      const moss = roll(s, 132) < 0.25 && hashUnit(Math.floor(u / 2), Math.floor(v / 2), 133 + s) < 0.45;
      const crack = roll(s, 134) < 0.15 && v === Math.round(stoneMiddle(flags, s) + Math.sin(u * 1.2 + s) * 1.2);
      const top = crack ? C.mortar : moss ? (hashUnit(u, v, 135) < 0.5 ? C.moss : C.mossDark) : edge ? shade : tone;
      set(u, 0, v, sunk ? top : shade);
      if (!sunk) set(u, 1, v, top);
    }
  }
  return grid;
}

// A stone's middle row (its v), for a crack across it.
function stoneMiddle(flags: Flagstones, s: number): number {
  let [sum, n] = [0, 0];
  for (let u = 0; u < T; u++) for (let v = 0; v < T; v++) if (flags.stone(u, v) === s) [sum, n] = [sum + v, n + 1];
  return n ? sum / n : -1;
}

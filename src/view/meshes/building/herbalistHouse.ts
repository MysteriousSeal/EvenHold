// A herbalist's hut (npcs.ts: one a village, theirs alone), its own building
// on a house's tile, nothing like the village houses: a low round hut,
// rough fieldstone to the knee and mud daub above it, roots and moss at its
// foot; a thick shaggy thatch sagging low over the walls, mossy, ragged at
// the eaves, a crooked stone chimney through it; a rough plank door under a
// stone lintel and a round window with herbs in it, both facing -Z; herbs
// drying under the eaves, a signpost with a leaf over a flask, clay pots
// of herbs by the door, and a little cauldron on its embers outside. In
// the houses' grid and palette (houseVoxels.ts, housePalette.ts).

import { hashUnit } from '../../../util/random';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { C } from './housePalette';
import { HOUSE_GRID } from './houseVoxels';
import { MID, put } from './houseParts';

const WALL = 9; // the walls' radius (voxels from the middle)
const WALL_TOP = 10; // their height
const KNEE = 4; // fieldstone up to here, daub above
const EAVE = 11; // the thatch's reach at its foot
const APEX = 25; // its top
const DOOR_TOP = 7; // the door's height
const WINDOW_Y = 6; // the window's middle
const DOOR_Z = MID - WALL; // the front of the wall, where the door is

export function buildHermitHut(): VoxelGrid {
  const grid = createGrid(HOUSE_GRID);
  const roll = (x: number, y: number, z: number, salt: number) => hashUnit(x * 31 + y, z * 17 + y, salt);
  const from = (x: number, z: number) => Math.hypot(x - MID, z - MID);

  // The walls: a ring, fieldstone low (stones of three shades), daub above (streaked, a stone showing here and there).
  for (let y = 0; y <= WALL_TOP; y++) {
    for (let z = 0; z < HOUSE_GRID[2]; z++) {
      for (let x = 0; x < HOUSE_GRID[0]; x++) {
        if (from(x, z) > WALL + 0.4) continue;
        const r = roll(x, y, z, 1);
        const stone = r < 0.2 ? C.stoneDark : r < 0.35 ? C.stoneLight : C.stone;
        put(grid, [x, y, z], y <= KNEE ? stone : r < 0.08 ? C.stone : r < 0.4 ? C.mudDark : C.mud);
      }
    }
  }
  // Roots and moss creeping round its foot.
  for (let a = 0; a < 48; a++) {
    const t = (a / 48) * Math.PI * 2;
    const [x, z] = [Math.round(MID + Math.cos(t) * (WALL + 1)), Math.round(MID + Math.sin(t) * (WALL + 1))];
    if (Math.abs(x - MID) <= 2 && z < MID) continue; // (the doorstep clear)
    const r = roll(x, 0, z, 2);
    if (r < 0.55) put(grid, [x, 0, z], r < 0.25 ? C.bark : r < 0.45 ? C.roofMoss : C.roofMossLight);
  }

  // The thatch: a cone from the eaves to its top, ragged and sagging at its foot (tufts hanging lower), darker in
  // streaks, mossy low down on the shaded side.
  for (let y = WALL_TOP + 1; y <= APEX; y++) {
    const reach = EAVE - ((y - WALL_TOP - 1) * EAVE) / (APEX - WALL_TOP);
    for (let z = 0; z < HOUSE_GRID[2]; z++) {
      for (let x = 0; x < HOUSE_GRID[0]; x++) {
        const d = from(x, z);
        if (d > reach + 0.4) continue;
        const r = roll(x, y, z, 3);
        const low = y <= WALL_TOP + 3;
        put(grid, [x, y, z], low && z > MID && r < 0.3 ? (r < 0.15 ? C.roofMoss : C.roofMossLight) : r < 0.22 ? C.thatchDark : r < 0.32 ? C.thatchLight : C.thatch);
        if (y === WALL_TOP + 1 && d > reach - 1.2 && r < 0.45) put(grid, [x, y - 1, z], C.thatchDark); // (a tuft hanging)
      }
    }
  }
  // The chimney: rough stone out through the thatch, leaning over a voxel near its top, soot at its mouth.
  for (let y = WALL_TOP + 4; y <= APEX + 3; y++) {
    const lean = y > APEX ? 1 : 0;
    fillBox(grid, MID + 4 + lean, y, MID + 2, MID + 5 + lean, y, MID + 3, roll(0, y, 0, 4) < 0.3 ? C.stoneDark : C.stone);
  }
  fillBox(grid, MID + 5, APEX + 3, MID + 2, MID + 6, APEX + 3, MID + 3, C.soot);

  // The door: rough planks, set in the wall, a stone lintel over it, a step before it.
  for (let y = 1; y <= DOOR_TOP; y++) for (let x = MID - 1; x <= MID + 1; x++) for (let z = DOOR_Z; z <= DOOR_Z + 1; z++) put(grid, [x, y, z], x === MID ? C.doorDark : (x + y) % 3 === 0 ? C.doorDark : C.door);
  fillBox(grid, MID - 2, DOOR_TOP + 1, DOOR_Z, MID + 2, DOOR_TOP + 1, DOOR_Z, C.stoneLight);
  fillBox(grid, MID - 1, 0, DOOR_Z - 1, MID + 1, 0, DOOR_Z - 1, C.stoneLight);
  // The round window, front right: lit glass, a cross of herbs in it.
  const wx = MID + 5;
  const wz = Math.round(MID - Math.sqrt(WALL * WALL - 25)) - 1;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx && dy) continue;
      put(grid, [wx + dx, WINDOW_Y + dy, wz], dx || dy ? C.glass : C.herbFresh);
      put(grid, [wx + dx, WINDOW_Y + dy, wz + 1], C.glass);
    }
  }

  // Herbs drying under the eaves, round the front: bundles hanging from the thatch's edge.
  for (let i = 0; i < 6; i++) {
    const t = Math.PI * (1.2 + i * 0.12);
    const [x, z] = [Math.round(MID + Math.cos(t) * (EAVE - 1)), Math.round(MID + Math.sin(t) * (EAVE - 1))];
    const herb = [C.herbFresh, C.herbSage, C.herbDry][i % 3];
    put(grid, [x, WALL_TOP, z], C.bark);
    put(grid, [x, WALL_TOP - 1, z], herb);
    put(grid, [x, WALL_TOP - 2, z], herb);
  }

  // The signpost, before the door on the left: a post, a board with a leaf over a red flask, facing the path.
  const sx = MID - 5;
  const sz = 1;
  fillBox(grid, sx, 0, sz, sx, 7, sz, C.timber);
  for (let y = 4; y <= 7; y++) {
    for (let x = sx - 2; x <= sx + 2; x++) {
      if (x === sx) continue;
      const [row, col] = [7 - y, x - (sx - 2)];
      const leaf = row === 0 && (col === 3 || col === 4);
      const flask = (row === 2 && col === 3) || (row === 3 && (col === 3 || col === 4));
      put(grid, [x, y, sz], leaf ? C.leaf : flask ? C.flowerRed : C.sign);
    }
  }

  // Clay pots of herbs by the door, on the right.
  for (const [x, flower] of [[MID + 3, true], [MID + 5, false]] as const) {
    const z = DOOR_Z - 1;
    for (let y = 0; y <= 1; y++) put(grid, [x, y, z], C.clayPot);
    put(grid, [x, 2, z], C.leaf);
    put(grid, [x, 3, z], flower ? C.flowerPurple : C.herbFresh);
  }

  // The cauldron, out front on the right: iron, round, on three stones, its brew green, embers glowing under it.
  const [cx, cz] = [MID + 7, 2];
  for (const [dx, dz] of [[-1, -1], [1, -1], [0, 1]]) put(grid, [cx + dx, 0, cz + dz], C.stoneDark);
  put(grid, [cx, 0, cz], C.ember);
  for (let y = 1; y <= 2; y++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (Math.abs(dx) + Math.abs(dz) < 2 || y === 2) put(grid, [cx + dx, y, cz + dz], C.iron);
  put(grid, [cx, 3, cz], C.herbFresh);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(grid, [cx + dx, 3, cz + dz], C.iron); // (its rim)

  return grid;
}

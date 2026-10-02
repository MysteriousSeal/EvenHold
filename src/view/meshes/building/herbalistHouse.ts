// A herbalist's hut (npcs.ts: one a village, theirs alone), its own building
// on a house's tile: a long low house, as the village's are, but rustic:
// rough fieldstone to the knee and mud daub above it between crooked posts,
// roots and moss at its foot; a thick shaggy thatch over a gable, sagging
// low over the walls, mossy on its back slope, ragged at the eaves and the
// gable ends, a crooked stone chimney through it; a rough plank door under a
// stone lintel and a small window with herbs in it, both facing -Z; herbs
// drying under the front eave, a signpost with a leaf over a flask, clay
// pots of herbs by the door, and a little cauldron on its embers outside. In
// the houses' grid and palette (houseVoxels.ts, housePalette.ts).

import { hashUnit } from '../../../util/random';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { C } from './housePalette';
import { HOUSE_GRID } from './houseVoxels';
import { MID, put } from './houseParts';

// Its walls' box (house-grid voxels): wide along x, the door's side (-Z) at Z0.
const X0 = 4;
const X1 = 20;
const Z0 = 6;
const Z1 = 19;
const WALL_TOP = 9; // the walls' height
const KNEE = 3; // fieldstone up to here, daub above
const OVERHANG = 3; // the thatch's reach past the walls, front and back (it sags low there)
const GABLE = 2; // and past the gable ends
const DOOR_TOP = 7;
const MID_Z = (Z0 + Z1) / 2;

export function buildHermitHut(): VoxelGrid {
  const grid = createGrid(HOUSE_GRID);
  const roll = (x: number, y: number, z: number, salt: number) => hashUnit(x * 31 + y, z * 17 + y, salt);

  // The walls: fieldstone low (three shades), daub above (streaked, a stone showing through here and there).
  for (let y = 0; y <= WALL_TOP; y++) {
    fillBox(grid, X0, y, Z0, X1, y, Z1, (x, _y, z) => {
      const r = roll(x, y, z, 1);
      if (y <= KNEE) return r < 0.2 ? C.stoneDark : r < 0.35 ? C.stoneLight : C.stone;
      return r < 0.08 ? C.stone : r < 0.4 ? C.mudDark : C.mud;
    });
  }
  // Rough posts at the corners and along the long walls, standing a voxel proud, crooked (a voxel off halfway up).
  // (x, z) on a wall, (dx, dz) out from it; its top half a voxel along the wall.
  const post = (x: number, z: number, dx: number, dz: number) => {
    for (let y = KNEE + 1; y <= WALL_TOP; y++) {
      const off = y > (KNEE + WALL_TOP) / 2 ? 1 : 0;
      put(grid, [x + dx + (dz ? off : 0), y, z + dz + (dx ? off : 0)], C.timber);
    }
  };
  for (const x of [X0 + 1, MID + 3, X1 - 2]) {
    post(x, Z0, 0, -1); // the front's
    post(x, Z1, 0, 1); // the back's
  }
  for (const z of [Z0, Z1]) {
    post(X0, z, -1, 0);
    post(X1, z, 1, 0);
  }
  // Roots and moss creeping along its foot.
  for (let x = X0 - 1; x <= X1 + 1; x++) {
    for (let z = Z0 - 1; z <= Z1 + 1; z++) {
      if (x >= X0 && x <= X1 && z >= Z0 && z <= Z1) continue;
      if (z === Z0 - 1 && Math.abs(x - 12) <= 2) continue; // (the doorstep clear)
      const r = roll(x, 0, z, 2);
      if (r < 0.45) put(grid, [x, 0, z], r < 0.2 ? C.bark : r < 0.36 ? C.roofMoss : C.roofMossLight);
    }
  }

  // The thatch: a gable along x, thick, sagging low over the front and back (its eaves a voxel lower at the very
  // edge, tufts hanging from them), ragged, darker in streaks, mossy low on the back slope.
  const half = (Z1 - Z0) / 2 + OVERHANG;
  for (let k = 0; k <= Math.ceil(half); k++) {
    const y = WALL_TOP + 1 + k;
    const reach = half - k;
    for (let x = X0 - GABLE; x <= X1 + GABLE; x++) {
      for (let z = 0; z < HOUSE_GRID[2]; z++) {
        const dz = Math.abs(z - MID_Z);
        if (dz > reach + 0.5) continue;
        const edgeX = x < X0 - GABLE + 1 || x > X1 + GABLE - 1;
        if (edgeX && roll(x, y, z, 5) < 0.3) continue; // (its gable ends ragged)
        const r = roll(x, y, z, 3);
        const back = z > MID_Z && k <= 3;
        put(grid, [x, y, z], back && r < 0.32 ? (r < 0.16 ? C.roofMoss : C.roofMossLight) : r < 0.22 ? C.thatchDark : r < 0.32 ? C.thatchLight : C.thatch);
        if (k === 0 && dz > reach - 1.2 && r < 0.5) put(grid, [x, y - 1, z], C.thatchDark); // (sagging at the eaves, tufts hanging)
      }
    }
  }
  const apex = WALL_TOP + 1 + Math.ceil(half);
  // The chimney: rough stone up out of the thatch at the back, leaning over a voxel near its top, soot at its mouth.
  for (let y = WALL_TOP + 1; y <= apex + 3; y++) {
    const lean = y > apex ? 1 : 0;
    fillBox(grid, X1 - 4 + lean, y, Z1 - 4, X1 - 3 + lean, y, Z1 - 3, roll(0, y, 0, 4) < 0.3 ? C.stoneDark : C.stone);
  }
  fillBox(grid, X1 - 3, apex + 3, Z1 - 4, X1 - 2, apex + 3, Z1 - 3, C.soot);

  // The door: rough planks set in the front wall, a stone lintel over it, a flat stone before it.
  for (let y = 1; y <= DOOR_TOP; y++) for (let x = 11; x <= 13; x++) put(grid, [x, y, Z0], x === 12 || (x + y) % 3 === 0 ? C.doorDark : C.door);
  fillBox(grid, 10, DOOR_TOP + 1, Z0 - 1, 14, DOOR_TOP + 1, Z0, C.stoneLight);
  fillBox(grid, 11, 0, Z0 - 1, 13, 0, Z0 - 1, C.stoneLight);
  // A small window, front right: lit glass in a timber frame, a cross of herbs in it.
  const wx = 17;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) put(grid, [wx + dx, 5 + dy, Z0], dx === 0 || dy === 0 ? (dx === 0 && dy === 0 ? C.herbFresh : C.glass) : C.timber);
  }
  fillBox(grid, wx - 2, 3, Z0 - 1, wx + 2, 3, Z0 - 1, C.timber); // its sill

  // Herbs drying under the front eave: bundles hung from the thatch every few voxels (clear of the door and window).
  [X0 + 1, X0 + 3, X0 + 5, X1].forEach((x, i) => {
    const z = Z0 - 2;
    const herb = [C.herbFresh, C.herbSage, C.herbDry][i % 3];
    put(grid, [x, WALL_TOP, z], C.bark);
    put(grid, [x, WALL_TOP - 1, z], herb);
    put(grid, [x, WALL_TOP - 2, z], herb);
  });

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

  // Clay pots of herbs by the door, on the left.
  for (const [x, flower] of [[MID - 3, true], [MID - 5, false]] as const) {
    const z = Z0 - 1;
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

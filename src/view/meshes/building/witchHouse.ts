// A hedge-witch's cottage (model/witch/witchHomes.ts: about a village in three, the house at its edge), its own
// building on a house's tile, read from afar by its shape: small and black, under a steep thatch rotten near black
// that leans as it rises, like a hat pushed over, a crow on its ridge; tarred boards over a stone footing, a crooked
// stone chimney leaning off its left end; a low plank door under a cow's skull, a horseshoe nailed over it upside
// down, a small lit window; bones and blue witch-bottles hung from the eaves; a broom by the door; a garden of nettles
// and henbane behind a fence of crooked sticks, a skull on the gatepost. Faces -Z,
// in the houses' grid and palette (houseVoxels.ts, housePalette.ts).

import { hashUnit } from '../../../util/random';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { C } from './housePalette';
import { HOUSE_GRID } from './houseVoxels';
import { put } from './houseParts';

// Its walls' box (house-grid voxels), smaller than a herbalist's hut: the door's side (-Z) at Z0.
const X0 = 6;
const X1 = 18;
const Z0 = 7;
const Z1 = 17;
const FOOT = 1; // stone up to here, tarred boards above
const WALL_TOP = 10;
const OVERHANG = 2; // the thatch's reach past the walls, front and back,
const GABLE = 2; // and past the ends
const DOOR = 12; // the door's middle (x)
const DOOR_TOP = 7;
const WINDOW_X = 16;
const MID_Z = (Z0 + Z1) / 2;

export function buildWitchHut(): VoxelGrid {
  const grid = createGrid(HOUSE_GRID);
  const roll = (x: number, y: number, z: number, salt: number) => hashUnit(x * 31 + y, z * 17 + y, salt);

  // The walls: a footing of dark fieldstone, then boards stood on end, tarred, a shade a board (two voxels), here and
  // there one gone grey; green with damp at their foot.
  fillBox(grid, X0, 0, Z0, X1, WALL_TOP, Z1, (x, y, z) => {
    const r = roll(x, y, z, 1);
    if (y <= FOOT) return r < 0.5 ? C.stoneDark : C.stone;
    const board = (x + z) >> 1;
    if (y === FOOT + 1 && r < 0.35) return C.hutMoss;
    return roll(board, 0, 0, 2) < 0.15 ? C.stoneDark : board % 2 ? C.tar : C.tarLight;
  });

  // The thatch: a gable along x, steep (a voxel in for every two up), leaning as it rises (its ridge a voxel back
  // every five, a voxel to the right every four, and its ends drawn in near the top): a hat pushed over. Rotten near
  // black, darker in strands, moss in patches, ragged at the eaves.
  const rows = 2 * Math.ceil((Z1 - Z0) / 2 + OVERHANG) + 2;
  let apex = { x: DOOR, y: WALL_TOP, z: Math.round(MID_Z) };
  let was = MID_Z; // (the row below's ridge: each row reaches back over it, so none stands off the last)
  for (let j = 0; j < rows; j++) {
    const y = WALL_TOP + 1 + j;
    const reach = (Z1 - Z0) / 2 + OVERHANG - Math.floor(j / 2);
    if (reach < 0) break;
    const zc = MID_Z + Math.floor(j / 5);
    const shift = Math.floor(j / 4);
    const pinch = Math.max(0, j - rows / 2); // (its ends drawn in, the upper half)
    const [xa, xb] = [X0 - GABLE + shift + pinch, X1 + GABLE + shift - Math.floor(pinch / 2)];
    for (let x = xa; x <= xb; x++) {
      for (let z = 0; z < HOUSE_GRID[2]; z++) {
        if (z < Math.min(zc, was) - reach - 0.5 || z > Math.max(zc, was) + reach + 0.5) continue;
        const r = roll(x, y, z, 3);
        const edge = x === xa || x === xb;
        if (edge && r < 0.35) continue; // (its ends ragged)
        const overDoor = j <= 1 && z < Z0 && Math.abs(x - DOOR) <= 2; // (cut back over the door)
        if (overDoor) continue;
        const strand = roll(x >> 1, 0, z > zc ? 1 : 0, 4);
        put(grid, [x, y, z], r < 0.1 ? C.hutMoss : strand < 0.35 ? C.blackThatchDark : C.blackThatch);
        if (j === 0 && Math.abs(z - zc) > reach - 1 && r < 0.4 && Math.abs(x - DOOR) > 2) put(grid, [x, y - 1, z], C.blackThatchDark); // (tufts hanging at the eaves)
      }
    }
    apex = { x: Math.round((xa + xb) / 2), y, z: Math.round(zc) };
    was = zc;
  }
  // The crow on the ridge, looking out over the door: a body, its tail, its head, a beak.
  const { x: cx, y: cy, z: cz } = apex;
  fillBox(grid, cx - 1, cy + 1, cz, cx + 1, cy + 2, cz, C.crow);
  put(grid, [cx - 2, cy + 1, cz], C.crow); // its tail
  put(grid, [cx + 1, cy + 3, cz], C.crow); // its head
  put(grid, [cx + 2, cy + 3, cz], C.beak);

  // The chimney: off the left end, rough stone, leaning out from the wall as it climbs, soot at its mouth.
  let lean = 0;
  for (let y = 0; y <= WALL_TOP + 14; y++) {
    lean = y > WALL_TOP + 6 ? Math.floor((y - WALL_TOP - 6) / 4) : 0;
    fillBox(grid, X0 - 3 - lean, y, Z1 - 4, X0 - 1 - lean, y, Z1 - 2, roll(0, y, 0, 5) < 0.35 ? C.stoneDark : C.stone);
  }
  fillBox(grid, X0 - 3 - lean, WALL_TOP + 15, Z1 - 4, X0 - 1 - lean, WALL_TOP + 15, Z1 - 2, C.soot);

  // The door: low, of rough planks, a crack of firelight at its edge; a flat stone before it; the cow's skull over it
  // and the horseshoe nailed under that, upside down (the luck let out).
  for (let y = FOOT + 1; y <= DOOR_TOP; y++) for (let x = DOOR - 1; x <= DOOR + 1; x++) put(grid, [x, y, Z0], (x + y) % 3 === 0 ? C.doorDark : C.door);
  for (let y = FOOT + 1; y < DOOR_TOP; y++) put(grid, [DOOR + 1, y, Z0], C.glass); // (ajar)
  fillBox(grid, DOOR - 1, 0, Z0 - 1, DOOR + 1, 0, Z0 - 2, C.stoneLight);
  fillBox(grid, DOOR - 2, DOOR_TOP + 1, Z0 - 1, DOOR + 2, DOOR_TOP + 1, Z0 - 1, C.timber); // its lintel
  skull(grid, DOOR, DOOR_TOP + 2, Z0 - 1);
  for (const [dx, dy] of [[-1, 0], [1, 0], [-1, -1], [1, -1]]) put(grid, [DOOR + dx, DOOR_TOP + dy, Z0 - 1], C.iron); // (over the door, under the lintel: its heels down)
  put(grid, [DOOR, DOOR_TOP, Z0 - 1], C.iron);
  // A small window, front right: two by two of lit glass in a crooked frame, a voxel lower one side.
  for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) put(grid, [WINDOW_X + dx, 6 + dy - (dx === 2 ? 1 : 0), Z0], dx >= 0 && dx <= 1 && dy >= 0 && dy <= 1 ? C.glass : C.timber);
  // The broom, leant by the door on the left: its handle up the wall, its bristles on the ground.
  for (let y = 2; y <= 7; y++) put(grid, [DOOR - 4, y, Z0 - 1], C.bark);
  fillBox(grid, DOOR - 5, 0, Z0 - 1, DOOR - 3, 1, Z0 - 1, (x, y) => (y === 1 && x !== DOOR - 4 ? 0 : C.hayDark));

  // Hung from the front eaves: strings of bones and blue witch-bottles, clear of the door and the window.
  const hung: Array<[number, 'bones' | 'bottle']> = [[X0, 'bones'], [X0 + 2, 'bottle'], [X0 + 4, 'bones'], [X1 + 1, 'bottle'], [X1 - 1, 'bones']];
  for (const [x, what] of hung) {
    const z = Z0 - OVERHANG + 1;
    put(grid, [x, WALL_TOP, z], C.twine);
    if (what === 'bones') for (let y = WALL_TOP - 3; y < WALL_TOP; y++) put(grid, [x, y, z], y % 2 ? C.bone : C.boneDark);
    else {
      put(grid, [x, WALL_TOP - 1, z], C.twine);
      fillBox(grid, x, WALL_TOP - 3, z, x, WALL_TOP - 2, z, C.witchGlass);
    }
  }

  garden(grid, roll);
  return grid;
}

// A skull, its face out to -Z at (x, y, z) its middle: three across, two high, two dark eyes, its teeth below.
function skull(grid: VoxelGrid, x: number, y: number, z: number): void {
  fillBox(grid, x - 1, y, z, x + 1, y + 1, z, C.bone);
  fillBox(grid, x - 1, y, z + 1, x + 1, y + 1, z + 1, C.boneDark); // (its back, against what it's on)
  put(grid, [x - 1, y + 1, z], C.soot);
  put(grid, [x + 1, y + 1, z], C.soot);
  put(grid, [x, y - 1, z], C.boneDark); // its jaw
}

// The garden, before the door (z 0 to Z0 - 2): a fence of crooked sticks, open at the path, a skull on the gatepost,
// to be seen from the road; nettles and henbane in clumps.
function garden(grid: VoxelGrid, roll: (x: number, y: number, z: number, salt: number) => number): void {
  const gate = (x: number) => x >= DOOR - 2 && x <= DOOR + 2;
  for (let x = 2; x <= 22; x++) {
    if (gate(x)) continue;
    const tall = x % 3 === 0 ? 3 + Math.floor(roll(x, 0, 0, 6) * 2) : 0; // a stick every three, leaning, the rest wattle
    if (tall) {
      fillBox(grid, x, 0, 1, x, tall, 1, C.bark);
      if (roll(x, tall, 0, 7) < 0.5) put(grid, [x + 1, tall, 1], C.bark); // (its top crooked)
    }
    else for (let y = 1; y <= 2; y++) put(grid, [x, y, 1], (x + y) % 2 ? C.wattleDark : C.wattle);
  }
  for (let z = 2; z <= Z0 - 1; z++) for (const x of [2, 22]) for (let y = 0; y <= (z % 3 === 0 ? 3 : 2); y++) put(grid, [x, y, z], y && z % 3 ? C.wattleDark : C.bark);
  // The gateposts, the right one with a skull on top.
  for (const x of [DOOR - 3, DOOR + 3]) fillBox(grid, x, 0, 1, x, 4, 1, C.bark);
  skull(grid, DOOR + 3, 5, 0);
  // The path to the door, flat stones.
  for (const [x, z] of [[DOOR - 1, 3], [DOOR, 4]]) fillBox(grid, x, 0, z, x + 1, 0, z, C.stoneLight);
  // Nettles and henbane in clumps either side of it, rank and tall.
  for (let x = 3; x <= 21; x++) {
    for (let z = 2; z <= Z0 - 2; z++) {
      if (Math.abs(x - DOOR) <= 2) continue;
      const r = roll(x, 0, z, 8);
      if (r < 0.45) continue;
      const tall = 1 + Math.floor(r * 3);
      for (let y = 0; y < tall; y++) put(grid, [x, y, z], C.nettle);
      if (r > 0.85) put(grid, [x, tall, z], C.henbane); // (henbane's pale flowers)
    }
  }
}

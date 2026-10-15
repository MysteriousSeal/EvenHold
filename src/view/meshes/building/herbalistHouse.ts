// A herbalist's hut (npcs.ts: one a village, theirs alone), its own building
// on a house's tile: a long low house, as the village's are, but rustic:
// rough fieldstone to the knee and mud daub above it between crooked posts,
// moss clumped at its foot; a thick shaggy thatch, old and greyed, over a
// gable, sagging low over the walls, mossy on its back slope, ragged at the
// eaves and the gable ends, a sod ridge along its top, a crooked stone
// chimney through it; a rough plank door under a stone lintel and a small
// lit window, the thatch lifted over both, facing -Z; herbs drying under
// its eaves, clay pots of herbs by the door; a garden fenced in wattle
// (raised beds, stepping stones, a cauldron on its embers, a sign of a green
// bottle hung by the gate) round its front and a bed down its right side;
// a fairy ring by its back corner. Its trade to be seen from every side. In
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
const WINDOW_X = 17;
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
  // Moss gathered at its foot in a few clumps (along its back, by its left side, at the front corner), a root in each.
  for (const [mx, mz] of [[MID, Z1 + 1], [X0 - 1, Z0 + 6], [X0 - 1, Z0]]) {
    for (let x = mx - 2; x <= mx + 2; x++) {
      for (let z = mz - 2; z <= mz + 2; z++) {
        const outside = x < X0 || x > X1 || z < Z0 || z > Z1;
        const r = roll(x, 0, z, 2);
        if (!outside || Math.hypot(x - mx, z - mz) > 2.2 || r < 0.2) continue;
        put(grid, [x, 0, z], r < 0.3 ? C.bark : r < 0.6 ? C.roofMoss : C.hutMossLight);
        if (r > 0.75) put(grid, [x, 1, z], C.hutMoss);
      }
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
        const overDoor = z < Z0 - 1 && k <= 1 && Math.abs(x - 12) <= 2; // (lifted over the door, an eyebrow in the thatch, so it shows)
        const overWindow = z < Z0 - 1 && k === 0 && Math.abs(x - WINDOW_X) <= 2; // (and over the window, a voxel)
        if (overDoor || overWindow) continue;
        // Its straw in strands running down the slope (a shade for each run of it along the ridge, now and then a
        // tuft of its own), a darker cap bound along the ridge, its eaves' cut edge lighter.
        const strand = roll(x >> 1, 0, z > MID_Z ? 1 : 0, 6);
        const straw = r < 0.12 ? C.thatchDark : strand < 0.3 ? C.thatchDark : strand < 0.55 ? C.thatchLight : C.thatch;
        const ridge = k >= Math.ceil(half) - 1;
        put(grid, [x, y, z], ridge ? C.thatchDark : back && r < 0.32 ? (r < 0.16 ? C.hutMoss : C.hutMossLight) : k === 0 ? C.thatchLight : straw);
        if (k === 0 && dz > reach - 1.2 && r < 0.5 && Math.abs(x - 12) > 3 && (z > MID_Z || Math.abs(x - WINDOW_X) > 3)) put(grid, [x, y - 1, z], C.thatchDark); // (sagging at the eaves, tufts hanging)
      }
    }
  }
  const apex = WALL_TOP + 1 + Math.ceil(half);
  // A sod ridge laid along its top, two voxels high, mossy.
  for (let x = X0 - GABLE + 1; x <= X1 + GABLE - 1; x++) {
    for (let y = apex; y <= apex + 1; y++) for (const z of [Math.floor(MID_Z), Math.ceil(MID_Z)]) put(grid, [x, y, z], roll(x, y, z, 8) < 0.5 ? C.sod : C.hutMoss);
  }
  // The chimney: rough stone up out of the thatch at the back, leaning over a voxel near its top, soot at its mouth.
  for (let y = WALL_TOP + 1; y <= apex + 3; y++) {
    const lean = y > apex ? 1 : 0;
    fillBox(grid, X1 - 4 + lean, y, Z1 - 4, X1 - 3 + lean, y, Z1 - 3, roll(0, y, 0, 4) < 0.3 ? C.stoneDark : C.stone);
  }
  fillBox(grid, X1 - 3, apex + 3, Z1 - 4, X1 - 2, apex + 3, Z1 - 3, C.soot);

  // The door: rough planks set in the front wall, a stone lintel over it, a flat stone before it.
  for (let y = 1; y <= DOOR_TOP; y++) for (let x = 11; x <= 13; x++) put(grid, [x, y, Z0], x === 12 || (x + y) % 3 === 0 ? C.doorDark : C.door);
  for (let y = 1; y < DOOR_TOP; y++) put(grid, [13, y, Z0], C.glass); // (ajar: the firelight at its crack, lit at night)
  fillBox(grid, 10, DOOR_TOP + 1, Z0 - 1, 14, DOOR_TOP + 1, Z0, C.stoneLight);
  fillBox(grid, 11, 0, Z0 - 1, 13, 0, Z0 - 1, C.stoneLight);
  for (const y of [2, 6]) fillBox(grid, 11, y, Z0 - 1, 12, y, Z0 - 1, C.iron); // its strap hinges
  for (let y = 1; y <= DOOR_TOP; y++) for (const x of [10, 14]) put(grid, [x, y, Z0 - 1], C.timber); // its rough jambs, standing proud
  // A small window, front right: three by three of lit glass in a rough timber frame, a sill under it.
  const wx = WINDOW_X;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) put(grid, [wx + dx, 6 + dy, Z0], Math.abs(dx) < 2 && Math.abs(dy) < 2 ? C.glass : C.timber);
  fillBox(grid, wx - 2, 3, Z0 - 1, wx + 2, 3, Z0 - 1, C.timber); // its sill

  // Herbs drying under the eaves, front and back: bundles hung from the thatch (clear of the door and window).
  const hung: Array<[number, number]> = [[X0 + 1, Z0 - 2], [X0 + 3, Z0 - 2], [X0 + 5, Z0 - 2], [X1, Z0 - 2], [X0 + 5, Z1 + 2], [X1 - 6, Z1 + 2]];
  hung.forEach(([x, z], i) => {
    const herb = [C.herbFresh, C.herbSage, C.herbDry][i % 3];
    put(grid, [x, WALL_TOP, z], C.bark);
    put(grid, [x, WALL_TOP - 1, z], herb);
    put(grid, [x, WALL_TOP - 2, z], herb);
  });

  garden(grid, roll);
  // Clay pots of herbs by the door, on the left.
  for (const [x, flower] of [[MID - 3, true], [MID - 5, false]] as const) {
    const z = Z0 - 1;
    for (let y = 0; y <= 1; y++) put(grid, [x, y, z], C.clayPot);
    put(grid, [x, 2, z], C.leaf);
    put(grid, [x, 3, z], flower ? C.flowerPurple : C.herbFresh);
  }
  // A fairy ring of toadstools at its back corner: red caps spotted pale on pale stems (its uncanny note).
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const [x, z] = [Math.round(2 + Math.cos(a) * 1.6), Math.round(22 + Math.sin(a) * 1.8)];
    put(grid, [x, 0, z], C.toadstoolStem);
    put(grid, [x, 1, z], k % 2 ? C.toadstool : C.toadstoolSpot);
  }

  return grid;
}

// The garden, in the strip before the door (z 0 to 4) and down the right side: a low wattle fence round it, open at
// the path; stepping stones out from the door; the cauldron on its embers in the left corner, its brew bright green;
// raised beds edged in wattle, rows of herbs in them (lavender, sage, foxgloves, marigolds); and the sign by the gate,
// a post and its arm, a dark green bottle hung from it on a twine.
function garden(grid: VoxelGrid, roll: (x: number, y: number, z: number, salt: number) => number): void {
  const gate = (x: number) => x >= 10 && x <= 14;
  // The fence: posts every three, a voxel taller than the two woven rails between, the weave lighter than the posts,
  // round the front and up the sides to the walls.
  const fence = (x: number, z: number, i: number) => {
    if (i % 3 === 0) fillBox(grid, x, 0, z, x, 3, z, C.wattleDark);
    else for (let y = 1; y <= 2; y++) put(grid, [x, y, z], (i + y) % 2 ? C.wattleLight : C.wattle);
  };
  for (let x = 0; x <= 24; x++) if (!gate(x)) fence(x, 0, x);
  for (let z = 1; z < Z0; z++) fence(0, z, z);
  for (let z = 1; z <= Z1 + 1; z++) fence(24, z, z); // (and on down its right side, round the bed there)
  // The stepping stones, from the doorstep out to the gate.
  for (const [x, z] of [[11, 3], [12, 1]]) fillBox(grid, x, 0, z, x + 1, 0, z + 1, C.stoneLight);
  // The raised beds: edged, soil, a row of herbs along each (a hash for their heights).
  const bed = (x0: number, x1: number, rows: Array<[number, number]>) => {
    fillBox(grid, x0, 0, 1, x1, 1, 4, (x, _y, z) => (x === x0 || x === x1 || z === 1 || z === 4 ? C.wattleDark : C.soil));
    rows.forEach(([flower, leaf], i) => {
      const z = 2 + i;
      for (let x = x0 + 1; x < x1; x++) {
        const spike = flower === C.foxglove && x % 2 === 0; // (a foxglove's spike every other voxel, leaves between)
        const tall = spike ? 4 : 2 + Math.floor(roll(x, 2, z, 9) * 2);
        for (let y = 2; y < 2 + tall; y++) put(grid, [x, y, z], (spike && y > 3) || (!spike && flower !== C.foxglove && y === 1 + tall) ? flower : leaf);
      }
    });
  };
  bed(6, 9, [[C.lavender, C.herbSage], [C.foxglove, C.sod]]);
  bed(18, 23, [[C.marigold, C.leaf], [C.foxglove, C.sod]]);
  // Down its right side, a long bed of the tallest (lavender, foxgloves), to show over the fence from that side.
  fillBox(grid, 21, 0, Z0 + 1, 23, 1, Z1 - 1, (x, _y, z) => (x === 22 && z > Z0 + 1 && z < Z1 - 1 ? C.soil : C.wattleDark));
  for (let z = Z0 + 2; z < Z1 - 1; z++) {
    const spike = z % 2 === 0;
    for (let y = 2; y <= (spike ? 5 : 3); y++) put(grid, [22, y, z], y >= (spike ? 4 : 3) ? (spike ? C.foxglove : C.lavender) : spike ? C.sod : C.herbSage);
  }
  // The cauldron, in the left corner: black iron, round, on its legs over a bed of embers glowing out from under it (lit
  // at night), three stones round them, its brew green, sunk in its rim.
  const [cx, cz] = [3, 3];
  for (const [dx, dz] of [[-2, -2], [2, -2], [2, 2]]) put(grid, [cx + dx, 0, cz + dz], C.stoneDark);
  fillBox(grid, cx - 2, 0, cz - 2, cx + 2, 0, cz + 2, (x, _y, z) => (Math.hypot(x - cx, z - cz) <= 2.3 && !(Math.abs(x - cx) === 2 && Math.abs(z - cz) === 2) ? C.ember : 0));
  fillBox(grid, cx - 1, 1, cz, cx + 1, 1, cz, C.ember); // (flames licking up under it)
  fillBox(grid, cx, 1, cz - 1, cx, 1, cz + 1, C.ember);
  for (const [dx, dz] of [[-2, -1], [1, -2], [1, 2]]) fillBox(grid, cx + dx, 1, cz + dz, cx + dx, 2, cz + dz, C.soot); // its legs, up off the fire
  // Its belly round (no corners), sooty; its rim a ring of iron; the brew sunk a voxel inside it, brightest at its heart.
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      const r = Math.hypot(dx, dz);
      const at = (y: number) => [cx + dx, y, cz + dz] as [number, number, number];
      if (r <= 1) put(grid, at(2), C.soot);
      if (r <= 2.3) put(grid, at(3), r < 1.5 ? (r === 0 ? C.brew : C.brewDeep) : C.soot);
      if (r <= 2.3 && r >= 1.5) put(grid, at(4), C.iron);
    }
  }
  // The sign on the gate's right: a post, a short arm out from its top, a dark green bottle hung two below it on a
  // twine, its neck up.
  fillBox(grid, 15, 0, 1, 15, 8, 1, C.timber);
  fillBox(grid, 15, 8, 1, 17, 8, 1, C.sign);
  put(grid, [17, 7, 1], C.twine);
  put(grid, [17, 6, 1], C.bottle); // its neck
  fillBox(grid, 16, 3, 1, 17, 5, 2, C.bottle);
}

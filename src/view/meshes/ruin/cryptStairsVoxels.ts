// A crypt's way down (model/crypts/crypts.ts): a little stone tomb, two
// tiles wide and two deep (50 x 50 voxels, in the ruins' palette and stone:
// ruinVoxels.ts), its door toward local +Z where the hero stands. In front,
// steps going down into the ground (the terrain left out there: terrainMesh.ts)
// between the walls of their pit, a low kerb along them, to its door, a round arch black inside,
// each step darker than the last till they're lost in the dark; a rusted iron
// gate at their head, its two leaves swung back along the kerbs. Behind, the
// tomb itself, of the ruins' own stone (ruinWallVoxels.ts): on a stepped plinth,
// walls of ashlar with a pilaster at each corner, a coping round the top, and a gabled roof of stone slabs, its
// gable over the door. Weathered: cracks down its walls, blocks gone from
// them, a corner of the roof fallen in (by variant), moss on the roof and
// the cornice and at its foot, ivy up its sides. By variant too: one gate
// leaf sagging off its hinge, or gone.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { hashUnit } from '../../../util/random';
import { C } from './ruinVoxels';
import { ashlarBlock, ashlarStone } from './ruinWallVoxels';

export const STAIRS_GRID: [number, number, number] = [50, 62, 50];
export const SINK = 14; // voxels of it below the ground (the stairs going down into it): its ground level

const KERB = 2; // the kerbs' height above the ground
const DOOR = 25; // the tomb's front, from the back (its door wall 6 deep: 25..30)
const FRONT = DOOR + 6; // where the stairs begin
const WALLS = 30; // the tomb's walls' height, to the cornice
const ARCH = [8, 41] as const; // the door's sides, across
const archTop = (u: number) => 17 + Math.round(9 * Math.sqrt(Math.max(0, 1 - ((u - 24.5) / 17) ** 2)));
const roofAt = (u: number) => WALLS + 3 + Math.floor((24 - Math.abs(u - 24.5)) * 0.45); // the roof's top, across: a gable
const STEP_TONES = [C.stoneLight, C.stone, C.stoneDark, C.mortar, C.slit, C.dark];

export function buildCryptStairs(variant: number): VoxelGrid {
  const raw = createGrid(STAIRS_GRID);
  // Drawn from the ground up (y 0 the ground's level), all but the stairs and their pit (`below`).
  const fill = (u0: number, y0: number, v0: number, u1: number, y1: number, v1: number, color: number | ((u: number, y: number, v: number) => number)) =>
    fillBox(raw, u0, y0 + SINK, v0, u1, y1 + SINK, v1, typeof color === 'number' ? color : (u, y, v) => color(u, y - SINK, v));
  const set = (u: number, y: number, v: number, color: number) => fill(u, y, v, u, y, v, color);
  const below = (u: number, y: number, v: number, color: number) => fillBox(raw, u, y, v, u, y, v, color);
  const fallen = (u: number, v: number) => variant % 2 === 1 && u > 34 && v < 12 + (u - 34) * 0.6 && hashUnit(Math.floor(u / 3), Math.floor(v / 3), 70) < 0.85; // the roof's fallen corner

  // The plinth: two steps of dark stone, moss at its foot.
  fill(0, 0, 0, 49, 1, DOOR + 5, (u, y, v) => (v >= DOOR - 2 && u >= 6 && u <= 43 ? 0 : y === 0 && hashUnit(u, v, 71 + variant) < 0.3 ? C.moss : C.stoneDark));
  fill(1, 2, 1, 48, 2, DOOR + 5, (u, _y, v) => (v >= DOOR - 2 && u >= 6 && u <= 43 ? 0 : C.stone));

  // The walls, in the ruins' ashlar (ruinWallVoxels.ts), two thick: cracks running down from the cornice, a
  // block gone here and there, ivy hanging in curtains from the top; a pilaster at each corner, as the ruins'.
  const crack = (along: number, y: number, salt: number) => along === Math.round(8 + salt * 9 + Math.sin(y * 0.9 + salt) * 1.5) && y > 8;
  for (let y = 3; y <= WALLS; y++) {
    for (let u = 2; u <= 47; u++) {
      for (let v = 2; v <= DOOR + 5; v++) {
        const side = u <= 3 || u >= 46;
        const back = v <= 3;
        if (!side && !back && v < DOOR) continue; // (hollow)
        if (inArch(u, y) && v >= DOOR) continue; // (the door)
        const face = u === 2 || u === 47 || v === 2 || v === DOOR + 5;
        const along = u === 2 || u === 47 ? v : u;
        const pilaster = (u <= 5 || u >= 44) && (v <= 5 || v >= DOOR + 2);
        if (pilaster) {
          const joint = (y - 2) % 4 === 0;
          if (!(joint && face)) set(u, y, v, joint ? C.mortar : Math.floor((y - 2) / 4) % 2 ? C.stoneLight : C.stone);
          continue;
        }
        let color = ashlarStone(along, y - 3, face, variant, 72);
        if (!color) continue; // (a sunk joint)
        const block = ashlarBlock(along, y - 3, variant);
        if (face && (u === 2 || u === 47) && crack(v, y, u === 2 ? 0 : 1)) color = C.slit;
        else if (face && v === 2 && crack(u, y, 2 + (variant % 2))) color = C.slit;
        else if (face && y < WALLS - 3 && hashUnit(block, Math.floor((y - 3) / 5), 73 + u + variant) < 0.06) continue; // a block gone
        set(u, y, v, color);
      }
    }
  }
  // The pilasters stand out a voxel at the corners, front and back.
  for (const [u0, u1] of [[1, 5], [44, 48]]) {
    fill(u0, 3, 1, u1, WALLS, 1, (_u, y) => ((y - 2) % 4 === 0 ? C.mortar : Math.floor((y - 2) / 4) % 2 ? C.stoneLight : C.stone));
  }
  // Ivy hanging from the top down its sides and back, in curtains.
  for (let k = 0; k < 50; k++) {
    const curtain = Math.floor(k / 4);
    if (hashUnit(curtain, variant, 74) >= 0.3 + variant * 0.1) continue;
    const reach = 6 + Math.floor(hashUnit(curtain, variant, 78) * 16);
    for (let y = WALLS - reach; y <= WALLS; y++) {
      if (hashUnit(k, y, 79) >= 0.75) continue;
      const color = hashUnit(k, y, 80) < 0.5 ? C.ivy : C.ivyLight;
      if (k >= 6 && k <= 43) set(k, y, 1, color); // the back
      if (k >= 6 && k <= DOOR) set(k < 25 ? 1 : 48, y, k < 25 ? k : k - 20, color); // a side
    }
  }
  // Inside the door: the dark, the steps going on down into it.
  // (Inside the door: the pit, the dark beyond it: below.)

  // The cornice: a coping as the ruins' walls have, standing out all round the top, light, moss on it and
  // dripping over its edge.
  fill(1, WALLS + 1, 1, 48, WALLS + 2, DOOR + 6, (u, y, v) => (fallen(u, v) ? 0 : y === WALLS + 2 ? (hashUnit(u, v, 75 + variant) < 0.4 ? C.moss : C.stoneLight) : C.stone));
  for (let u = 1; u <= 48; u++) {
    const drip = hashUnit(u, 1, 81 + variant) < 0.35 ? 1 + Math.floor(hashUnit(u, 2, 82) * 3) : 0;
    for (let y = WALLS + 1 - drip; y <= WALLS; y++) set(u, y, 0, C.moss);
  }

  // The roof, of stone slabs: in courses down either slope from the ridge, each course's lower edge standing
  // a voxel proud (one slab lapping the next), the joints between slabs sunk and staggered course to course,
  // each slab its own tone, its upper edge lit; a cap of light blocks along the ridge; a light coping up both
  // gables, standing over the slabs; the gables' ends ashlar, a round window in the front one; moss in the
  // joints and in clumps; a corner fallen in (by variant).
  for (let u = 0; u <= 49; u++) {
    const top = roofAt(u);
    const out = Math.abs(u - 24.5); // from the ridge
    const ridge = out < 2;
    const course = Math.floor((out - 2) / 5);
    const lip = !ridge && (out - 2) % 5 >= 4; // a course's lower edge
    for (let v = 0; v <= DOOR + 6; v++) {
      if (fallen(u, v)) continue;
      const gable = v === 0 || v === DOOR + 6;
      const rake = v <= 1 || v >= DOOR + 5; // the gables' coping
      const along = v + course * 3;
      const joint = !ridge && !rake && along % 7 === 0;
      const slab = Math.floor(along / 7) * 5 + course;
      const tone = [C.stone, C.stoneDark, C.stone, C.stoneLight][Math.floor(hashUnit(slab, variant, 87) * 4)];
      const high = top + (rake || ridge || lip ? 1 : 0);
      for (let y = WALLS + 3; y <= high; y++) {
        let color = tone === C.stoneLight ? C.stone : C.stoneDark; // (within)
        if (gable && y < top) color = ashlarStone(u, y - WALLS - 3, true, variant, 88) || C.mortar;
        if (y === high) {
          if (rake || ridge) color = ridge && v % 6 === 0 && !rake ? C.mortar : C.stoneLight;
          else if (joint) color = hashUnit(u, v, 89 + variant) < 0.5 ? C.moss : C.mortar;
          else if (hashUnit(Math.floor(u / 3), Math.floor(v / 3), 90 + variant) < 0.18) color = hashUnit(u, v, 91) < 0.5 ? C.moss : C.mossDark;
          else color = lip ? (tone === C.stoneDark ? C.stone : C.stoneLight) : tone;
        }
        if (v === DOOR + 6 && y < top) {
          const r = Math.hypot(u - 24.5, y - (WALLS + 6));
          if (r < 2.6) color = C.slit; // its window
          else if (r < 3.6) color = C.stoneLight;
        }
        if (joint && y === high && !gable && hashUnit(u, v, 92) < 0.3) continue; // (a joint open)
        set(u, y, v, color);
      }
      if (!rake && !ridge && hashUnit(u, v, 93 + variant) < 0.03) set(u, high + 1, v, C.moss); // a clump of it
    }
  }
  if (variant % 2 === 1) for (let k = 0; k < 4; k++) fill(36 + k * 3, 3, 3 + k * 2, 37 + k * 3, 3 + (k % 2), 4 + k * 2, k % 2 ? C.stone : C.stoneLight); // what fell, inside

  // The door: its ring of wedge stones, light, standing out a voxel; the jambs; the keystone at its crown.
  for (let u = ARCH[0] - 2; u <= ARCH[1] + 2; u++) {
    const crown = archTop(Math.min(ARCH[1], Math.max(ARCH[0], u)));
    for (let y = crown; y <= crown + 2; y++) set(u, y, FRONT, (u + y) % 5 === 0 ? C.mortar : C.stoneLight);
  }
  for (const u of [ARCH[0] - 2, ARCH[0] - 1, ARCH[1] + 1, ARCH[1] + 2]) for (let y = 3; y < archTop(ARCH[0]); y++) set(u, y, FRONT, y % 5 === 0 ? C.mortar : C.stoneLight);
  fill(22, archTop(24), FRONT, 27, archTop(24) + 5, FRONT + 1, C.stoneLight);
  fill(23, archTop(24) + 1, FRONT + 1, 26, archTop(24) + 4, FRONT + 1, C.stone);
  // Ivy hanging down the door's front, either side of it.
  for (const [u0, u1] of [[1, 6], [43, 48]]) {
    if (hashUnit(u0, variant, 77) >= 0.5 + variant * 0.1) continue;
    const reach = 8 + Math.floor(hashUnit(u0, variant, 84) * 14);
    for (let u = u0; u <= u1; u++) for (let y = WALLS - reach; y <= WALLS; y++) if (hashUnit(u, y, 85) < 0.7) set(u, y, FRONT, hashUnit(u, y, 86) < 0.5 ? C.ivy : C.ivyLight);
  }

  // The pit the stairs go down: its walls of the ruins' ashlar either side from its floor up, a low kerb
  // standing above the ground along them, coped, moss along its top.
  for (const [u0, u1] of [[0, 5], [44, 49]]) {
    for (let u = u0; u <= u1; u++) {
      for (let y = 0; y <= SINK + KERB; y++) {
        for (let v = DOOR; v <= 49; v++) {
          const face = u === 5 || u === 44 || u === 0 || u === 49;
          const coping = y >= SINK + KERB - 1;
          const stone = coping ? (y === SINK + KERB ? (hashUnit(u, v, 83 + variant) < 0.4 ? C.moss : C.stoneLight) : C.stone) : ashlarStone(v, y, face, variant, 61);
          if (stone) below(u, y, v, stone);
        }
      }
    }
  }
  // The steps: six, three deep, down from the ground's level toward the door, two voxels each, each darker;
  // then the dark under the door, its far side black.
  for (let k = 0; k < 6; k++) {
    const [v0, v1, top] = [47 - k * 3, 49 - k * 3, SINK - 1 - 2 * k];
    for (let u = 6; u <= 43; u++) for (let v = v0; v <= v1; v++) for (let y = 0; y <= top; y++) below(u, y, v, y === top ? (v === v0 && k < 3 ? STEP_TONES[k + 1] : STEP_TONES[k]) : STEP_TONES[Math.min(5, k + 2)]);
  }
  for (let u = 6; u <= 43; u++) {
    for (let v = DOOR; v <= 31; v++) below(u, 0, v, C.dark);
    for (let y = 0; y < SINK + archTop(Math.min(ARCH[1], Math.max(ARCH[0], u))); y++) below(u, y, DOOR, C.dark); // (on the pit's own edge: the ground behind it never showing its side)
  }

  // The gate: a leaf swung back along each kerb from its hinge at the head of the steps, bars and rails of
  // rusted iron; one sagging off its hinge (by variant), the other gone in two of them.
  const leaf = (u: number, sag: boolean) => {
    for (let v = 33; v <= 48; v++) {
      const drop = sag ? Math.floor((48 - v) / 5) : 0;
      const [low, high] = [KERB + 1 - drop, KERB + 16 - drop];
      for (const y of [low, low + 6, high]) set(u, y, v, C.iron); // the rails
      if (v % 3 === 0 || v === 48) for (let y = low; y <= high + 2; y++) set(u, y, v, hashUnit(v, y, 67 + u) < 0.35 ? C.rustDark : C.rust); // a bar, its spike above
    }
  };
  leaf(6, variant === 1);
  if (variant < 2) leaf(43, variant === 0);
  for (const u of [5, 44]) fill(u, KERB + 1, 49, u, KERB + 18, 49, C.iron); // the hinge posts
  return raw;
}

const inArch = (u: number, y: number) => u >= ARCH[0] && u <= ARCH[1] && y < archTop(u);

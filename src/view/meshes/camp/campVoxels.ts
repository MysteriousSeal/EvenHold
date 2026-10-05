// A bandit camp in voxels (model/camps/camps.ts), the world's 0.04, a tile 25
// voxels across, each piece facing local +Z (the camp's middle; a palisade
// segment or the gatehouse drawn on its tile's local -Z edge, outermost at z 0).
// Palette first, one for the whole stockade so it reads as one: weathered
// timber in four tones (bark, its shadow, split wood, cut ends), rope, rusted
// iron and steel; patched hides, plain canvas and a blood-red canvas; furs; bone
// for its trophies; crate wood, burlap, apples; and what glows (drawn unlit):
// fire, embers, torchlight, gold. Silhouette first: a stockade of thick
// sharpened logs, a gatehouse over its way in (two tall posts, a lintel, torches),
// a watchtower over it all, its tents, its banner.
// Here the palisade, the gatehouse, the watchtower and the woodpile; the rest
// in campPropVoxels.ts.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor, voxelLine } from '../voxel/voxelShapes';
import { hashUnit } from '../../../util/random';

export const CAMP_VOXEL_SIZE = 0.04;
export const TILE = 25;

const ENTRIES = {
  bark: 0x6b4a30,
  barkDark: 0x4e3522,
  split: 0x8a6544, // split or hewn wood
  cutEnd: 0xc8a070, // a log's sawn end
  ring: 0x9a7448, // its growth rings
  rope: 0xc2a26b,
  iron: 0x3d3d42,
  rust: 0x7a4a32,
  steel: 0xb9bec6,
  stone: 0x8e8b82,
  stoneDark: 0x6f6c64,
  ash: 0x4a4440,
  char: 0x2b2522,
  earth: 0x6a5238,
  hideTan: 0xb08a5c,
  hideBrown: 0x7a5638,
  canvas: 0xc9b89a,
  canvasShade: 0xa8977a,
  red: 0x9a3a2c,
  redDark: 0x6e2820,
  seam: 0x4a3526,
  fur: 0xd9d2c4,
  furDark: 0x8e867a,
  inside: 0x231c17,
  bone: 0xe0d6bc,
  boneShade: 0xb5aa90,
  socket: 0x2a2420,
  crate: 0x9a7040,
  crateDark: 0x6e4e2c,
  burlap: 0xb89a6a,
  burlapDark: 0x8e7450,
  apple: 0xb83a2a,
  leaf: 0x5e7a3a,
  pot: 0x2e2c2e,
  stew: 0x7a5a2a,
  meat: 0x8a4a2a,
  goldDim: 0xb08a2a,
  straw: 0xd8b860, // the hay strewn over its floor
  strawPale: 0xe8d088,
  strawDark: 0xa88a40,
  trodden: 0x7a6040, // the earth trodden bare under it
  gold: 0xf0c64a, // (glow)
  ember: 0xd04a1a, // (glow)
  flameDeep: 0xff7a2a, // (glow)
  flame: 0xffb347, // (glow)
  flameHeart: 0xffe39a, // (glow)
} as const;

export const CAMP_PALETTE: number[] = Object.values(ENTRIES);
export const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;
export const CAMP_GLOWING: ReadonlySet<number> = new Set([C.gold, C.ember, C.flameDeep, C.flame, C.flameHeart]);

export const set = (g: VoxelGrid, x: number, y: number, z: number, c: number): void => {
  if (x >= 0 && y >= 0 && z >= 0 && x < g.size[0] && y < g.size[1] && z < g.size[2]) setColor(g, x, y, z, c);
};

// An upright log, `w` voxels across (round: its corners off), from y0 to y1, its bark streaked, sharpened to a point
// at its top (`sharp`), else sawn flat (its end ringed).
export function post(g: VoxelGrid, x0: number, z0: number, w: number, y0: number, y1: number, sharp: boolean, seed: number): void {
  for (let y = y0; y <= y1; y++) {
    const tip = sharp ? Math.max(0, y - (y1 - 2)) : 0; // (the last voxels narrowing to a point)
    for (let dx = 0; dx < w; dx++) for (let dz = 0; dz < w; dz++) {
      const corner = (dx === 0 || dx === w - 1) && (dz === 0 || dz === w - 1);
      if (corner && w > 2) continue;
      const inner = Math.min(dx, w - 1 - dx, dz, w - 1 - dz);
      if (tip > inner) continue;
      const streak = hashUnit(x0 + dx, Math.floor(y / 3), seed) < 0.3;
      set(g, x0 + dx, y, z0 + dz, sharp && y > y1 - 3 ? C.split : !sharp && y === y1 ? (inner > 0 ? C.ring : C.cutEnd) : streak ? C.barkDark : C.bark);
    }
  }
}

// A log lying along x (from x0 to x1), `w` across, at height y0, its sawn ends showing their rings.
export function logAlongX(g: VoxelGrid, x0: number, x1: number, y0: number, z0: number, w: number): void {
  for (let x = x0; x <= x1; x++) for (let dy = 0; dy < w; dy++) for (let dz = 0; dz < w; dz++) {
    const corner = (dy === 0 || dy === w - 1) && (dz === 0 || dz === w - 1);
    if (corner && w > 2) continue;
    const end = x === x0 || x === x1;
    set(g, x, y0 + dy, z0 + dz, end ? (dy > 0 && dy < w - 1 && dz > 0 && dz < w - 1 ? C.ring : C.cutEnd) : (x + dy) % 4 === 0 ? C.barkDark : C.bark);
  }
}

// A skull, five across, its face toward +z, sitting on y0.
export function skull(g: VoxelGrid, x0: number, y0: number, z0: number): void {
  fillBox(g, x0, y0 + 1, z0, x0 + 4, y0 + 4, z0 + 3, (x, y) => (y === y0 + 4 && (x === x0 || x === x0 + 4) ? 0 : C.bone));
  fillBox(g, x0 + 1, y0, z0 + 1, x0 + 3, y0, z0 + 3, C.boneShade); // its jaw
  for (const x of [x0 + 1, x0 + 3]) set(g, x, y0 + 2, z0 + 3, C.socket);
  set(g, x0 + 2, y0 + 1, z0 + 3, C.socket); // (its nose)
}

// A torch on a bracket at (x, y, z), its flame over it (glowing).
export function torch(g: VoxelGrid, x: number, y: number, z: number): void {
  set(g, x, y - 1, z, C.iron);
  set(g, x, y, z, C.iron);
  set(g, x, y + 1, z, C.barkDark);
  set(g, x, y + 2, z, C.flameDeep);
  set(g, x, y + 3, z, C.flame);
  set(g, x, y + 4, z, C.flameHeart);
}

// ---- The palisade: thick round logs side by side, sharpened, of uneven height, outermost at z 0; inside them two
// cross-beams lashed to each log. By its look: plain, a skull on a stake, a round shield nailed on outside, or a hide
// stretched to dry inside. ----
export const PALISADE_HIGH = 26;
export function buildPalisade(variant = 0): VoxelGrid {
  const g = createGrid([TILE, PALISADE_HIGH, TILE]);
  for (let x = 0; x < TILE; x += 3) {
    const top = 15 + Math.floor(hashUnit(x, variant, 72) * 6);
    post(g, x, 1, 3, 0, top, true, 73 + variant);
  }
  for (const y of [5, 12]) {
    for (let x = 0; x < TILE; x++) set(g, x, y, 4, (x + y) % 6 === 0 ? C.barkDark : C.split); // the cross-beam, hewn
    for (let x = 1; x < TILE; x += 3) set(g, x, y + 1, 4, C.rope); // lashed to each log
  }
  if (variant === 1) {
    post(g, 12, 1, 3, 0, 23, true, 74); // a taller stake, a skull on it
    skull(g, 11, 24 - 4, 0);
  } else if (variant === 2) {
    for (let x = 7; x <= 15; x++) for (let y = 6; y <= 14; y++) {
      const r = Math.hypot(x - 11, y - 10);
      if (r <= 4.3) set(g, x, y, 0, r > 3.4 ? C.iron : r < 1.2 ? C.steel : (x + y) % 3 === 0 ? C.redDark : C.red); // a round shield, its boss, its rim
    }
  } else if (variant === 3) {
    for (let x = 6; x <= 17; x++) for (let y = 7; y <= 15; y++) {
      const edge = x === 6 || x === 17 || y === 7 || y === 15;
      if (!(edge && (x + y) % 2)) set(g, x, y, 5, edge ? C.hideBrown : (x * y) % 7 === 0 ? C.hideBrown : C.hideTan); // a hide stretched on the beams
    }
  }
  return g;
}

// ---- The gatehouse, on the way in's outer edge: two tall posts either side (where the palisade ends), a lintel log
// across them high over the way, a skull hung from its middle and a tattered banner either side of it, a torch
// burning on each post's inner face. ----
export const GATE_HIGH = 36;
export function buildGate(): VoxelGrid {
  const g = createGrid([TILE, GATE_HIGH, TILE]);
  post(g, 0, 0, 4, 0, 33, true, 75);
  post(g, TILE - 4, 0, 4, 0, 33, true, 76);
  logAlongX(g, 0, TILE - 1, 28, 0, 3); // the lintel
  for (const x of [3, TILE - 4]) for (let y = 26; y <= 27; y++) set(g, x, y, 1, C.rope); // (lashed to the posts)
  // From its middle, a skull on a rope; either side, a banner, red, torn at its foot.
  for (let y = 24; y <= 27; y++) set(g, 12, y, 1, C.rope);
  skull(g, 10, 19, 0);
  for (const x0 of [5, 16]) {
    for (let x = x0; x <= x0 + 3; x++) for (let y = 19; y <= 27; y++) {
      if (y < 21 && (x + y) % 2 === 0) continue; // (torn)
      set(g, x, y, 1, y === 24 && x === x0 + 1 ? C.bone : (x === x0 || x === x0 + 3) ? C.redDark : C.red);
    }
  }
  torch(g, 4, 16, 2); // on each post, inside
  torch(g, TILE - 5, 16, 2);
  return g;
}
// Where the gatehouse's torches burn, in its grid (for their live flames: campFires.ts).
export const GATE_TORCHES: ReadonlyArray<[number, number, number]> = [[4, 18, 2], [TILE - 5, 18, 2]];

// ---- The watchtower, in a corner: four stilts (cross-braced on two sides), a railed platform of planks high up, a
// roof of hides over it on its corner posts, a ladder up its front (local +Z), a banner on its peak. ----
export const TOWER_HIGH = 54;
export function buildTower(): VoxelGrid {
  const g = createGrid([TILE, TOWER_HIGH, TILE]);
  const FLOOR = 30;
  const stilts: Array<[number, number]> = [[3, 3], [19, 3], [3, 19], [19, 19]];
  for (const [x, z] of stilts) post(g, x, z, 3, 0, FLOOR + 12, false, 77 + x);
  // Cross-braces on its back and one side: an X of hewn beams between the stilts.
  for (const [a, b] of [[[4, 2, 4], [20, FLOOR - 2, 4]], [[20, 2, 4], [4, FLOOR - 2, 4]], [[4, 2, 4], [4, FLOOR - 2, 20]], [[4, 2, 20], [4, FLOOR - 2, 4]]] as Array<[[number, number, number], [number, number, number]]>) {
    voxelLine(g, a, b, C.split);
  }
  // The platform: planks across, their ends dark; a rail round it on short posts.
  for (let x = 2; x <= 22; x++) for (let z = 2; z <= 22; z++) set(g, x, FLOOR, z, x % 4 === 0 ? C.barkDark : C.split);
  for (let x = 2; x <= 22; x++) for (const z of [2, 22]) [set(g, x, FLOOR + 4, z, C.split), x % 5 === 2 && fillBox(g, x, FLOOR + 1, z, x, FLOOR + 3, z, C.bark)];
  for (let z = 2; z <= 22; z++) for (const x of [2, 22]) [set(g, x, FLOOR + 4, z, C.split), z % 5 === 2 && fillBox(g, x, FLOOR + 1, z, x, FLOOR + 3, z, C.bark)];
  for (let x = 9; x <= 15; x++) set(g, x, FLOOR + 4, 22, 0); // (the rail open where the ladder comes up)
  // The roof: hides over a low pyramid on the corner posts, its eaves out past the platform.
  for (let y = FLOOR + 12; y <= FLOOR + 19; y++) {
    const r = 13 - (y - FLOOR - 12) * 1.6;
    for (let x = 0; x < TILE; x++) for (let z = 0; z < TILE; z++) {
      if (Math.max(Math.abs(x - 12), Math.abs(z - 12)) > r) continue;
      if (Math.max(Math.abs(x - 12), Math.abs(z - 12)) < r - 1.6 && y < FLOOR + 19) continue;
      set(g, x, y, z, (x + z + y) % 7 === 0 ? C.seam : hashUnit(Math.floor(x / 4), Math.floor(z / 4), 78) < 0.5 ? C.hideTan : C.hideBrown);
    }
  }
  // Its peak: a short pole, a red pennant.
  fillBox(g, 12, FLOOR + 19, 12, 12, FLOOR + 23, 12, C.barkDark);
  fillBox(g, 13, FLOOR + 21, 12, 15, FLOOR + 23, 12, (x, y) => (x === 15 && y === FLOOR + 21 ? 0 : C.red));
  // The ladder, up its front: two rails, a rung every third voxel.
  for (const x of [10, 14]) fillBox(g, x, 0, 23, x, FLOOR, 23, C.bark);
  for (let y = 2; y < FLOOR; y += 3) fillBox(g, 11, y, 23, 13, y, 23, C.split);
  return g;
}

// ---- The woodpile, against the palisade at the back: split logs stacked between two stakes, their sawn ends out;
// before it, a chopping stump, an axe bitten into it, chips scattered round. ----
export const WOODPILE_HIGH = 16;
export function buildWoodpile(): VoxelGrid {
  const g = createGrid([TILE, WOODPILE_HIGH, TILE]);
  for (const x of [2, 21]) post(g, x, 3, 2, 0, 13, false, 79);
  for (let row = 0; row < 4; row++) {
    const y0 = row * 3;
    const shift = row % 2 ? 1 : 0;
    for (let x = 4 + shift; x <= 19; x += 3) {
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
        if ((dx === 0 || dx === 2) && (dy === 0 || dy === 2)) continue;
        for (let z = 2; z <= 8; z++) set(g, x + dx, y0 + dy, z, z === 8 ? (dx === 1 && dy === 1 ? C.ring : C.cutEnd) : C.bark); // (their sawn ends toward the camp)
      }
    }
  }
  // The stump: a short wide log, ringed on top; an axe bitten into it, its haft leaning out.
  for (let x = 9; x <= 15; x++) for (let z = 13; z <= 19; z++) {
    const r = Math.hypot(x - 12, z - 16);
    if (r > 3.3) continue;
    for (let y = 0; y <= 4; y++) set(g, x, y, z, y === 4 ? (r < 1.5 ? C.ring : C.cutEnd) : (x + y) % 3 === 0 ? C.barkDark : C.bark);
  }
  fillBox(g, 11, 5, 15, 13, 6, 15, C.steel); // the axe's head, bitten in
  set(g, 11, 5, 15, C.iron);
  voxelLine(g, [12, 6, 16], [12, 12, 21], C.split); // its haft
  for (const [x, z] of [[6, 14], [17, 18], [8, 21], [16, 12], [14, 22]]) set(g, x, 0, z, C.split); // chips
  return g;
}

// ---- Its floor, a tile of it: loose hay heaped over trodden earth, in relief (silhouette first: the steps between
// its heights are what read as hay, from the camera's distance). Soft drifts a voxel to three high, a few clumps
// heaped higher, bare earth where it's trodden down to it; shadowed straw low, gold over it, sun-bleached on the
// tops; stalks sticking up out of the clumps. Low and ragged at its edges, so the tiles beside it run on without a
// seam; its look by variant. Drawn squashed low (campMesh.ts): waded through, never stepped up onto. ----
export const STRAW_HIGH = 7;
export function buildStrawFloor(variant: number): VoxelGrid {
  const g = createGrid([TILE, STRAW_HIGH, TILE]);
  const seed = 830 + variant * 11;
  const clumps = Array.from({ length: 3 }, (_, k) => ({ x: 4 + hashUnit(k, variant, seed) * 16, z: 4 + hashUnit(variant, k, seed + 1) * 16, r: 2.2 + hashUnit(k, k, seed + 2) * 1.6 }));
  const heights: number[] = [];
  for (let x = 0; x < TILE; x++) for (let z = 0; z < TILE; z++) {
    const drift = smooth(x, z, seed, 6);
    let h = drift < 0.3 ? 0 : Math.round(1 + (drift - 0.3) * 3.2 + (hashUnit(x, z, seed + 3) - 0.5) * 0.8); // (bare where it's trodden down)
    for (const c of clumps) {
      const d = Math.hypot(x - c.x, z - c.z);
      if (d < c.r) h = Math.max(h, Math.round(2 + 2.5 * (1 - d / c.r) + hashUnit(x, z, seed + 4) * 0.8)); // heaped
    }
    const edge = Math.min(x, z, TILE - 1 - x, TILE - 1 - z) + hashUnit(z, x, seed + 5) * 1.5;
    h = Math.max(0, Math.min(h, Math.floor(1 + edge / 1.4))); // (settling low and ragged at its edges)
    heights.push(h);
    set(g, x, 0, z, C.trodden);
    for (let y = 1; y <= h; y++) set(g, x, y, z, y === h ? (h >= 3 ? C.strawPale : C.straw) : y === 1 ? C.strawDark : (x + z + y) % 5 === 0 ? C.strawDark : C.straw);
  }
  // Stalks sticking up out of its clumps, at a slant.
  for (const c of clumps) for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + variant;
    const [x, z] = [Math.round(c.x + Math.cos(a) * c.r * 0.5), Math.round(c.z + Math.sin(a) * c.r * 0.5)];
    if (x < 1 || z < 1 || x > TILE - 2 || z > TILE - 2) continue;
    const base = heights[x * TILE + z];
    const [dx, dz] = [Math.round(Math.cos(a)), Math.round(Math.sin(a))];
    set(g, x, base + 1, z, C.strawPale);
    set(g, x + dx, base + 2, z + dz, C.straw);
  }
  return g;
}

// Smooth noise (0..1) over a lattice `cell` apart: soft drifts, not speckle.
function smooth(u: number, v: number, seed: number, cell: number): number {
  const [gu, gv] = [Math.floor(u / cell), Math.floor(v / cell)];
  const [fu, fv] = [u / cell - gu, v / cell - gv];
  const [su, sv] = [fu * fu * (3 - 2 * fu), fv * fv * (3 - 2 * fv)];
  const at = (a: number, b: number) => hashUnit(gu + a, gv + b, seed);
  return (at(0, 0) * (1 - su) + at(1, 0) * su) * (1 - sv) + (at(0, 1) * (1 - su) + at(1, 1) * su) * sv;
}

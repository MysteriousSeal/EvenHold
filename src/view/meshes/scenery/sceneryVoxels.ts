// Rocks and landmarks in voxels (model/scenery/scenery.ts), in the ruins'
// old stone (ruinVoxels.ts' tones) so they sit with them: weathered greys,
// lit along their tops, in shade at their feet, moss on what faces the sky,
// lichen in pale specks; bark and heartwood for the logs, a few red-capped
// mushrooms. Each laid out along x, a tile (25 voxels) to each of its tiles,
// stood on its ground; silhouette first, the camera's distance in mind.

import { colorAt, createGrid, setColor } from '../voxel/voxelShapes';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { hashUnit } from '../../../util/random';
import type { SceneryKind } from '../../../model/scenery/scenery';

const ENTRIES = {
  stoneLight: 0xbdb6a6,
  stone: 0x9d968a,
  stoneDark: 0x7b766c,
  stoneDeep: 0x5f5b54, // the shade at a rock's foot, in its cracks
  moss: 0x78913f,
  mossDark: 0x55702c,
  mossLight: 0x93ad52,
  lichen: 0xd6d08a, // pale yellow specks on the stone
  ivy: 0x3e6c30,
  ivyLight: 0x62994a,
  bark: 0x6b4a32,
  barkDark: 0x4a3222,
  wood: 0xc9a46c, // a cut log's heartwood
  woodRing: 0x9a7448,
  cap: 0xb8382a, // a mushroom's red cap
  spot: 0xf2eadb,
  gill: 0xe8dcc4,
  carve: 0x6f6a61, // a spiral cut into a standing stone
  grass: 0x7aa84a,
} as const;
export const SCENERY_PALETTE: number[] = Object.values(ENTRIES);
const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;
export const SCENERY_VOXEL = 0.04;
const T = 25; // voxels to a tile

// A piece's grid: its tiles along x and z, and how tall.
export function sceneryGrid(kind: SceneryKind): [number, number, number] {
  return { boulder: [T, 18, T], outcrop: [2 * T, 24, 2 * T], log: [2 * T, 14, T], cairn: [T, 22, T], wall: [3 * T, 16, T], menhir: [T, 42, T] }[kind] as [number, number, number];
}

const n = (x: number, y: number, z: number, salt: number) => hashUnit(x * 31 + z * 7, y, salt); // (a voxel's own roll)

// The weathered stone's tone at (x, y, z) of a rock whose top is at `top`: moss where it faces the sky (`up`), lit near
// its top, in shade at its foot, lichen here and there.
function stoneAt(x: number, y: number, z: number, top: number, up: boolean, salt: number): number {
  const r = n(x, y, z, salt);
  if (up && r < 0.55) return r < 0.2 ? C.mossLight : r < 0.4 ? C.moss : C.mossDark;
  if (r > 0.965) return C.lichen;
  if (y <= 1) return r < 0.5 ? C.stoneDeep : C.stoneDark;
  if (y >= top - 2) return r < 0.6 ? C.stoneLight : C.stone;
  return r < 0.18 ? C.stoneDark : r < 0.85 ? C.stone : C.stoneLight;
}

// A rounded lump of rock: an ellipsoid (half-sizes rx, ry, rz round cx, cz, from its foot) roughened, its top
// stepped, mossed; what's inside left solid.
function lump(g: VoxelGrid, cx: number, cz: number, rx: number, ry: number, rz: number, y0: number, salt: number, mossy = true): void {
  const [sx, sy, sz] = g.size;
  const inside = (x: number, y: number, z: number) => {
    const d = ((x - cx) / rx) ** 2 + ((y - y0) / ry) ** 2 + ((z - cz) / rz) ** 2;
    return y >= y0 && d <= 1 - n(x, Math.floor(y / 2), z, salt + 9) * 0.22;
  };
  for (let x = 0; x < sx; x++) for (let z = 0; z < sz; z++) for (let y = y0; y < sy; y++) {
    if (!inside(x, y, z)) continue;
    const up = mossy && !inside(x, y + 1, z) && y > y0 + ry * 0.35;
    setColor(g, x, y, z, stoneAt(x, y, z, y0 + ry, up, salt));
  }
}

// A few blades of grass and a clump of moss about a rock's foot.
function foot(g: VoxelGrid, salt: number): void {
  const [sx, , sz] = g.size;
  const stone = (x: number, z: number) => colorAt(g, x, 0, z) !== 0;
  for (let x = 0; x < sx; x++) for (let z = 0; z < sz; z++) {
    if (stone(x, z) || !(stone(x + 1, z) || stone(x - 1, z) || stone(x, z + 1) || stone(x, z - 1))) continue;
    const r = n(x, 0, z, salt + 3);
    if (r < 0.18) setColor(g, x, 0, z, C.moss);
    else if (r < 0.26) for (let y = 0; y < 2 + (Math.floor(r * 100) % 2); y++) setColor(g, x, y, z, C.grass);
  }
}

function boulder(v: number): VoxelGrid {
  const g = createGrid(sceneryGrid('boulder'));
  lump(g, 12, 12, 9 - (v % 2), 13 - v, 8 + (v % 3), 0, 11 + v);
  if (v >= 2) lump(g, 19, 6, 4, 6, 4, 0, 21 + v); // (a smaller stone leant against it)
  foot(g, v);
  return g;
}

// Slabs stacked, each a little smaller and off-set, their edges stepped, moss on each shelf.
function outcrop(v: number): VoxelGrid {
  const g = createGrid(sceneryGrid('outcrop'));
  const slabs = [
    [25, 25, 21, 7, 18],
    [22 + v, 27, 16, 7, 14],
    [27, 22 - v, 11, 7, 9],
  ] as const;
  slabs.forEach(([cx, cz, rx, ry, rz], i) => lump(g, cx, cz, rx, ry * 1.6, rz, i * 6, 31 + v * 7 + i));
  if (v % 2) lump(g, 9, 38, 5, 6, 5, 0, 41 + v); // (a fallen block by it)
  foot(g, 5 + v);
  return g;
}

// A felled trunk lying along x: bark in ridges, moss along its top, its cut end showing its rings, a stub of a branch,
// and red-capped mushrooms at its side.
function log(v: number): VoxelGrid {
  const g = createGrid(sceneryGrid('log'));
  const [cz, cy, r] = [12, 5, 5.4]; // (its underside on the ground)
  const [x0, x1] = [3, 46 - (v % 2) * 3];
  for (let x = x0; x <= x1; x++) for (let y = 0; y < 12; y++) for (let z = 0; z < T; z++) {
    const d = Math.hypot(y - cy, z - cz);
    if (d > r) continue;
    const end = x === x0 || x === x1;
    const top = y >= cy + r - 1.5;
    let c: number = (z + Math.floor(x / 3)) % 3 === 0 ? C.barkDark : C.bark;
    if (end) c = d > r - 1 ? C.barkDark : Math.round(d) % 2 ? C.woodRing : C.wood;
    else if (top && n(x, y, z, 51 + v) < 0.6) c = n(x, y, z, 52) < 0.5 ? C.moss : C.mossDark;
    setColor(g, x, y, z, c);
  }
  for (let y = 7; y < 11; y++) setColor(g, 30 - v * 3, y, 15, C.barkDark); // a stub of a branch
  setColor(g, 31 - v * 3, 10, 16, C.bark);
  // Mushrooms on the near side: stalks, red caps, white spots.
  for (const [mx, my, big] of [[12 + v * 4, 2, 1], [15 + v * 4, 4, 0], [36, 1, 1]] as const) {
    const z = cz + 6;
    setColor(g, mx, my, z, C.gill);
    for (let dx = -big; dx <= big; dx++) for (let dz = 0; dz <= big; dz++) setColor(g, mx + dx, my + 1, z + dz, (dx + dz) % 2 ? C.cap : C.spot);
    setColor(g, mx, my + 1 + big, z, C.cap);
  }
  foot(g, 60 + v);
  return g;
}

// Flat stones stacked smaller and smaller, each turned a little, a pointed one on top.
function cairn(v: number): VoxelGrid {
  const g = createGrid(sceneryGrid('cairn'));
  const layers = [[8, 7], [7, 6], [6, 5], [5, 4], [3.6, 3], [2.4, 2]];
  let y = 0;
  layers.forEach(([rx, rz], i) => {
    const [ox, oz] = [((i * 3 + v) % 3) - 1, ((i * 5 + v) % 3) - 1];
    const h = i === layers.length - 1 ? 4 : 3;
    for (let x = 0; x < T; x++) for (let z = 0; z < T; z++) {
      if (((x - 12 - ox) / rx) ** 2 + ((z - 12 - oz) / rz) ** 2 > 1) continue;
      for (let k = 0; k < h; k++) setColor(g, x, y + k, z, k === h - 1 ? (n(x, i, z, 71) < 0.25 ? C.moss : C.stoneLight) : k === 0 ? C.stoneDark : C.stone);
    }
    y += h;
  });
  foot(g, 70 + v);
  return g;
}

// A length of old dry-stone wall along x: irregular stones in rough courses, no mortar (the dark between them), a row of
// cope stones set on edge along its top; ivy over one side; tumbled down low at one end (more, the older the variant).
function wall(v: number): VoxelGrid {
  const g = createGrid(sceneryGrid('wall'));
  const [z0, z1] = [9, 15];
  const L = 3 * T;
  for (let x = 1; x < L - 1; x++) {
    const fall = x > L - 22 ? Math.min(9, Math.floor((x - (L - 22)) / 2) * (v >= 2 ? 2 : 1)) : 0; // (tumbled at its end)
    const high = 11 - fall - (n(x, 0, 0, 81) < 0.15 ? 1 : 0);
    for (let y = 0; y < high; y++) for (let z = z0; z <= z1; z++) {
      const course = Math.floor(y / 3);
      const stone = Math.floor((x + course * 4) / 5);
      const seam = (x + course * 4) % 5 === 0 || y % 3 === 2 && n(x, course, 0, 82) < 0.5;
      const face = z === z0 || z === z1;
      setColor(g, x, y, z, seam && face ? C.stoneDeep : [C.stone, C.stoneDark, C.stoneLight, C.stone][Math.floor(hashUnit(stone, course, 83) * 4)]);
    }
    if (high >= 10) for (let z = z0 + 1; z < z1; z++) setColor(g, x, high, z, x % 2 ? C.stoneLight : C.stone); // the cope, on edge
    if (high > 0 && n(x, 0, 0, 84) < 0.3) setColor(g, x, high, z0 + 3, C.moss);
  }
  // Ivy down the near face, in hanging strands.
  for (let x = 4 + v * 5; x < 4 + v * 5 + 22; x++) {
    const hang = 3 + Math.floor(n(x, 0, 0, 85) * 7);
    for (let y = 10 - hang; y <= 10; y++) if (n(x, y, 0, 86) < 0.8) setColor(g, x, y, z1 + 1, n(x, y, 1, 87) < 0.35 ? C.ivyLight : C.ivy);
  }
  // Tumbled stones at its foot.
  for (const [x, z] of [[L - 14, z1 + 3], [L - 9, z0 - 3], [L - 6, z1 + 2]]) for (let dx = 0; dx < 3; dx++) for (let dz = 0; dz < 2; dz++) setColor(g, x + dx, 0, z + dz, C.stoneDark);
  return g;
}

// A tall standing stone, tapering, leaning a touch, weathered: streaks down it, lichen, moss at its foot and a spiral
// cut into its face (-z, toward the camera).
function menhir(v: number): VoxelGrid {
  const g = createGrid(sceneryGrid('menhir'));
  const high = 32 + v * 3;
  const lean = (y: number) => Math.round((y / high) * (v % 2 ? 2 : -2));
  for (let y = 0; y < high; y++) {
    const t = y / high;
    const [hx, hz] = [5 - t * 2.2, 3.4 - t * 1.2]; // (narrowing to its top)
    const rounded = y > high - 4 ? (high - y) / 4 : 1;
    for (let x = 0; x < T; x++) for (let z = 0; z < T; z++) {
      const [dx, dz] = [x - 12 - lean(y), z - 12];
      if (Math.abs(dx) > hx * Math.sqrt(rounded) || Math.abs(dz) > hz) continue;
      const streak = (x * 7) % 5 === 0 && n(x, Math.floor(y / 6), 0, 91) < 0.6;
      let c = streak ? C.stoneDark : stoneAt(x, y, z, high, false, 92 + v);
      if (y < 4 && n(x, y, z, 93) < 0.5) c = n(x, y, z, 94) < 0.5 ? C.moss : C.mossDark;
      setColor(g, x, y, z, c);
    }
  }
  // The spiral on its face: a turning groove, a little lighter cut.
  const face = 12 - 3;
  for (let a = 0; a < Math.PI * 5; a += 0.12) {
    const r = 0.6 + a * 0.18;
    const [x, y] = [Math.round(12 + lean(18) + Math.cos(a) * r), Math.round(18 + Math.sin(a) * r)];
    setColor(g, x, y, face, C.carve);
  }
  foot(g, 95 + v);
  return g;
}

const BUILD: Record<SceneryKind, (v: number) => VoxelGrid> = { boulder, outcrop, log, cairn, wall, menhir };
export const buildScenery = (kind: SceneryKind, variant: number): VoxelGrid => BUILD[kind](variant);

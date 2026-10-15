// Rocks and landmarks in voxels (model/scenery/scenery.ts), in the ruins'
// old stone (ruinVoxels.ts' tones) so they sit with them: weathered greys,
// lit along their tops, in shade at their feet, moss on what faces the sky,
// lichen in pale specks; bark and heartwood for the logs, a few red-capped
// mushrooms. Each laid out along x, a tile (25 voxels) to each of its tiles,
// stood on its ground; silhouette first, the camera's distance in mind.
// The country's own (model/scenery/biomeScenery.ts): a dead tree, silver-grey
// and bare; a weeping willow, its fronds hanging in curtains; a granite tor,
// rounded blocks piled on one another.

import { colorAt, createGrid, setColor, voxelLine } from '../voxel/voxelShapes';
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
  // The wagon's (by the start):
  iron: 0x50545a,
  sack: 0xcdb98a,
  sackDark: 0xa89468,
  crate: 0xa87c4a,
  crateDark: 0x7a5632,
  // The country's own:
  dead: 0x9a8f80, // a dead tree's bare wood, weathered silver
  deadLight: 0xbcb2a0,
  deadDark: 0x6a6054,
  willow: 0x7fa35a,
  willowLight: 0x98b86a,
  willowDark: 0x5f8a3e,
  willowBark: 0x5a4a38,
} as const;
export const SCENERY_PALETTE: number[] = Object.values(ENTRIES);
const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;
export const SCENERY_VOXEL = 0.04;
const T = 25; // voxels to a tile

// A piece's grid: its tiles along x and z, and how tall.
export function sceneryGrid(kind: SceneryKind): [number, number, number] {
  return { boulder: [T, 18, T], outcrop: [2 * T, 24, 2 * T], log: [2 * T, 14, T], cairn: [T, 22, T], wall: [3 * T, 16, T], menhir: [T, 42, T], wagon: [2 * T, 26, T], snag: [T + 10, 58, T + 10], willow: [WILLOW, 60, WILLOW], tor: [2 * T, 36, 2 * T] }[kind] as [number, number, number];
}

const WILLOW = 2 * T - 6; // a willow's crown, across: over its tile, and well past it
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

// A broken-down wagon, along x (voxel-art: palette first, silhouette before detail, nothing finer than the camera
// reads). Three tones do the work: dark weathered timber (the frame, the wheels), mid timber (the bed), and pale
// goods on it (sacks, a new-wood crate), so the load stands off the bed and the wheels off both; iron only as the
// tyres and hubs. Its shape, big to small: the tall far wheel; the bed leaning hard toward the camera's side, its
// near wheel off; that wheel leant against the side, a third of its rim gone; two thick shafts down to the ground.
// Nothing a single voxel thin: spokes, rails and shafts two thick, shading in bands (no speckle).
function wagon(): VoxelGrid {
  const g = createGrid(sceneryGrid('wagon'));
  const put = (x: number, y: number, z: number, c: number) => x >= 0 && x < 2 * T && y >= 0 && y < 26 && z >= 0 && z < T && setColor(g, x, y, z, c);
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number | ((x: number, y: number, z: number) => number)) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(x, y, z, typeof c === 'number' ? c : c(x, y, z));
  };
  // A wheel two thick in the plane z0..z0+1, its hub at (cx, cy): an iron tyre, a dark rim, four thick spokes, an
  // iron hub; `gone`: the arc of it broken away (radians from, to), if any.
  const wheel = (cx: number, cy: number, z0: number, r: number, gone?: [number, number]) => {
    for (let x = cx - r; x <= cx + r; x++) for (let y = cy - r; y <= cy + r; y++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > r + 0.3) continue;
      const a = Math.atan2(y - cy, x - cx);
      if (gone && d > 2.5 && a > gone[0] && a < gone[1]) continue;
      const spoke = Math.abs(x - cx) <= 1 || Math.abs(y - cy) <= 1;
      const c = d > r - 1 ? C.iron : d > r - 3 ? C.barkDark : d < 2.4 ? C.iron : spoke ? C.bark : 0;
      if (c) box(x, y, z0, x, y, z0 + 1, c);
    }
  };
  const bedY = (z: number) => 12 - Math.floor((z - 6) / 2.6); // (the bed's top: 12 on the wheel's side, down to 7 where the wheel's off)
  wheel(20, 9, 3, 9); // the far wheel, on: the tallest thing of it
  for (let z = 5; z <= 19; z++) box(19, bedY(z) - 4, z, 21, bedY(z) - 2, z, C.barkDark); // the axle, down with the lean
  box(17, 0, 16, 24, 2, 21, (_x, y) => (y === 2 ? C.stone : C.stoneDark)); // the flat stone set under its end
  // The bed: mid timber, a darker board every third row (lengthwise only); solid low sides, darker, on corner posts.
  for (let z = 6; z <= 19; z++) {
    const y = bedY(z);
    box(5, y - 1, z, 36, y, z, z % 3 === 0 ? C.crateDark : C.crate);
    for (let x = 5; x <= 36; x++) {
      const end = x <= 6 || x >= 35;
      const side = z <= 7 || z >= 18;
      if (!end && !side) continue;
      const post = end && side;
      box(x, y + 1, z, x, y + (post ? 6 : end ? 3 : 4), z, post ? C.barkDark : C.bark);
    }
  }
  // The shafts: two thick, from the bed's front down to the ground.
  for (const z of [8, 16]) for (let x = 37; x <= 49; x++) {
    const y = Math.max(0, Math.round((bedY(z) - 1) * (1 - (x - 36) / 13)));
    box(x, y, z, x, y + 1, z + 1, C.barkDark);
  }
  // The load: a crate of new wood (pale, dark-edged) and sacks (pale, a dark foot and a tied neck), so they stand off the bed.
  const crate = (x0: number, y0: number, z0: number, s: number) =>
    box(x0, y0, z0, x0 + s, y0 + s, z0 + s, (x, y, z) => ([x === x0 || x === x0 + s, y === y0 || y === y0 + s, z === z0 || z === z0 + s].filter(Boolean).length >= 2 ? C.crateDark : C.wood));
  const sack = (cx: number, y0: number, cz: number, rx: number, ry: number, rz: number) => {
    for (let x = cx - rx; x <= cx + rx; x++) for (let z = cz - rz; z <= cz + rz; z++) for (let y = y0; y <= y0 + ry; y++) {
      if (((x - cx) / (rx + 0.4)) ** 2 + ((y - y0) / (ry + 0.6)) ** 2 + ((z - cz) / (rz + 0.4)) ** 2 > 1) continue;
      put(x, y, z, y === y0 ? C.sackDark : C.sack);
    }
    box(cx, y0 + ry, cz, cx + 1, y0 + ry + 1, cz, C.sackDark); // its neck, tied
  };
  crate(9, bedY(11) + 1, 9, 7); // aboard, at the back
  sack(24, bedY(11) + 1, 11, 4, 5, 3); // and two sacks before it
  sack(31, bedY(14) + 1, 13, 3, 4, 3);
  crate(0, 0, 15, 6); // fallen off behind
  sack(43, 0, 21, 5, 3, 2); // and one by the shafts
  wheel(28, 8, 21, 8, [0.3, 1.9]); // the near wheel, off: leant against the side, a third of its rim broken away
  foot(g, 90);
  return g;
}

// A dead tree: a bare trunk, silver-grey, tapering to a broken top, a few bare limbs reaching up from it, its bark
// peeled in darker patches, moss at its root flare.
function snag(v: number): VoxelGrid {
  const g = createGrid(sceneryGrid('snag'));
  const m = Math.floor((T + 10) / 2);
  const high = 40 + v * 3;
  const wood = (x: number, y: number, z: number) => (n(x, Math.floor(y / 3), z, 101 + v) < 0.2 ? C.deadDark : (x + z) % 2 && y % 5 === 0 ? C.deadLight : C.dead);
  for (let y = 0; y < high; y++) {
    const r = y < 3 ? 2 : y < high * 0.6 ? 1 : y < high - 3 ? 1 : 0; // (a flare at its foot; thinner up it)
    const lean = Math.round((y / high) * (v % 2 ? 2 : -1));
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
      setColor(g, m + dx + lean, y, m + dz, y < 2 && n(dx, y, dz, 103) < 0.4 ? C.moss : wood(dx, y, dz));
    }
  }
  setColor(g, m + (v % 2 ? 2 : -1), high, m, C.deadLight); // (its broken top, splintered)
  // Bare limbs, two thick, reaching up and out, each with a twig off it.
  const limbs: Array<[number, number, number, number]> = [[18, 1, 0, 9], [26, -1, 1, 8], [32, 0, -1, 7], [24 + v, 1, 1, 6]];
  for (const [y0, dx, dz, long] of limbs.slice(0, 2 + (v % 3))) {
    const from: [number, number, number] = [m, y0, m];
    const to: [number, number, number] = [m + dx * long, y0 + long, m + (dz || (dx ? 0 : 1)) * long];
    voxelLine(g, from, to, C.dead);
    voxelLine(g, [from[0], from[1] + 1, from[2]], [to[0], to[1] + 1, to[2]], C.deadDark);
    voxelLine(g, to, [to[0] + dx * 2, to[1] + 4, to[2] - dz * 2], C.deadLight);
  }
  return g;
}

// A weeping willow: a stout trunk bare for a third of its height, forking into a domed crown, and its fronds hanging
// from all round the crown in curtains of single strands, gaps between them, drawn in toward the trunk as they fall
// and ending raggedly, well short of the ground; two greens, lighter up top.
function willow(v: number): VoxelGrid {
  const g = createGrid(sceneryGrid('willow'));
  const m = Math.floor(WILLOW / 2);
  const lean = v % 2 ? 1 : -1;
  const top = 20; // the trunk's height (of the willow's 60)
  for (let y = 0; y <= top; y++) {
    const o = y > top / 2 ? lean : 0;
    const r = y < 2 ? 3 : 2;
    for (let dx = -r; dx < r; dx++) for (let dz = -r; dz < r; dz++) setColor(g, m + dx + o, y, m + dz, y < 2 || (dx + y) % 5 === 0 ? C.barkDark : C.willowBark);
  }
  for (const [dx, dz] of [[1, 1], [-1, 1], [0, -1]]) voxelLine(g, [m + lean, top, m], [m + lean + dx * 6, top + 8, m + dz * 6], C.willowBark); // its forks
  const [cx, cy, cz] = [m + lean, 33, m];
  const [rx, ry] = [13 + (v % 2), 10];
  // The crown: a dome (its underside cut flat-ish, where the fronds hang from).
  for (let x = 0; x < WILLOW; x++) for (let z = 0; z < WILLOW; z++) for (let y = cy - 4; y < cy + ry; y++) {
    const d = ((x - cx) / rx) ** 2 + (Math.max(0, y - cy) / ry) ** 2 + ((z - cz) / rx) ** 2;
    if (d > 1 - n(x, Math.floor(y / 2), z, 111 + v) * 0.12) continue;
    setColor(g, x, y, z, y > cy + 4 ? C.willowLight : y > cy - 2 ? C.willow : C.willowDark);
  }
  // The fronds: single strands from under the crown's outer part, every other voxel round it, some skipped (the gaps),
  // stepping a voxel in toward the trunk every so often as they fall, each its own length (a ragged hem).
  for (let x = 0; x < WILLOW; x += 2) for (let z = (x / 2) % 2; z < WILLOW; z += 2) {
    const d = Math.hypot((x - cx) / rx, (z - cz) / rx);
    if (d < 0.55 || d > 0.98 || n(x, 0, z, 113 + v) < 0.35) continue;
    const length = 10 + Math.floor(n(x, 1, z, 114 + v) * 14);
    const [ix, iz] = [Math.sign(cx - x), Math.sign(cz - z)];
    const colour = n(x, 2, z, 115) < 0.5 ? C.willow : C.willowDark;
    for (let k = 0; k < length; k++) {
      const inward = Math.floor(k / 9);
      setColor(g, x + ix * inward, cy - 5 - k, z + iz * inward, colour);
    }
  }
  return g;
}

// A granite tor: a pile of rounded slabs like stacked pillows, each of its own width, set off the one below and the
// whole leaning, the top one overhanging; loose boulders tumbled at its foot; lichen and a little moss on the shelves.
function tor(v: number): VoxelGrid {
  const g = createGrid(sceneryGrid('tor'));
  const lean = v % 2 ? 1 : -1;
  // Each slab: its middle (x, z), half-widths, height; laid on the one before.
  const slabs: Array<[number, number, number, number, number]> = [
    [24, 26, 15, 12, 8],
    [20 + 3 * lean, 23, 9, 12, 7],
    [27 + 5 * lean, 21 - v, 10, 7, 6],
    [24 + 8 * lean, 25, 13, 8, 5], // the top: wider than the one under it, thrown out further (its overhang)
  ];
  let y0 = 0;
  slabs.slice(0, 3 + (v % 2)).forEach(([cx, cz, rx, rz, high], i) => {
    for (let x = 0; x < 2 * T; x++) for (let z = 0; z < 2 * T; z++) for (let y = y0; y < y0 + high; y++) {
      const t = (y - y0) / (high - 1); // 0 at its foot, 1 at its top: rounded at both, a pillow's
      const squeeze = 1 - 0.35 * (2 * t - 1) ** 4;
      const [ax, az] = [Math.abs(x - cx) / (rx * squeeze), Math.abs(z - cz) / (rz * squeeze)];
      if (ax ** 3 + az ** 3 > 1 - n(x, y, z, 121 + i) * 0.1) continue;
      const seam = y === y0 && n(x, 0, z, 122 + i) < 0.6; // (the dark between two slabs)
      setColor(g, x, y, z, seam && i > 0 ? C.stoneDeep : stoneAt(x, y, z, y0 + high, y === y0 + high - 1 && n(x, y, z, 123) < 0.25, 124 + v));
    }
    y0 += high - 1;
  });
  // Loose boulders at its foot.
  for (const [bx, bz, r] of [[8, 40, 4], [42, 12, 3], [40, 41, 3]]) lump(g, bx + v, bz, r, r * 0.9, r, 0, 131 + bx);
  foot(g, 125 + v);
  return g;
}

const BUILD: Record<SceneryKind, (v: number) => VoxelGrid> = { boulder, outcrop, log, cairn, wall, menhir, wagon, snag, willow, tor };
export const buildScenery = (kind: SceneryKind, variant: number): VoxelGrid => BUILD[kind](variant);

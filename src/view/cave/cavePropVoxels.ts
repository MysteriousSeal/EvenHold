// What's in a cave, in voxels (model/caves/caveProps.ts), grid-aligned, each
// in four looks (its variant), centred on its tile, its floor at y 0. Those
// that hug the rock (glowcaps, roots, webs) are built with the rock at their
// -Z side (v 0): turned to it as they're set down (caveView.ts).
// - a stalagmite: a lumpy cone of the rock in tapering rings, a wet mineral
//   tip, a smaller one or two beside it;
// - glowcaps: a clutch of pale-stemmed mushrooms by the rock, their caps
//   glowing teal, spotted lighter;
// - a pool: still dark water in a ragged rim of stones, glints on it;
// - roots: hanging down the rock face from above, wandering, frayed at the ends;
// - bones: what's left of some beast: a ribcage, a long bone, its skull;
// - a web: strung in the corner of the rock and the floor, spokes and a spiral;
// - a crystal: a cluster of prisms leaning out of a rocky foot, glowing;
// - an egg sac: eggs heaped together, bound in silk, the young stirring in them;
// - silk: a mat of it over the nest's floor, threads running out of it.

import { createGrid, setColor, voxelLine } from '../meshes/voxel/voxelShapes';
import type { VoxelGrid } from '../meshes/voxel/greedyMesh';
import { hashUnit, mulberry32 } from '../../util/random';
import { C, TALL, TILE } from './cavePalette';

type Paint = (g: VoxelGrid, rng: () => number, variant: number) => void;
const set = (g: VoxelGrid, x: number, y: number, z: number, c: number) => {
  if (x >= 0 && y >= 0 && z >= 0 && x < g.size[0] && y < g.size[1] && z < g.size[2]) setColor(g, x, y, z, c);
};
const MID = (TILE - 1) / 2;

// A lumpy cone of rock at (cx, cz), `r` across its foot, `high` tall.
function cone(g: VoxelGrid, cx: number, cz: number, r: number, high: number, seed: number): void {
  for (let y = 0; y < high; y++) {
    const ring = r * (1 - y / high) ** 0.85 + (y % 4 === 1 ? 0.6 : 0); // (tapering, in lumpy rings)
    for (let x = Math.floor(cx - ring); x <= Math.ceil(cx + ring); x++) for (let z = Math.floor(cz - ring); z <= Math.ceil(cz + ring); z++) {
      if (Math.hypot(x - cx, z - cz) > ring + 0.3) continue;
      const tone = hashUnit(x + y * 3, z, seed);
      set(g, x, y, z, y >= high - 3 ? C.drip : y < 2 ? C.rockDark : (x + z + y) % 7 === 0 ? C.wet : tone < 0.3 ? C.rockDark : tone > 0.75 ? C.rockLight : C.rock);
    }
  }
}

const stalagmite: Paint = (g, rng, variant) => {
  cone(g, MID + (rng() - 0.5) * 3, MID + (rng() - 0.5) * 3, 4.5 + rng() * 1.5, 18 + variant * 3 + Math.floor(rng() * 4), 701 + variant);
  for (let i = 0; i < 1 + (variant % 2); i++) {
    const a = rng() * Math.PI * 2;
    cone(g, MID + Math.cos(a) * 7, MID + Math.sin(a) * 7, 2 + rng(), 6 + Math.floor(rng() * 6), 702 + i);
  }
};

const glowcap: Paint = (g, rng) => {
  const n = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) {
    const [x, z] = [Math.round(4 + rng() * 16), Math.round(1 + rng() * 6)]; // (by the rock)
    const high = 2 + Math.floor(rng() * 5);
    const r = high > 4 ? 2.4 : 1.5;
    for (let y = 0; y < high; y++) set(g, x, y, z, C.stem);
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > r) continue;
      set(g, x + dx, high, z + dz, (dx * 3 + dz) % 4 === 0 && d > 0.8 ? C.glowcapLight : C.glowcap);
      if (d < r - 1) set(g, x + dx, high + 1, z + dz, C.glowcap); // (domed)
    }
  }
};

const pool: Paint = (g, _rng, variant) => {
  for (let x = 0; x < TILE; x++) for (let z = 0; z < TILE; z++) {
    const r = Math.hypot((x - MID) / 1.1, z - MID) + (hashUnit(x, z, 720 + variant) - 0.5) * 2.4;
    if (r > 10) continue;
    if (r > 8.4) {
      set(g, x, 0, z, hashUnit(z, x, 721) < 0.5 ? C.pebble : C.pebbleDark); // its rim of stones
      if (hashUnit(x, z, 722) < 0.3) set(g, x, 1, z, C.pebble);
    } else set(g, x, 0, z, hashUnit(x * 5, z * 3, 723 + variant) < 0.04 ? C.glint : r < 5 ? C.waterDeep : C.water);
  }
};

const roots: Paint = (g, rng) => {
  const strands = 4 + Math.floor(rng() * 4);
  for (let i = 0; i < strands; i++) {
    let x = 3 + Math.floor(rng() * 19);
    let z = Math.floor(rng() * 3);
    const end = 8 + Math.floor(rng() * 14);
    for (let y = TALL - 1; y >= end; y--) {
      set(g, x, y, z, (y + i) % 6 === 0 ? C.rootLight : C.root);
      if (rng() < 0.18) x += rng() < 0.5 ? -1 : 1; // (wandering)
      if (rng() < 0.1) z = Math.min(4, Math.max(0, z + (rng() < 0.6 ? 1 : -1)));
    }
    set(g, x - 1, end - 1, z, C.rootLight); // (frayed at the end)
    set(g, x + 1, end - 1, z, C.rootLight);
  }
};

const bones: Paint = (g, rng, variant) => {
  // A ribcage: ribs arching over a spine, across the tile, turned by the variant.
  const along = variant % 2 === 0;
  const put = (a: number, y: number, b: number, c: number) => (along ? set(g, a, y, b, c) : set(g, b, y, a, c));
  for (let a = 5; a <= 17; a++) put(a, 0, 11, C.boneShade); // the spine
  for (let a = 6; a <= 16; a += 2) for (let k = -4; k <= 4; k++) {
    const y = Math.round(Math.sqrt(Math.max(0, 16 - k * k)) * 0.8);
    if (Math.abs(k) >= 1) put(a, y, 11 + k, Math.abs(k) === 4 ? C.boneShade : C.bone);
  }
  // Its skull, by the spine's end: a block of bone, its socket dark, a jaw; a long bone flung aside.
  for (let a = 18; a <= 21; a++) for (let y = 0; y <= 2; y++) for (let b = 9; b <= 13; b++) put(a, y, b, y === 0 ? C.boneShade : C.bone);
  put(21, 1, 10, C.socket);
  put(21, 1, 12, C.socket);
  const [la, lb] = [2 + Math.floor(rng() * 4), 18 + Math.floor(rng() * 3)];
  for (let k = 0; k < 7; k++) put(la + k, 0, lb, k === 0 || k === 6 ? C.boneShade : C.bone);
};

const web: Paint = (g, rng, variant) => {
  // Strung in the corner of the rock (-Z) and the floor: spokes out from a hub, a spiral round them.
  const hub: [number, number, number] = [MID + Math.round((rng() - 0.5) * 6), 12 + (variant % 3) * 2, 4];
  const ends: Array<[number, number, number]> = [[1, TALL - 2, 0], [TILE - 2, TALL - 2, 0], [0, 15, 0], [TILE - 1, 14, 0], [2, 0, 11], [TILE - 3, 0, 12], [MID, 0, 15]];
  for (const end of ends) voxelLine(g, hub, end, C.silk);
  for (const f of [0.3, 0.55, 0.8]) {
    const ring = ends.map((e) => e.map((c, i) => Math.round(hub[i] + (c - hub[i]) * f)) as [number, number, number]);
    ring.forEach((p, i) => i > 0 && voxelLine(g, ring[i - 1], p, f > 0.7 ? C.silkShade : C.silk));
  }
};

const crystal: Paint = (g, rng, variant) => {
  // A rocky foot, prisms leaning out of it (each a cross of voxels, stepping over as it rises, pointed).
  for (let x = 7; x <= 17; x++) for (let z = 7; z <= 17; z++) if (Math.hypot(x - MID, z - MID) < 5.5) set(g, x, 0, z, hashUnit(x, z, 740) < 0.5 ? C.rockDark : C.rock);
  const n = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const [lx, lz] = [Math.round((rng() - 0.5) * 2), Math.round((rng() - 0.5) * 2)]; // which way it leans
    let [x, z] = [Math.round(MID + (rng() - 0.5) * 7), Math.round(MID + (rng() - 0.5) * 7)];
    const high = 8 + Math.floor(rng() * 10) + variant;
    for (let y = 1; y <= high; y++) {
      if (y % 4 === 0) [x, z] = [x + lx, z + lz];
      const tip = y > high - 2;
      set(g, x, y, z, y % 3 === 0 ? C.crystalCore : C.crystal);
      if (!tip) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) set(g, x + dx, y, z + dz, C.crystal);
    }
  }
};

const eggSac: Paint = (g, rng) => {
  // Eggs heaped, three to five, round, veined; one or two with the young stirring in them (a glow); silk binding them.
  const n = 3 + Math.floor(rng() * 3);
  const eggs: Array<[number, number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng();
    const r = 3 + rng() * 1.2;
    eggs.push([MID + Math.cos(a) * (i === 0 ? 0 : 4.5), r - 0.5 + (i === 0 ? 3 : 0), MID + Math.sin(a) * (i === 0 ? 0 : 4.5), r]);
  }
  eggs.forEach(([cx, cy, cz, r], i) => {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.ceil(cy + r); y++) for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
      const d = Math.hypot(x - cx, (y - cy) * 1.15, z - cz);
      if (d > r) continue;
      set(g, x, y, z, i < 2 && d > r - 1 && (x + y + z) % 5 === 0 && y > cy ? C.stir : (x * 2 + y + z) % 6 === 0 ? C.eggVein : C.egg);
    }
  });
  for (let k = 0; k < 5; k++) {
    const [a, b] = [eggs[Math.floor(rng() * n)], eggs[Math.floor(rng() * n)]];
    voxelLine(g, [Math.round(a[0]), Math.round(a[1] + a[3] - 1), Math.round(a[2])], [Math.round(b[0] + (rng() - 0.5) * 4), 0, Math.round(b[2] + (rng() - 0.5) * 4)], C.silk);
  }
  for (let x = 2; x < TILE - 2; x++) for (let z = 2; z < TILE - 2; z++) if (Math.hypot(x - MID, z - MID) < 10 && hashUnit(x, z, 750) < 0.5) set(g, x, 0, z, C.silkShade);
};

const silk: Paint = (g, _rng, variant) => {
  for (let x = 0; x < TILE; x++) for (let z = 0; z < TILE; z++) {
    const patch = hashUnit(Math.floor(x / 3), Math.floor(z / 3), 760 + variant);
    const thread = (x + variant) % 6 === 0 || (z + variant * 2) % 7 === 0;
    if (patch < 0.72 || thread) set(g, x, 0, z, thread ? C.silk : patch < 0.3 ? C.silkShade : C.silk);
    if (patch > 0.9 && !thread) set(g, x, 1, z, C.silkShade); // (bunched up)
  }
};

export const PAINTERS = { stalagmite, glowcap, pool, roots, bones, web, crystal, eggSac, silk };
export const PROP_HIGH = { stalagmite: 32, glowcap: 10, pool: 2, roots: TALL, bones: 4, web: TALL, crystal: 24, eggSac: 12, silk: 2 }; // each grid's height

// A prop's voxels, by kind and variant (0..3): the same every time.
export function paintProp(kind: keyof typeof PAINTERS, variant: number): VoxelGrid {
  const g = createGrid([TILE, PROP_HIGH[kind], TILE]);
  PAINTERS[kind](g, mulberry32(7000 + variant * 97 + kind.length * 13), variant);
  return g;
}

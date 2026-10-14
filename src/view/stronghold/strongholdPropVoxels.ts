// What's in a bandit stronghold, in voxels, by id (STRONGHOLD_PROPS: each its footprint in tiles, its grid, the one
// palette they share: strongholdLook.ts), at the rooms' 0.04, 25 voxels to a tile. Each is built facing local +Z,
// centred on its tiles, its foot at y 0; silhouette first, a few of the palette's colours each. Here:
// - a barricade (two tiles across): a log across the way, sharpened stakes crossed through it, pointing both ways;
// - a tent (two tiles by two): canvas over a ridge pole, its front open and dark within, its flaps tied back, guy
//   ropes pegged out, a red patch sewn on;
// - a bedroll: a blanket over straw, a rolled sack for a pillow;
// - a weapon rack: two uprights and two rails, a spear, an axe and a sword stood in it, a round shield hung on it;
// - a crate: planks in a frame, braced corner to corner, a rope handle;
// - a barrel: staves bulging at the middle, two iron hoops, its head set in;
// - a powder keg: small, tarred black, its hoops and the cross on its head the bandits' red, a fuse out of its bung;
// - a cage: iron bars on a plank floor, a ring on its roof to hoist it by, straw and a bone in it;
// - a kennel: a plank doghouse under a pitched roof, its door a dark arch, a chain from a stake, a bowl.
// The rest (what furnishes it: a brazier, a banner, its gate, its king's throne and chest), and the tools they're all
// painted with: strongholdFurnishingVoxels.ts.
import type { VoxelGrid } from '../meshes/voxel/greedyMesh';
import { createGrid } from '../meshes/voxel/voxelShapes';
import { hashUnit } from '../../util/random';
import { C, STRONGHOLD_PALETTE, TALL, TILE } from './strongholdLook';
import { MID, banner, bench, box, brazier, chest, drum, dummy, gate, line, planks, put, stocks, table, throne, type Paint } from './strongholdFurnishingVoxels';

export { CHEST_OPEN, GATE_OPEN } from './strongholdFurnishingVoxels';

const barricade: Paint = (g) => {
  const w = g.size[0]; // (two tiles across)
  box(g, 0, 5, 11, w - 1, 7, 13, (x, y) => (y === 7 ? C.timberLight : x % 8 === 3 ? C.pitch : C.timber)); // the log
  for (let i = 0; i * 4 + 3 < w; i++) {
    const x = 2 + i * 4;
    const forward = i % 2 === 0;
    const [foot, tip]: Array<[number, number, number]> = [[x, 0, forward ? 4 : 20], [x, 14, forward ? 21 : 3]];
    line(g, foot, tip, C.timberDark);
    line(g, [x + 1, 0, foot[2]], [x + 1, 14, tip[2]], C.timber);
    for (const dx of [0, 1]) put(g, x + dx, 14, tip[2], C.timberLight); // (sharpened)
  }
  for (const x of [1, w - 3]) box(g, x, 0, 10, x + 1, 4, 14, C.stoneDark); // a stone under each end
};

const tent: Paint = (g) => {
  const [mid, ridge, front, back] = [24.5, 22, 42, 7];
  for (let z = back; z <= front; z++) {
    for (let x = 6; x <= 43; x++) {
      const top = Math.round(ridge - Math.abs(x - mid) * 1.2); // its slope, either side of the ridge
      if (top < 0) continue;
      const within = z > back && z < front;
      for (let y = 0; y <= top; y++) {
        const skin = y >= top - 1;
        if (within && !skin) continue; // (hollow)
        const door = z === front && Math.abs(x - mid) < 7 - y * 0.45; // its way in: open, dark
        const patch = skin && x >= 30 && x <= 34 && z >= 20 && z <= 26;
        put(g, x, y, z, door ? C.pitch : patch ? C.red : skin ? (z % 9 === 4 ? C.canvasShade : C.canvas) : C.canvasShade);
      }
    }
  }
  box(g, 24, ridge, back - 3, 25, ridge + 1, front + 3, C.timberDark); // the ridge pole, out past both ends
  for (const z of [back - 2, front + 2]) box(g, 24, 0, z, 25, ridge - 1, z, C.timber); // its poles
  for (const [x, z] of [[2, 12], [2, 37], [47, 12], [47, 37]]) {
    line(g, [x < 24 ? 12 : 37, 9, z], [x, 1, z], C.rope); // a guy rope, pegged
    put(g, x, 0, z, C.timberDark);
  }
};

const bedroll: Paint = (g) => {
  box(g, 7, 0, 3, 17, 0, 22, (x, _y, z) => (hashUnit(x, z, 590) < 0.5 ? C.straw : C.rope)); // the straw under it
  box(g, 8, 1, 4, 16, 1, 17, (x, _y, z) => (z === 17 ? C.canvas : z % 5 === 0 ? C.redDark : x === 8 || x === 16 ? C.redDark : C.red)); // the blanket, turned down
  box(g, 8, 1, 18, 16, 2, 21, (_x, y, z) => (y === 2 && (z === 18 || z === 21) ? 0 : z === 19 ? C.canvasShade : C.canvas)); // the pillow
};

const rack: Paint = (g) => {
  for (const x of [2, 21]) {
    box(g, x, 0, 11, x + 1, 16, 12, (_x, y) => (y === 16 ? C.timberLight : C.timberDark));
    box(g, x, 0, 8, x + 1, 0, 15, C.timberDark); // its feet
  }
  for (const y of [5, 13]) box(g, 2, y, 11, 22, y, 12, C.timber);
  box(g, 6, 1, 13, 6, 24, 13, (_x, y) => (y >= 22 ? C.ironLight : y === 21 ? C.iron : C.timberLight)); // a spear
  box(g, 10, 1, 13, 10, 17, 13, C.timberLight); // an axe
  box(g, 11, 14, 13, 13, 18, 13, (x, y) => (x === 13 ? C.ironLight : y === 14 || y === 18 ? 0 : C.iron));
  box(g, 14, 1, 13, 14, 18, 13, (_x, y) => (y === 14 ? 0 : y > 14 ? C.timberDark : y === 1 ? C.iron : C.ironLight)); // a sword, point down
  box(g, 13, 14, 13, 15, 14, 13, C.gold);
  for (let x = 15; x <= 21; x++) for (let y = 6; y <= 12; y++) {
    const out = Math.hypot(x - 18, y - 9); // a round shield, hung
    if (out <= 3.3) put(g, x, y, 13, out < 1 ? C.gold : out > 2.4 ? C.redDark : C.red);
  }
};

const crate: Paint = (g, variant) => {
  const [a, b, top] = [6, 18, 10];
  box(g, a, 0, a, b, top, b, (x, y, z) => {
    const edges = [x === a || x === b, y === 0 || y === top, z === a || z === b].filter(Boolean).length;
    if (edges >= 2) return C.timberDark; // its frame
    const [u, v] = x === a || x === b ? [z, y] : z === a || z === b ? [x, y] : [x, z];
    if (y !== top && Math.abs(u - a - (v + 1)) <= 0) return C.timberDark; // braced corner to corner
    return planks(y === top ? x : v, 3, 6 + variant);
  });
  box(g, a + 1, 1, a + 1, b - 1, top - 1, b - 1, 0);
  for (const x of [10, 14]) put(g, x, 7, b + 1, C.rope); // a rope handle
  box(g, 10, 6, b + 1, 14, 6, b + 1, C.rope);
};

const barrel: Paint = (g) => {
  drum(g, MID, MID, 0, 11, (y) => (y >= 3 && y <= 8 ? 5.3 : 4.5), (y, stave, out) => (y === 2 || y === 9 ? C.iron : y === 11 && out > 1 ? 0 : stave % 3 === 0 ? C.timberDark : stave % 3 === 1 ? C.timber : C.timberLight));
  drum(g, MID, MID, 10, 10, () => 3.4, () => C.timberLight); // its head, set in
  put(g, MID, 11, MID + 2, C.pitch); // the bung
};

const keg: Paint = (g) => {
  drum(g, MID, MID, 0, 8, (y) => (y >= 2 && y <= 6 ? 4.2 : 3.5), (y, stave) => (y === 1 || y === 7 ? C.red : stave % 2 ? C.pitch : C.timberDark));
  drum(g, MID, MID, 8, 8, () => 3.5, () => C.canvasShade); // its head, marked with a cross
  for (let k = -2; k <= 2; k++) for (const [x, z] of [[MID + k, MID + k], [MID + k, MID - k]]) put(g, x, 8, z, C.red);
  for (const [x, y, z] of [[MID, 9, MID + 3], [MID, 10, MID + 4], [MID + 1, 10, MID + 5]]) put(g, x, y, z, C.rope); // its fuse
};

const cage: Paint = (g) => {
  const [a, b, top] = [3, 21, 22];
  box(g, a, 0, a, b, 1, b, (x, y) => (y === 0 ? C.timberDark : planks(x, 4, 7)));
  for (let k = a; k <= b; k += 3) for (let y = 2; y < top; y++) for (const [x, z] of [[k, a], [k, b], [a, k], [b, k]]) put(g, x, y, z, y % 7 === 4 ? C.ironLight : C.iron); // its bars
  box(g, a, top, a, b, top, b, (x, _y, z) => (x === a || x === b || z === a || z === b ? C.iron : (x - a) % 3 === 0 ? C.iron : 0)); // its roof, barred
  box(g, a, 11, a, b, 11, b, (x, _y, z) => (x === a || x === b || z === a || z === b ? C.iron : 0)); // a band round its middle
  for (const y of [23, 24, 25]) for (const x of [11, 13]) put(g, y === 25 ? 12 : x, y, 12, C.ironLight); // the ring it's hoisted by
  box(g, 14, 9, b + 1, 15, 12, b + 1, C.gold); // its lock
  for (let x = 5; x <= 19; x++) for (let z = 5; z <= 19; z++) if (hashUnit(x, z, 592) < 0.3) put(g, x, 2, z, C.straw);
  box(g, 8, 2, 14, 13, 2, 14, C.bone);
  for (const x of [7, 14]) for (const z of [13, 15]) put(g, x, 2, z, C.bone);
};

const kennel: Paint = (g) => {
  const [x0, x1, z0, z1, eave, mid] = [3, 21, 1, 18, 10, 12];
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const gable = eave + Math.max(0, 8 - Math.abs(x - mid)); // its pitched roof's line
    const wall = x === x0 || x === x1 || z === z0 || z === z1;
    for (let y = 0; y <= gable; y++) {
      const door = z === z1 && Math.abs(x - mid) <= 4 && y <= 9 - (Math.abs(x - mid) === 4 ? 2 : 0);
      if (y >= gable - 1 && y >= eave) put(g, x, y + 1, z, z % 4 === 1 ? C.pitch : C.timberDark); // the roof's boards
      if (wall && y < gable) put(g, x, y, z, door ? C.pitch : planks(y, 2, 8));
    }
  }
  for (let z = z0 - 1; z <= z1 + 1; z++) for (const x of [x0 - 1, x1 + 1]) put(g, x, eave, z, C.timberDark); // its eaves
  box(g, 22, 0, 22, 22, 4, 22, C.timberDark); // a stake, a chain run from it into the door
  line(g, [22, 3, 22], [14, 0, 19], C.iron);
  drum(g, 5, 22, 0, 1, () => 2.4, (y, _stave, out) => (y === 1 && out > 1 ? C.bone : C.stoneDark)); // a bowl, a bone in it
};

export const STRONGHOLD_PROP_IDS = ['barricade', 'tent', 'bedroll', 'rack', 'crate', 'barrel', 'keg', 'cage', 'kennel', 'brazier', 'banner', 'table', 'bench', 'throne', 'dummy', 'stocks', 'gate', 'chest'] as const;
export type StrongholdPropId = (typeof STRONGHOLD_PROP_IDS)[number];

export interface StrongholdProp {
  footprint: [wide: number, deep: number]; // in tiles, as built (wide along x)
  size: [number, number, number]; // its grid, in voxels (centred on its tiles; a gate's deeper than them, for its open leaves)
  palette: number[]; // the stronghold's own, shared
  looks: number; // how many looks it has (its variant: 0 .. looks - 1)
  light?: { y: number; strength: number }; // if it gives light: how high its flame is (world units), how strong
  build(variant?: number): VoxelGrid;
}

const prop = (paint: Paint, high: number, footprint: [number, number] = [1, 1], more: Partial<Pick<StrongholdProp, 'looks' | 'light'>> & { deep?: number } = {}): StrongholdProp => {
  const size: [number, number, number] = [footprint[0] * TILE, high, more.deep ?? footprint[1] * TILE];
  return {
    footprint,
    size,
    palette: STRONGHOLD_PALETTE,
    looks: more.looks ?? 1,
    light: more.light,
    build: (variant = 0) => {
      const g = createGrid(size);
      paint(g, variant);
      return g;
    },
  };
};

// Every prop, by id. A gate's and a chest's second look: open (GATE_OPEN, CHEST_OPEN). A crate's two: its planks.
export const STRONGHOLD_PROPS: Record<StrongholdPropId, StrongholdProp> = {
  barricade: prop(barricade, 15, [2, 1]),
  tent: prop(tent, 24, [2, 2]),
  bedroll: prop(bedroll, 3),
  rack: prop(rack, 25),
  crate: prop(crate, 11, [1, 1], { looks: 2 }),
  barrel: prop(barrel, 12),
  keg: prop(keg, 11),
  cage: prop(cage, 26),
  kennel: prop(kennel, 21),
  brazier: prop(brazier, 17, [1, 1], { light: { y: 0.55, strength: 2.6 } }),
  banner: prop(banner, 33),
  table: prop(table, 12, [2, 1]),
  bench: prop(bench, 5, [2, 1]),
  throne: prop(throne, 31, [2, 2]),
  dummy: prop(dummy, 20),
  stocks: prop(stocks, 19),
  gate: prop(gate, TALL, [2, 1], { looks: 2, deep: 45 }),
  chest: prop(chest, 16, [1, 1], { looks: 2 }),
};

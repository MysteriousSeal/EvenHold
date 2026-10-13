// More of what's in a bandit stronghold, in voxels (strongholdPropVoxels.ts the table of them all, and the rest),
// and the few tools they're all painted with. Each is built facing local +Z, centred on its tiles, its foot at y 0,
// in the stronghold's one palette (strongholdLook.ts):
// - a brazier: an iron basket on three splayed legs, coals in it, flames over them (its light);
// - a banner: a tall pole in a stone footing, a crossbar, the bandits' red hung from it, crossed knives on it in bone,
//   its foot cut to two tails;
// - a table: a long trestle table, two tiles of it: a map pinned by a dagger, a jug, a loaf, a spill of coins;
// - a bench (two tiles long): a plank on three pairs of legs, braced;
// - a throne (two tiles by two): on two stone steps, a heavy chair of timber, its back as high as a wall's rail, a red cloth down it, a
//   hide over its seat, knife blades fanned along its top (as its king's crown is);
// - a training dummy: a post on crossed feet, a sack of straw for a body with a red mark to hit, a crossbar for
//   arms, a sack for a head, straw leaking;
// - stocks: two posts, two boards shut on each other, three holes through them, an iron hasp;
// - a gate (two tiles wide): posts either side as high as the walls, a lintel over, two leaves of upright planks
//   banded and studded in iron; shut, a bar across them; open, each leaf swung forward against its own post;
// - a chest: planks bound in iron, a gold lock; open, its lid stood back and gold heaped in it.
import type { VoxelGrid } from '../meshes/voxel/greedyMesh';
import { fillBox, setColor, voxelLine } from '../meshes/voxel/voxelShapes';
import { hashUnit } from '../../util/random';
import { C, TALL, TILE } from './strongholdLook';

export type Paint = (g: VoxelGrid, variant: number) => void;
type Tint = number | ((x: number, y: number, z: number) => number);
export const MID = (TILE - 1) / 2; // a one-tile piece's middle

// One voxel, if it's within the grid.
export const put = (g: VoxelGrid, x: number, y: number, z: number, c: number): void => {
  if (x >= 0 && y >= 0 && z >= 0 && x < g.size[0] && y < g.size[1] && z < g.size[2]) setColor(g, x, y, z, c);
};
export const box = (g: VoxelGrid, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: Tint): void => fillBox(g, x0, y0, z0, x1, y1, z1, c);
export const line = voxelLine;
// A drum stood on end at (cx, cz): rows y0..y1, each `r(y)` across; `skin` picks a voxel's colour from where it is
// and which of twelve staves round it it's on.
export function drum(g: VoxelGrid, cx: number, cz: number, y0: number, y1: number, r: (y: number) => number, skin: (y: number, stave: number, out: number) => number): void {
  for (let y = y0; y <= y1; y++) {
    const ring = r(y);
    for (let x = Math.floor(cx - ring); x <= Math.ceil(cx + ring); x++) for (let z = Math.floor(cz - ring); z <= Math.ceil(cz + ring); z++) {
      const out = Math.hypot(x - cx, z - cz);
      if (out > ring) continue;
      const color = skin(y, Math.floor(((Math.atan2(z - cz, x - cx) + Math.PI) / (Math.PI * 2)) * 12) % 12, ring - out);
      if (color) put(g, x, y, z, color);
    }
  }
}
// Planks: one tone or the other by which plank (every `wide` voxels along `a`).
export const planks = (a: number, wide: number, salt: number): number => (hashUnit(Math.floor(a / wide), salt, 580) < 0.5 ? C.timber : C.timberLight);

export const brazier: Paint = (g) => {
  for (const [dx, dz] of [[0, -1], [-1, 0.6], [1, 0.6]]) line(g, [Math.round(MID + dx * 6), 0, Math.round(MID + dz * 6)], [Math.round(MID + dx * 3), 7, Math.round(MID + dz * 3)], C.iron);
  drum(g, MID, MID, 7, 10, (y) => 2.6 + (y - 7) * 0.9, (y, stave, out) => (out > 1.2 && y > 7 ? (y === 10 ? C.ember : 0) : y === 10 ? C.ironLight : stave % 2 ? C.iron : C.pitch)); // the basket, barred, coals to its brim
  drum(g, MID, MID, 11, 12, (y) => 3.2 - (y - 11) * 0.8, (_y, stave) => (stave % 3 === 0 ? C.core : C.flame));
  for (const [x, z, top] of [[MID, MID, 16], [MID - 2, MID + 1, 14], [MID + 1, MID - 2, 15]]) for (let y = 13; y <= top; y++) put(g, x, y, z, y === top ? C.ember : y >= top - 1 ? C.flame : C.core); // its tongues
};

export const banner: Paint = (g) => {
  drum(g, MID, 8, 0, 1, (y) => 3.5 - y, (_y, stave) => (stave % 2 ? C.stone : C.stoneDark)); // its footing
  box(g, 12, 2, 8, 12, 31, 8, (_x, y) => (y % 7 === 3 ? C.timberDark : C.timber));
  box(g, 5, 29, 8, 19, 29, 8, C.timberDark); // the crossbar
  put(g, 12, 32, 8, C.ironLight);
  for (let x = 6; x <= 18; x++) for (let y = 9; y <= 28; y++) {
    if (y < 12 && Math.abs(x - 12) < 12 - y) continue; // its foot, cut to two tails
    const mark = y >= 16 && y <= 24 && (Math.abs(x - 12) === Math.abs(y - 20) || (y === 24 && Math.abs(x - 12) >= 3 && Math.abs(x - 12) <= 5)); // crossed knives, their hilts above
    put(g, x, y, 9, mark ? C.bone : x === 6 || x === 18 || y === 28 ? C.redDark : C.red);
  }
};

export const table: Paint = (g) => {
  box(g, 4, 6, 5, 45, 7, 19, (x, y, z) => (y === 6 ? C.timberDark : z % 5 === 4 ? C.timberDark : planks(z, 5, x > 24 ? 1 : 2))); // its top, three boards
  for (const x of [8, 41]) {
    box(g, x, 0, 7, x + 1, 5, 8, C.timberDark); // a trestle at each end
    box(g, x, 0, 16, x + 1, 5, 17, C.timberDark);
    box(g, x, 3, 9, x + 1, 3, 15, C.timber);
  }
  box(g, 14, 8, 8, 24, 8, 16, (x, _y, z) => (x === 14 || x === 24 ? C.canvasShade : (x + z) % 7 === 0 ? C.red : C.canvas)); // a map, marked
  box(g, 20, 9, 11, 20, 11, 11, (_x, y) => (y === 11 ? C.timberDark : C.ironLight)); // the dagger that pins it
  drum(g, 33, 9, 8, 11, (y) => (y === 11 ? 1 : 1.6), () => C.hide); // a jug
  box(g, 30, 8, 14, 33, 9, 16, (_x, y) => (y === 9 ? C.straw : C.rope)); // a loaf
  for (const [x, z] of [[38, 12], [39, 13], [40, 11], [38, 14], [41, 13]]) put(g, x, 8, z, C.gold);
};

export const bench: Paint = (g) => {
  const w = g.size[0]; // (two tiles long)
  box(g, 3, 4, 9, w - 4, 4, 14, (x, _y, z) => (z === 11 || x === 24 ? C.timberDark : C.timberLight));
  for (const x of [6, 24, w - 7]) {
    box(g, x, 0, 9, x, 3, 10, C.timberDark);
    box(g, x, 0, 13, x, 3, 14, C.timberDark);
  }
  box(g, 7, 2, 11, w - 8, 2, 12, C.timber); // the brace
};

// (Two tiles by two: its steps fill them, the chair at their middle, its back to the far side.)
export const throne: Paint = (g) => {
  const [w, d] = [g.size[0], g.size[2]];
  const stone = (x: number, _y: number, z: number): number => ((x + z * 3) % 7 === 0 ? C.stoneLight : (x * 5 + z) % 11 === 0 ? C.stoneDark : C.stone);
  box(g, 3, 0, 3, w - 4, 1, d - 4, (x, y, z) => (y === 0 ? C.stoneDark : stone(x, y, z))); // two steps
  box(g, 9, 2, 6, w - 10, 3, d - 14, (x, y, z) => (y === 2 ? C.stoneDark : stone(x, y, z)));
  const [ox, oy, oz] = [w / 2 - 12, 2, 6]; // the chair's own corner
  const part = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, tint: (x: number, y: number, z: number) => number) => box(g, x0 + ox, y0 + oy, z0 + oz, x1 + ox, y1 + oy, z1 + oz, (x, y, z) => tint(x - ox, y - oy, z - oz));
  part(5, 2, 5, 19, 6, 17, (x, y) => (y === 6 ? C.timberLight : x === 5 || x === 19 ? C.timberDark : C.timber)); // the seat's block
  part(7, 7, 8, 17, 7, 18, (x, _y, z) => ((x + z) % 4 === 0 ? C.timberLight : C.hide)); // the hide over it, hung over its front
  part(7, 4, 18, 17, 6, 18, () => C.hide);
  for (const x of [4, 19]) part(x, 7, 6, x + 1, 10, 16, (_x, y, z) => (y === 10 ? C.timberLight : z === 16 ? C.timberDark : C.timber)); // its arms
  part(4, 2, 3, 20, 24, 5, (x, y, z) => (x === 4 || x === 20 ? C.timberDark : z === 5 && x >= 9 && x <= 15 ? (y % 6 === 0 ? C.redDark : C.red) : planks(x, 3, 3))); // its back, the cloth down it
  for (let x = 4; x <= 20; x += 2) {
    const tall = 28 - Math.abs(x - 12) / 2; // the blades along its top, the middle one tallest
    for (let y = 25; y <= tall; y++) put(g, x + ox, y + oy, 4 + oz, y <= 26 ? C.iron : C.ironLight);
  }
  for (const x of [4, 20]) put(g, x + ox, 11 + oy, 16 + oz, C.gold); // a boss on each arm's end
};

export const dummy: Paint = (g) => {
  box(g, 5, 0, 12, 19, 0, 12, C.timberDark); // crossed feet
  box(g, 12, 0, 5, 12, 0, 19, C.timberDark);
  box(g, 12, 1, 12, 12, 6, 12, C.timber);
  box(g, 9, 7, 10, 15, 14, 14, (x, y, z) => (z === 14 && Math.abs(x - 12) + Math.abs(y - 11) <= 1 ? C.red : z === 14 && Math.abs(x - 12) + Math.abs(y - 11) === 2 ? C.redDark : y === 7 || y === 14 ? C.rope : (x + y) % 5 === 0 ? C.canvasShade : C.canvas)); // the sack, tied top and bottom, its mark
  box(g, 4, 13, 12, 20, 13, 12, C.timber); // its arms
  for (const x of [4, 20]) put(g, x, 12, 12, C.straw);
  box(g, 10, 15, 10, 14, 18, 14, (x, y) => (y === 15 ? C.rope : (x + y) % 4 === 0 ? C.canvasShade : C.canvas)); // its head
  for (const [x, y, z] of [[8, 8, 13], [16, 9, 11], [11, 6, 14], [13, 19, 12], [14, 6, 10]]) put(g, x, y, z, C.straw);
};

export const stocks: Paint = (g) => {
  box(g, 2, 0, 9, 22, 0, 15, (x) => planks(x, 4, 4)); // the boards they stand on
  for (const x of [3, 20]) box(g, x, 1, 11, x + 1, 18, 13, (_x, y) => (y === 18 ? C.timberLight : C.timberDark));
  box(g, 5, 10, 11, 19, 16, 13, (x, y, z) => {
    if (y === 13 || y === 14) {
      if (Math.abs(x - 12) <= 1 && (y === 14 || x === 12)) return 0; // the neck's hole
      if ((x === 7 || x === 17) && y === 13) return 0; // a wrist's, either side
    }
    return y === 13 ? C.pitch : z === 12 ? C.timber : C.timberLight; // (where the two boards meet: a dark line)
  });
  box(g, 19, 13, 14, 20, 14, 14, C.ironLight); // the hasp
};

export const GATE_OPEN = 1; // the gate's open look (0: shut)
const GATE_AT = 22; // the row its leaves hang on, of its grid's depth
// (Its grid is deeper than its tile: open, its leaves reach 22 voxels forward of it.)
export const gate: Paint = (g, variant) => {
  const [w, z0] = [g.size[0], GATE_AT];
  for (const x of [0, w - 4]) box(g, x, 0, z0 - 2, x + 3, TALL - 1, z0 + 2, (px, y) => (y === TALL - 1 ? C.cap : y < 3 ? C.stoneDark : px === x || px === x + 3 ? C.timberDark : C.timber)); // its posts, footed in stone
  box(g, 0, TALL - 7, z0 - 2, w - 1, TALL - 2, z0 + 2, (_x, y) => (y === TALL - 7 ? C.pitch : y === TALL - 2 ? C.timberLight : C.timberDark)); // the lintel
  box(g, 0, TALL - 1, z0 - 2, w - 1, TALL - 1, z0 + 2, C.cap);
  const leaf = (a: number, y: number): number => (y === 5 || y === 20 ? ((a + 1) % 4 === 0 ? C.ironLight : C.iron) : a % 4 === 3 ? C.timberDark : planks(a, 4, 5)); // planks, two iron bands, studded
  const wide = (w - 8) / 2;
  for (let a = 0; a < wide; a++) for (let y = 1; y <= TALL - 8; y++) {
    if (variant === GATE_OPEN) for (const x of [4, 5]) for (const side of [x, w - 1 - x]) put(g, side, y, z0 + 1 + a, leaf(a, y));
    else for (const z of [z0, z0 + 1]) for (const x of [4 + a, w - 5 - a]) put(g, x, y, z, a === wide - 1 ? C.pitch : leaf(a, y)); // (where the two meet: a dark line)
  }
  if (variant !== GATE_OPEN) {
    box(g, 2, 12, z0 + 2, w - 3, 14, z0 + 2, (_x, y) => (y === 14 ? C.timberLight : C.timber)); // the bar
    for (const x of [8, w - 10]) box(g, x, 11, z0 + 2, x + 1, 15, z0 + 3, (_x, y, z) => (z === z0 + 2 && y >= 12 && y <= 14 ? C.timber : C.iron)); // its brackets
  }
};

export const CHEST_OPEN = 1; // the chest's open look (0: shut)
export const chest: Paint = (g, variant) => {
  const open = variant === CHEST_OPEN;
  const band = (x: number) => x === 7 || x === 17;
  box(g, 5, 0, 8, 19, 6, 17, (x, y, z) => (band(x) ? C.iron : (x === 5 || x === 19) && (z === 8 || z === 17) ? C.ironLight : y % 3 === 2 ? C.timberDark : C.timber));
  box(g, 11, 4, 17, 13, 6, 17, (x, y) => (x === 12 && y === 5 ? C.pitch : C.gold)); // its lock
  if (open) {
    box(g, 6, 3, 9, 18, 6, 16, 0);
    box(g, 6, 3, 9, 18, 5, 16, (x, y, z) => (y - 3 <= 2 * Math.sin(((x - 6) / 12) * Math.PI) * Math.sin(((z - 9) / 7) * Math.PI) ? ((x + z) % 3 === 0 ? C.rope : C.gold) : 0)); // gold, heaped
    box(g, 5, 6, 6, 19, 14, 7, (x, y) => (band(x) ? C.iron : y === 14 ? C.timberLight : y % 3 === 0 ? C.timberDark : C.timber)); // its lid, stood back
  } else {
    for (let z = 8; z <= 17; z++) box(g, 5, 7, z, 19, 7 + Math.round(2.4 - 2.4 * ((z - 12.5) / 4.5) ** 2), z, (x) => (band(x) ? C.iron : C.timberLight)); // its lid, rounded over
    box(g, 5, 7, 17, 19, 7, 17, (x) => (band(x) ? C.iron : x >= 11 && x <= 13 ? C.gold : C.timberDark));
  }
};

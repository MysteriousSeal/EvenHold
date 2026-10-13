// A bandit stronghold's way in, out in the world: a timber gatehouse set into a rock face, over three tiles by three
// (75 x 75 voxels, the ruins' and the cave mouths' 0.04), its gateway in its front (local +Z, toward the spot before
// it). Silhouette first: a crag, steep-faced, highest behind the gate and falling away to either side; let into its
// face, two great posts and a lintel, the gateway between them black within, a portcullis' iron teeth hung in its
// top; over the lintel a boarded hoarding standing out past the posts on braces, slits cut in it, a lean-to roof
// run back to the rock; a palisade of sharpened logs along the rock's foot either side; a torch on each post; and
// over the gateway, hung from the hoarding, the bandits' banner. Palette first: the cave mouths' weathered stone in
// three tones and grass on its tops; timber in three and pitch; iron; the banner's red and the bone of its crossed
// knives; the torches' flame over a pale wick (GATE_GLOW: to be drawn unlit). Sunk into the ground (SINK) so it never floats where
// the hill rises under it.
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, setColor, voxelLine } from '../voxel/voxelShapes';
import { hashUnit, smoothNoise } from '../../../util/random';

export const GATE_VOXEL = 0.04;
export const SINK = 8; // voxels of it below the ground (y SINK the ground's level at the gateway)
const HIGH = 50; // over the ground, at most
export const GATE_GRID: [number, number, number] = [75, SINK + HIGH, 75];

const ENTRIES = {
  rock: 0x7a7068,
  rockDark: 0x5e564f,
  rockLight: 0x948a7f,
  grass: 0x6a8a3a,
  timber: 0x7c5836,
  timberDark: 0x5a3e26,
  timberLight: 0x9c744a,
  pitch: 0x2c211a,
  dark: 0x080605,
  iron: 0x8e949c,
  red: 0xa8322a,
  bone: 0xd9cfb6,
  flame: 0xffb347, // (glow)
} as const;
export const GATE_PALETTE: number[] = Object.values(ENTRIES);
const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;
export const GATE_GLOW: ReadonlySet<number> = new Set([C.flame]); // its torches' flames: drawn unlit

const [W, H, D] = GATE_GRID;
const MID = 37;
const FACE = 50; // the rock's face, at its middle
const HALF = 9; // the gateway's half-width
const ARCH = 22; // its height, to the lintel's underside
const POST = [10, 13]; // each post, across, from the middle
const FRONT = 58; // the posts' front
// Where its torches burn, in world units from its middle on the ground (for whoever lights them).
export const GATE_TORCHES: ReadonlyArray<[x: number, y: number, z: number]> = [-1, 1].map((side) => [side * 12 * GATE_VOXEL, 19 * GATE_VOXEL, (FRONT + 2 - D / 2) * GATE_VOXEL]);

// The rock's face (how far forward it comes) across it, and its height over the ground at a column (0: none).
const faceAt = (u: number): number => FACE - Math.round(((u - MID) / 37) ** 2 * 7) + Math.round((smoothNoise(u, 3, 941, 5) - 0.5) * 5);
function rockHigh(u: number, v: number): number {
  const face = faceAt(u);
  if (v > face) return 0;
  const side = Math.abs(u - MID) / 38;
  const back = v < 12 ? (12 - v) / 12 : 0;
  // Piled, not mounded: slabs of it, each a step of a few voxels, lumpy; its sides and its back steep.
  const slab = Math.floor((30 + smoothNoise(u, v, 942, 11) * 20 - side * 14) / 5) * 5 + smoothNoise(u, v, 949, 4) * 3;
  const high = slab * (1 - side ** 6) * (1 - back ** 4);
  return Math.max(0, Math.round(high - Math.max(0, 2 - (face - v)) * 2)); // (its brow knocked back a little)
}

export function buildStrongholdGate(): VoxelGrid {
  const g = createGrid(GATE_GRID);
  // Over the ground: (u, y, v) with y 0 the ground's level.
  const put = (u: number, y: number, v: number, color: number) => {
    if (u >= 0 && v >= 0 && u < W && v < D && y + SINK >= 0 && y + SINK < H) setColor(g, u, y + SINK, v, color);
  };
  const box = (u0: number, y0: number, v0: number, u1: number, y1: number, v1: number, color: (u: number, y: number, v: number) => number) => {
    for (let u = u0; u <= u1; u++) for (let y = y0; y <= y1; y++) for (let v = v0; v <= v1; v++) put(u, y, v, color(u, y, v));
  };
  const inGateway = (u: number, y: number, v: number) => Math.abs(u - MID) <= HALF && y >= 0 && y < ARCH && v >= FACE - 6;

  // The crag: stone in three tones, banded; grass over its tops where they aren't steep; the gateway cut into it.
  for (let u = 0; u < W; u++) for (let v = 0; v < D; v++) {
    const top = rockHigh(u, v);
    if (top <= 0) continue;
    const steep = Math.abs(rockHigh(u + 1, v) - rockHigh(u - 1, v)) + Math.abs(rockHigh(u, v + 1) - rockHigh(u, v - 1)) > 5;
    for (let y = -SINK; y < top; y++) {
      if (inGateway(u, y, v)) continue;
      const tone = smoothNoise(u + y * 0.5, v - y * 0.5, 943, 4);
      const band = (y + Math.round(smoothNoise(u + v, 0, 944, 9) * 4)) % 9 === 0;
      const grassy = y === top - 1 && !steep && smoothNoise(u, v, 945, 6) > 0.42;
      put(u, y, v, grassy ? C.grass : y < 1 ? C.rockDark : band ? C.rockLight : tone < 0.36 ? C.rockDark : tone > 0.7 ? C.rockLight : C.rock);
    }
  }
  // The gateway: black within (a few voxels in), its floor trodden bare.
  box(MID - HALF, 0, FACE - 9, MID + HALF, ARCH - 1, FACE - 7, () => C.dark);
  box(MID - HALF, -SINK, FACE - 9, MID + HALF, -1, FRONT, (u, y, v) => (y === -1 && hashUnit(u, v, 946) < 0.5 ? C.rock : C.rockDark));

  // Its posts, from the rock out; the lintel across them; the portcullis' teeth in the gateway's top.
  for (const side of [-1, 1]) {
    const [a, b] = side < 0 ? [MID - POST[1], MID - POST[0]] : [MID + POST[0], MID + POST[1]];
    box(a, -SINK, FACE - 9, b, ARCH + 3, FRONT, (u, y, v) => (y < 2 ? C.rockDark : v === FRONT && (u === a || u === b) ? C.timberDark : y % 8 === 5 && v === FRONT ? C.pitch : u === (side < 0 ? b : a) ? C.timberDark : C.timber));
  }
  box(MID - POST[1] - 1, ARCH, FACE - 9, MID + POST[1] + 1, ARCH + 3, FRONT + 1, (_u, y) => (y === ARCH ? C.pitch : y === ARCH + 3 ? C.timberLight : C.timberDark));
  for (let u = MID - HALF + 1; u <= MID + HALF - 1; u += 2) box(u, ARCH - 4, FRONT - 3, u, ARCH - 1, FRONT - 3, (_u, y) => (y === ARCH - 4 ? C.iron : C.pitch));

  // The hoarding over it: boarded, slit, out past the posts on braces; its lean-to roof run back to the rock.
  const [h0, h1, hf] = [ARCH + 4, ARCH + 12, FRONT + 3];
  box(MID - 16, h0, FACE - 4, MID + 16, h1, hf, (u, y, v) => {
    const wall = v === hf || u === MID - 16 || u === MID + 16;
    if (!wall && y > h0) return v < FACE - 1 ? C.timberDark : 0; // (hollow; its back against the rock)
    if (y === h0) return C.pitch; // its floor, seen from under
    const along = v === hf ? u : v;
    if (y >= h0 + 4 && y <= h0 + 6 && along % 8 === 5) return C.dark; // a slit
    return y === h1 ? C.timberDark : along % 4 === 1 ? C.timberDark : hashUnit(Math.floor(along / 4), v === hf ? 0 : 1, 947) < 0.5 ? C.timber : C.timberLight;
  });
  for (let v = FACE - 6; v <= hf + 1; v++) {
    const y = h1 + 1 + Math.round(((hf + 1 - v) / (hf + 7 - FACE)) * 5); // rising toward the rock
    for (let u = MID - 17; u <= MID + 17; u++) for (let k = 0; k < 2; k++) put(u, y + k, v, k === 1 && u % 5 === 2 ? C.pitch : k === 1 ? C.timberDark : C.pitch);
  }
  for (const side of [-1, 1]) for (const u of [MID + side * POST[0], MID + side * POST[1]]) voxelLineOver(g, [u, ARCH - 4, FRONT + 1], [u, h0 - 1, hf], C.timberDark);

  // A palisade along the rock's foot, either side: sharpened logs, uneven.
  for (let u = 3; u < W - 3; u++) {
    if (Math.abs(u - MID) <= POST[1] + 1) continue;
    const log = Math.floor(u / 3);
    const top = 15 + Math.floor(hashUnit(log, 1, 948) * 5) - Math.round(Math.abs(u - MID) / 12);
    const mid = u % 3 === 1;
    for (let v = faceAt(u) + 1; v <= faceAt(u) + 3; v++) for (let y = -SINK; y <= top + (mid ? 1 : 0); y++) put(u, y, v, y >= top ? C.timberLight : mid ? C.timber : C.timberDark);
  }

  // A torch on each post: an iron bracket, a shaft, its flame.
  for (const side of [-1, 1]) {
    const u = MID + side * 12;
    box(u - 1, 13, FRONT + 1, u, 14, FRONT + 2, () => C.iron);
    box(u - 1, 15, FRONT + 1, u, 16, FRONT + 2, () => C.timberDark);
    box(u - 1, 17, FRONT + 1, u, 19, FRONT + 2, (_u, y) => (y === 17 ? C.bone : C.flame));
    put(u - (side < 0 ? 1 : 0), 20, FRONT + 1, C.flame);
  }

  // The banner, hung from the hoarding over the gateway: red, crossed knives on it in bone, its foot cut to two tails.
  for (let u = MID - 5; u <= MID + 5; u++) for (let y = ARCH - 1; y <= h1 - 1; y++) {
    const [du, dy] = [Math.abs(u - MID), y - (ARCH + 6)];
    if (y < ARCH + 2 && du < ARCH + 2 - y) continue; // (the tails)
    const mark = Math.abs(dy) <= 3 && (du === Math.abs(dy) || (dy === 3 && du >= 2 && du <= 4));
    put(u, y, hf + 1, mark ? C.bone : du === 5 || y === h1 - 1 ? C.pitch : C.red);
  }
  return g;
}

// A line of voxels between two points given over the ground (their y from its level).
function voxelLineOver(g: VoxelGrid, from: [number, number, number], to: [number, number, number], color: number): void {
  voxelLine(g, [from[0], from[1] + SINK, from[2]], [to[0], to[1] + SINK, to[2]], color);
}

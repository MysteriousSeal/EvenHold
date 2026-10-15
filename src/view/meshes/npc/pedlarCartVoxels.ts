// A pedlar's cart in voxels, at the mule's 0.02 (turned/donkeyVoxels.ts), facing +Z, its shafts forward to the mule
// (voxel-art: palette first; silhouette before detail; nothing a voxel thin; shading in bands, not speckle). Read
// first by its shape: a tall arched hood on a low bed, a big wheel either side. The hood is the pedlar's sign: cream
// canvas striped red down its length (no one else's cart is), lashed at its hoops; under it at the back, the load
// shows (a sack, a crate); along its sides hang what a pedlar sells (a pan, pots, a lantern), dark iron and brass
// against the cream so they read. Its wheels are their own grid, to turn as it rolls.
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, setColor } from '../voxel/voxelShapes';

export const CART_VOXEL = 0.02;

const ENTRIES = {
  wood: 0x8a6440,
  woodDark: 0x5e4228,
  woodLight: 0xa98256,
  iron: 0x45474d,
  canvas: 0xe6dcc0,
  canvasShade: 0xc4b896, // the hood's underside and its far-from-the-light rows
  stripe: 0xa83a2c,
  stripeShade: 0x7e2a20,
  rope: 0xb89a68,
  brass: 0xc8a050,
  sack: 0xcdb98a,
  sackDark: 0xa89468,
} as const;
export const CART_PALETTE: number[] = Object.values(ENTRIES);
const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;

export const CART_SIZE: [number, number, number] = [18, 26, 30]; // across, up, along (the shafts the last 8)
export const WHEEL_RADIUS = 6; // voxels
export const WHEEL_AT = { y: 6, z: 9 }; // its hub, in the cart's grid (along: under the bed's middle-back)
export const WHEEL_X = [-2, 18]; // where each wheel's grid sits across (outside the bed, either side)
const BED = { x0: 2, x1: 15, z0: 1, z1: 20, y: 8 }; // the bed's floor (its top row)

export function cartGrid(): VoxelGrid {
  const g = createGrid(CART_SIZE);
  const put = (x: number, y: number, z: number, c: number) => x >= 0 && x < CART_SIZE[0] && y >= 0 && y < CART_SIZE[1] && z >= 0 && z < CART_SIZE[2] && setColor(g, x, y, z, c);
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number | ((x: number, y: number, z: number) => number)) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(x, y, z, typeof c === 'number' ? c : c(x, y, z));
  };
  // The bed: boards along it, a darker one every third; low sides two high, dark-capped; the axle under it.
  box(BED.x0, BED.y - 1, BED.z0, BED.x1, BED.y, BED.z1, (x) => (x % 3 === 0 ? C.woodDark : C.wood));
  for (const x of [BED.x0, BED.x1]) box(x, BED.y + 1, BED.z0, x, BED.y + 2, BED.z1, (_x, y) => (y === BED.y + 2 ? C.woodDark : C.wood));
  box(BED.x0, BED.y + 1, BED.z0, BED.x1, BED.y + 2, BED.z0, (_x, y) => (y === BED.y + 2 ? C.woodDark : C.wood)); // its tailboard
  box(0, WHEEL_AT.y - 1, WHEEL_AT.z - 1, CART_SIZE[0] - 1, WHEEL_AT.y, WHEEL_AT.z, C.woodDark); // the axle, out to the wheels
  box(BED.x0 + 1, WHEEL_AT.y + 1, WHEEL_AT.z - 1, BED.x1 - 1, BED.y - 2, WHEEL_AT.z, C.woodDark); // its block, up to the bed
  // The hood: hoops arched over the bed, the canvas between them, striped red along its length (every other band
  // of three across); its edge over the sides a shade darker; its front and back open, a hoop at each.
  const middle = (BED.x0 + BED.x1) / 2;
  const half = (BED.x1 - BED.x0) / 2 + 0.5;
  const top = (x: number) => BED.y + 3 + Math.round(9 * Math.sqrt(Math.max(0, 1 - ((x - middle) / half) ** 2))); // the arch, over its width
  for (let z = BED.z0 + 1; z <= BED.z1 - 1; z++) {
    const hoop = z === BED.z0 + 1 || z === BED.z1 - 1 || z === Math.round((BED.z0 + BED.z1) / 2);
    for (let x = BED.x0; x <= BED.x1; x++) {
      const t = top(x);
      const band = Math.floor((x - BED.x0 + 1) / 3) % 2 === 1;
      const low = t < BED.y + 7; // (its sides, coming down: the shaded rows)
      put(x, t, z, hoop ? C.rope : band ? (low ? C.stripeShade : C.stripe) : low ? C.canvasShade : C.canvas);
      for (let y = BED.y + 3; y < t; y++) if (x === BED.x0 || x === BED.x1) put(x, y, z, hoop ? C.rope : band ? C.stripeShade : C.canvasShade); // (down to the sides)
    }
  }
  // Under it at the back, the load: a sack, slumped, its neck tied; a crate before it.
  box(BED.x0 + 2, BED.y + 1, BED.z0 + 2, BED.x0 + 6, BED.y + 5, BED.z0 + 5, (_x, y) => (y === BED.y + 1 ? C.sackDark : C.sack));
  box(BED.x0 + 3, BED.y + 6, BED.z0 + 3, BED.x0 + 4, BED.y + 6, BED.z0 + 3, C.sackDark);
  box(BED.x1 - 6, BED.y + 1, BED.z0 + 2, BED.x1 - 2, BED.y + 4, BED.z0 + 6, (x, y, z) => ([x === BED.x1 - 6 || x === BED.x1 - 2, y === BED.y + 4, z === BED.z0 + 2 || z === BED.z0 + 6].filter(Boolean).length >= 2 ? C.woodDark : C.woodLight));
  // Hung along each side, under the hood's edge: a pan (brass), two pots (iron), a lantern at the front (brass, its glass).
  for (const [x, out] of [[BED.x0 - 1, -1], [BED.x1 + 1, 1]] as const) {
    box(x, BED.y + 3, 4, x, BED.y + 6, 6, C.brass); // the pan
    box(x - out, BED.y + 4, 5, x - out, BED.y + 5, 5, C.brass);
    box(x, BED.y + 2, 9, x, BED.y + 4, 11, C.iron); // a pot
    box(x, BED.y + 2, 14, x, BED.y + 3, 15, C.iron); // a smaller one
  }
  box(BED.x1, BED.y + 9, BED.z1, BED.x1 + 1, BED.y + 11, BED.z1, C.brass); // the lantern, at the front corner
  // The shafts: two thick, out forward from the bed, down a little toward the mule's sides.
  for (const x of [BED.x0 + 1, BED.x1 - 2]) for (let z = BED.z1 + 1; z < CART_SIZE[2]; z++) box(x, BED.y - 1 - Math.floor((z - BED.z1) / 5), z, x + 1, BED.y - 1 - Math.floor((z - BED.z1) / 5), z, C.woodDark);
  return g;
}

// A wheel, in its own grid (to turn about its hub): two thick across, an iron tyre, a dark rim, four thick spokes,
// an iron hub; its hub at its grid's middle.
export function wheelGrid(): VoxelGrid {
  const n = WHEEL_RADIUS * 2 + 1;
  const g = createGrid([2, n, n]);
  const c = WHEEL_RADIUS;
  for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) {
    const d = Math.hypot(y - c, z - c);
    if (d > c + 0.3) continue;
    const spoke = Math.abs(y - c) <= 0.5 || Math.abs(z - c) <= 0.5;
    const col = d > c - 1 ? C.iron : d > c - 2 ? C.woodDark : d < 1.5 ? C.iron : spoke ? C.wood : 0;
    if (col) for (let x = 0; x < 2; x++) setColor(g, x, y, z, col);
  }
  return g;
}

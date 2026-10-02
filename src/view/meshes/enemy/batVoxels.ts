// A cave bat as voxel parts (model/caves/caveFoes.ts), palette first: dusky
// brown fur (darker down its back), wings of thin leather a shade warmer,
// lighter where the light comes through between the dark finger bones that
// fan out from the wrist (a claw hooked there), the trailing edge scalloped;
// tall ears pink inside; eyes burning red (their own colour, drawn unlit);
// white needle fangs. Silhouette first: all wingspan, a small fuzzed body
// slung between. The wolf's voxels (0.025), facing +Z; the body (with its
// head), and a wing (built for the left, out along +X: mirrored for the right).

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, setColor } from '../voxel/voxelShapes';

export const BAT_VOXEL = 0.025;
const ENTRIES = {
  fur: 0x4e3c34,
  furDark: 0x3a2c26,
  membrane: 0x5e3e3a,
  membraneLit: 0x82584c, // (the light through it)
  bone: 0x2e2220,
  ear: 0x9a6a62,
  fang: 0xf0e8d8,
  nose: 0x2a1e1c,
  eye: 0xff4a3a, // (glow)
} as const;
export const BAT_PALETTE: number[] = Object.values(ENTRIES);
const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;
export const BAT_GLOW: ReadonlySet<number> = new Set([C.eye]);

export const BAT_BODY: [number, number, number] = [5, 9, 7]; // its body and head, the head's top the ears'
export const BAT_WING: [number, number, number] = [10, 1, 7]; // out from its shoulder along +X, its leading edge at the far z
export const BAT_SHOULDER = { y: 4, z: 3.5 }; // where its wings join (voxels, in the body's grid)

export function batBody(): VoxelGrid {
  const g = createGrid(BAT_BODY);
  const set = (x: number, y: number, z: number, c: number) => setColor(g, x, y, z, c);
  // The body: a fuzzed oval, darker down its back, little feet tucked under it.
  for (let x = 0; x < 5; x++) for (let y = 1; y <= 5; y++) for (let z = 1; z <= 4; z++) {
    const r = ((x - 2) / 2.5) ** 2 + ((y - 3) / 2.6) ** 2 + ((z - 2.5) / 2.1) ** 2;
    if (r <= 1) set(x, y, z, z <= 1 || y >= 5 ? C.furDark : (x + y + z) % 4 === 0 ? C.furDark : C.fur);
  }
  set(1, 0, 2, C.bone);
  set(3, 0, 2, C.bone);
  // The head, forward and up: snub-nosed, the eyes either side, the fangs under it; the ears standing tall.
  for (let x = 1; x <= 3; x++) for (let y = 4; y <= 6; y++) for (let z = 4; z <= 6; z++) set(x, y, z, C.fur);
  set(2, 5, 6, C.nose);
  set(1, 6, 6, C.eye);
  set(3, 6, 6, C.eye);
  set(1, 4, 6, C.fang);
  set(3, 4, 6, C.fang);
  set(2, 4, 6, C.furDark);
  for (const x of [0, 4]) {
    set(x, 6, 5, C.fur); // (the ears' roots, flared)
    set(x, 7, 5, C.ear);
    set(x, 8, 5, C.fur);
    set(x, 7, 4, C.fur);
  }
  return g;
}

export function batWing(): VoxelGrid {
  const g = createGrid(BAT_WING);
  // The membrane, from its straight leading edge back to a trailing edge running finger tip to finger tip (from the
  // body's flank), drawn in a voxel between each two: scalloped.
  const tips = [[0, 0], [3, 1], [6, 2], [9, 3]];
  for (let x = 0; x < 10; x++) {
    const i = Math.min(2, Math.floor(x / 3));
    const [[ax, az], [bx, bz]] = [tips[i], tips[i + 1]];
    const t = (x - ax) / (bx - ax);
    const edge = Math.round(az + (bz - az) * t + (t > 0.2 && t < 0.8 ? 1 : 0));
    for (let z = edge; z <= 6; z++) setColor(g, x, 0, z, (x * 2 + z) % 5 === 1 ? C.membraneLit : C.membrane);
  }
  // The arm along the leading edge to the wrist; three fingers fanning back from it; a claw hooked at the wrist.
  for (let x = 0; x <= 4; x++) setColor(g, x, 0, 6, C.bone);
  for (const [tx, tz] of [[9, 3], [6, 2], [3, 1]]) {
    const steps = Math.max(Math.abs(tx - 4), Math.abs(tz - 6));
    for (let s = 0; s <= steps; s++) setColor(g, Math.round(4 + ((tx - 4) * s) / steps), 0, Math.round(6 + ((tz - 6) * s) / steps), C.bone);
  }
  setColor(g, 5, 0, 6, C.fang); // (its thumb's claw, pale)
  return g;
}

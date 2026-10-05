// The wilds' fiercer beasts as voxel parts (beastRig.ts puts them together),
// palette first, silhouette first; the wolf's voxels (0.025), facing +Z, each
// part its own grid to move on its joint (the tail's root at +Z, its tip at 0):
// - a brown bear: massive, a hump over its shoulders, a big head carried low,
//   short thick legs; three browns of shaggy fur (lighter over the hump,
//   darker down its legs), a tan muzzle and a black nose, small round ears,
//   pale claws; a stub of a tail;
// - a lynx: lean and long-legged; tawny, spotted dark down its back and
//   flanks, its belly pale; a ruff of pale fur at its cheeks, its ears tipped
//   with black tufts, amber eyes; a short bobbed tail, its tip black.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';
import { hashUnit } from '../../../util/random';

const palette = <K extends string>(entries: Record<K, number>) => ({
  colors: Object.values(entries) as number[],
  C: Object.fromEntries(Object.keys(entries).map((name, i) => [name, i + 1])) as Record<K, number>,
});

// ---- the bear ----

const BEAR = palette({ fur: 0x5a3e2c, furDark: 0x43301f, furLight: 0x76543a, muzzle: 0x9a7a5a, nose: 0x1e1612, eye: 0x140e0c, claw: 0xd8cbb0, earIn: 0x3a2a1e });
export const BEAR_PALETTE = BEAR.colors;
export const BEAR_BODY: [number, number, number] = [11, 10, 18];
export const BEAR_HEAD: [number, number, number] = [8, 8, 9];
export const BEAR_LEG: [number, number, number] = [4, 7, 4];
export const BEAR_TAIL: [number, number, number] = [3, 3, 2];

export function bearBody(): VoxelGrid {
  const g = createGrid(BEAR_BODY);
  const { C } = BEAR;
  for (let x = 0; x < 11; x++) for (let z = 0; z < 18; z++) {
    // Its top: rising to a hump over the shoulders (toward its front, +z), sloping down to its rump.
    const hump = z >= 10 && z <= 15 ? 9 : z >= 7 ? 8 : 7 - (z < 2 ? 1 : 0);
    const edge = x === 0 || x === 10;
    const top = edge ? hump - 2 : x === 1 || x === 9 ? hump - 1 : hump;
    for (let y = edge ? 1 : 0; y <= top; y++) {
      const shag = hashUnit(x * 3 + y, z, 501) < 0.18; // (shaggy: a darker lock here and there)
      setColor(g, x, y, z, y === top && z >= 9 && z <= 15 ? C.furLight : y <= 1 ? C.furDark : shag ? C.furDark : C.fur);
    }
  }
  return g;
}

export function bearHead(): VoxelGrid {
  const g = createGrid(BEAR_HEAD);
  const { C } = BEAR;
  fillBox(g, 0, 0, 0, 7, 5, 5, (x, y) => (x === 0 || x === 7 || y === 0 ? C.furDark : C.fur)); // the skull, broad
  fillBox(g, 2, 0, 6, 5, 3, 8, (_x, y) => (y === 0 ? C.furDark : C.muzzle)); // the muzzle
  fillBox(g, 3, 2, 8, 4, 3, 8, C.nose);
  setColor(g, 3, 1, 8, C.nose);
  setColor(g, 4, 1, 8, C.nose);
  setColor(g, 1, 4, 5, C.eye); // small eyes
  setColor(g, 6, 4, 5, C.eye);
  for (const x of [0, 6]) {
    fillBox(g, x, 6, 1, x + 1, 7, 2, C.furDark); // round ears
    setColor(g, x + (x === 0 ? 1 : 0), 6, 2, C.earIn);
  }
  return g;
}

export function bearLeg(): VoxelGrid {
  const g = createGrid(BEAR_LEG);
  const { C } = BEAR;
  fillBox(g, 0, 1, 0, 3, 6, 3, (_x, y) => (y >= 5 ? C.fur : C.furDark));
  fillBox(g, 0, 0, 0, 3, 0, 3, C.furDark);
  for (const x of [0, 1, 2, 3]) if (x !== 1) setColor(g, x, 0, 3, C.claw); // its claws, at the front of its paw
  return g;
}

export function bearTail(): VoxelGrid {
  const g = createGrid(BEAR_TAIL);
  fillBox(g, 0, 0, 0, 2, 2, 1, BEAR.C.furDark);
  return g;
}

// ---- the lynx ----

const LYNX = palette({ fur: 0xb8925e, furDark: 0x8a6a40, spot: 0x5a4026, belly: 0xe8d8b8, ruff: 0xe0ccaa, tuft: 0x1a1410, eye: 0xd8c040, nose: 0x6a4a3a });
export const LYNX_PALETTE = LYNX.colors;
export const LYNX_BODY: [number, number, number] = [6, 6, 13];
export const LYNX_HEAD: [number, number, number] = [7, 9, 7];
export const LYNX_LEG: [number, number, number] = [2, 9, 2];
export const LYNX_TAIL: [number, number, number] = [2, 3, 3];

export function lynxBody(): VoxelGrid {
  const g = createGrid(LYNX_BODY);
  const { C } = LYNX;
  fillBox(g, 0, 0, 0, 5, 5, 12, (x, y, z) => {
    if (y <= 1) return C.belly;
    if ((x === 0 || x === 5) && y === 5) return 0; // (its back rounded)
    if (hashUnit(x * 7 + y, z * 3, 521) < 0.2 && y >= 2) return C.spot; // spotted
    return y === 5 ? C.furDark : C.fur;
  });
  for (const x of [0, 5]) for (const z of [0, 12]) setColor(g, x, 4, z, 0); // (its corners off)
  return g;
}

export function lynxHead(): VoxelGrid {
  const g = createGrid(LYNX_HEAD);
  const { C } = LYNX;
  fillBox(g, 1, 0, 0, 5, 4, 4, (x, y) => (y === 4 && x >= 2 && x <= 4 ? C.furDark : C.fur)); // its head, round
  fillBox(g, 2, 0, 5, 4, 2, 6, (_x, y) => (y === 0 ? C.belly : C.ruff)); // a short muzzle
  setColor(g, 3, 2, 6, C.nose);
  setColor(g, 2, 3, 4, C.eye);
  setColor(g, 4, 3, 4, C.eye);
  for (const x of [0, 6]) fillBox(g, x, 0, 1, x, 2, 4, C.ruff); // its cheek ruffs, flaring
  for (const x of [1, 5]) {
    fillBox(g, x, 5, 1, x, 6, 2, C.furDark); // its ears, upright
    setColor(g, x, 7, 1, C.tuft); // and their black tufts
    setColor(g, x, 8, 1, C.tuft);
  }
  return g;
}

export function lynxLeg(): VoxelGrid {
  const g = createGrid(LYNX_LEG);
  fillBox(g, 0, 0, 0, 1, 8, 1, (_x, y) => (y === 0 ? LYNX.C.ruff : y >= 7 ? LYNX.C.fur : y <= 3 ? LYNX.C.furDark : LYNX.C.fur)); // long, its big paw pale
  return g;
}

export function lynxTail(): VoxelGrid {
  const g = createGrid(LYNX_TAIL);
  fillBox(g, 0, 0, 0, 1, 2, 2, (_x, _y, z) => (z === 0 ? LYNX.C.tuft : LYNX.C.fur)); // short, bobbed, its tip black
  return g;
}

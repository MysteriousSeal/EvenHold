// A cave's mouth out in the hills (model/caves/caves.ts): a craggy knoll of
// rock over its three tiles by three (75 x 75 voxels, the ruins' 0.04), its
// mouth in its front (local +Z, toward the spot before it). Palette first:
// weathered grey-brown stone in three tones, a sandy stratum through it, grass
// and moss over its gentler tops, earth at its foot; the mouth black within,
// its rim in shadow. Silhouette first: a hump rising to its back, its front a
// cliff, the arch of the mouth gnawed into it (ragged, not dressed), boulders
// tumbled at its foot. Roots trail over the mouth's lintel, a web hangs in its
// corner, bones lie at its threshold. Sunk into the ground (SINK) so it never
// floats where the hill rises under it.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, setColor } from '../voxel/voxelShapes';
import { hashUnit } from '../../../util/random';
import { lumpy } from '../../cave/caveRockVoxels';

export const MOUTH_VOXEL = 0.04;
export const MOUTH_GRID: [number, number, number] = [75, 64, 75];
export const SINK = 8; // voxels of it below the ground (y SINK the ground's level at the mouth)

const ENTRIES = {
  rock: 0x7a7068,
  rockDark: 0x5e564f,
  rockLight: 0x958a7e,
  strata: 0x9a8a6e,
  grass: 0x6a8a3a,
  moss: 0x5e7a3a,
  earth: 0x5a4636,
  shade: 0x2a2420,
  deep: 0x120e0c,
  dark: 0x050404,
  root: 0x5e4430,
  web: 0xd8d4c8,
  bone: 0xd9cfb6,
} as const;
export const MOUTH_PALETTE: number[] = Object.values(ENTRIES);
const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;

const [W, , D] = MOUTH_GRID;
const MID = (W - 1) / 2;
const FRONT = D - 1;
const MOUTH_DEEP = 30; // voxels it runs back into the knoll
const MOUTH_HIGH = 31; // its arch's crown over the ground
const MOUTH_HALF = 15; // its half-width at the ground

// The knoll's height (over the ground) at (u, v): a hump rising toward its back, its front a cliff round the mouth.
function heightAt(u: number, v: number, variant: number): number {
  const across = Math.abs(u - MID) / MID;
  const back = v / FRONT;
  const edge = Math.min(u, W - 1 - u, v, FRONT - v) / 10; // (to its sides and back it slopes down to the ground)
  const cliff = Math.abs(u - MID) < 27 && v > FRONT - 12; // (its front: a cliff, the mouth in it)
  const fall = cliff ? Math.min(1, Math.min(u, W - 1 - u, v) / 10) : Math.min(1, edge);
  const hump = 52 * (1 - across ** 2.4) * (1 - 0.2 * back) * fall;
  return Math.max(0, Math.round(hump + (lumpy(u, v, 900 + variant, 7) - 0.5) * 10));
}

// The mouth's half-width at height y over the ground (ragged), 0 above its crown.
const mouthHalf = (y: number, variant: number) => (y >= MOUTH_HIGH ? 0 : MOUTH_HALF * Math.sqrt(Math.max(0, 1 - (y / MOUTH_HIGH) ** 2.2)) + (hashUnit(y, variant, 910) - 0.5) * 2.2);
const inMouth = (u: number, y: number, v: number, variant: number) => FRONT - v < MOUTH_DEEP && y >= 0 && Math.abs(u - MID) <= mouthHalf(y, variant) - Math.max(0, (FRONT - v - 20) * 0.4); // (narrowing as it goes in)

export function buildCaveMouth(variant: number): VoxelGrid {
  const g = createGrid(MOUTH_GRID);
  const set = (u: number, y: number, v: number, c: number) => {
    if (u >= 0 && v >= 0 && y >= 0 && u < W && v < D && y < MOUTH_GRID[1]) setColor(g, u, y, v, c);
  };
  for (let u = 0; u < W; u++) {
    for (let v = 0; v < D; v++) {
      const high = heightAt(u, v, variant);
      if (high <= 0) continue;
      const steep = Math.abs(heightAt(u + 1, v, variant) - heightAt(u - 1, v, variant)) + Math.abs(heightAt(u, v + 1, variant) - heightAt(u, v - 1, variant));
      for (let y = 0; y < SINK + high; y++) {
        const over = y - SINK; // (over the ground)
        if (inMouth(u, over, v, variant)) continue;
        const top = y === SINK + high - 1;
        const band = Math.floor((over + Math.round(lumpy(u + v, 0, 911, 9) * 5)) / 6);
        const tone = lumpy(u + v * 0.5, y, 912 + variant, 4);
        let color: number = band % 5 === 3 ? C.strata : tone < 0.35 ? C.rockDark : tone > 0.7 ? C.rockLight : C.rock;
        if (top && steep < 5) color = hashUnit(u, v, 913) < 0.65 ? C.grass : C.moss; // (grass on its gentler tops)
        else if (top && steep < 8 && hashUnit(u, v, 914) < 0.4) color = C.moss;
        if (over < 2 && over >= 0 && hashUnit(u, v + y, 915) < 0.3) color = C.earth;
        // Round the mouth: its rim in shadow, darker as it goes in, black within.
        const near = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, -1], [0, -1, 0]].some(([du, dy, dv]) => inMouth(u + du, over + dy, v + dv, variant));
        if (near) {
          const deepIn = FRONT - v;
          color = deepIn < 3 ? C.shade : deepIn < 12 ? C.deep : C.dark;
        }
        set(u, y, v, color);
      }
    }
  }
  // The mouth's floor: earth, going dark within; the back of it, black.
  for (let v = FRONT - MOUTH_DEEP; v <= FRONT; v++) for (let u = 0; u < W; u++) {
    if (!inMouth(u, 0, v, variant)) continue;
    const deepIn = FRONT - v;
    set(u, SINK - 1, v, deepIn < 4 ? C.earth : deepIn < 14 ? C.deep : C.dark);
    if (deepIn === MOUTH_DEEP - 1) for (let y = 0; y < MOUTH_HIGH; y++) set(u, SINK + y, v, C.dark);
  }
  // Boulders tumbled at its foot, either side of the mouth.
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    const [bu, bv] = [MID + side * (MOUTH_HALF + 4 + hashUnit(i, variant, 916) * 14), FRONT - 2 - hashUnit(variant, i, 917) * 6];
    const r = 2 + hashUnit(i, i, 918 + variant) * 2.5;
    for (let u = Math.floor(bu - r); u <= bu + r; u++) for (let v = Math.floor(bv - r); v <= bv + r; v++) for (let y = 0; y <= r * 1.6; y++) {
      if (Math.hypot(u - bu, v - bv, (y - r * 0.4) * 0.8) <= r) set(u, SINK + y, v, y > r ? C.moss : hashUnit(u, y, 919) < 0.5 ? C.rock : C.rockDark);
    }
  }
  // Roots trailing over the lintel; a web strung in its upper corner; bones at its threshold.
  for (let i = 0; i < 7; i++) {
    let u = Math.round(MID - 12 + i * 4 + hashUnit(i, 0, 920) * 2);
    const end = MOUTH_HIGH - 4 - Math.floor(hashUnit(i, 1, 921) * 12);
    for (let y = MOUTH_HIGH + 2; y >= end; y--) {
      if (hashUnit(i, y, 922) < 0.15) u += hashUnit(y, i, 923) < 0.5 ? -1 : 1;
      if (Math.abs(u - MID) <= mouthHalf(y, variant) + 1) set(u, SINK + y, FRONT, C.root);
    }
  }
  const [hu, hy] = [Math.round(MID + 9), MOUTH_HIGH - 9];
  for (const [eu, ey] of [[MID + 4, MOUTH_HIGH - 1], [MID + 14, MOUTH_HIGH - 12], [MID + 14, MOUTH_HIGH - 3], [MID + 6, MOUTH_HIGH - 14]]) {
    const steps = Math.max(Math.abs(eu - hu), Math.abs(ey - hy));
    for (let s = 0; s <= steps; s++) set(Math.round(hu + ((eu - hu) * s) / steps), SINK + Math.round(hy + ((ey - hy) * s) / steps), FRONT - 1, C.web);
  }
  for (const [u, v] of [[MID - 6, FRONT - 3], [MID - 5, FRONT - 3], [MID - 4, FRONT - 3], [MID + 3, FRONT - 1], [MID + 4, FRONT - 2], [MID - 2, FRONT - 6]]) set(Math.round(u), SINK, v, C.bone);
  return g;
}

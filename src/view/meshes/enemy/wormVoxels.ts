// A cave worm as voxel parts (model/caves/caveFoes.ts), palette first: pale
// fleshy pink-brown, a dark groove between each ring, its belly lighter, dark
// spots along its back; its head all mouth, a round maw ringed with a red lip
// and pale hooked teeth closing in on the dark gullet. Underground, all that
// shows of it is the earth it heaves up as it goes: a hump of dirt, pebbles in
// it (or, as it's up, the torn ring of earth round the hole it's up out of).
// The wolf's voxels (0.025); the head and the rings face +Z (round across x,y).

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, setColor } from '../voxel/voxelShapes';
import { hashUnit } from '../../../util/random';

export const WORM_VOXEL = 0.025;
const ENTRIES = {
  flesh: 0xb07e6c,
  fleshDark: 0x8a5c50,
  groove: 0x5e3c34,
  belly: 0xcfa08e,
  lip: 0xb85a50,
  maw: 0x2a0e10,
  gullet: 0x5a1a1e,
  tooth: 0xece2c8,
  dirt: 0x4a3a2c,
  dirtDark: 0x382b20,
  dirtLight: 0x6a5440,
  pebble: 0x6e665e,
} as const;
export const WORM_PALETTE: number[] = Object.values(ENTRIES);
const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;

export const WORM_HEAD: [number, number, number] = [9, 9, 5];
export const WORM_RINGS = [9, 9, 8, 8, 7, 6, 5]; // each ring's width (voxels), from behind the head to the tail's tip
export const RING_LONG = 3; // voxels along, each ring
export const MOUND: [number, number, number] = [13, 4, 13];

// The head: round, the maw its whole front: the lip, a ring of teeth hooked in, the dark within, the gullet's red.
export function wormHead(): VoxelGrid {
  const g = createGrid(WORM_HEAD);
  const c = (WORM_HEAD[0] - 1) / 2;
  for (let x = 0; x < WORM_HEAD[0]; x++) for (let y = 0; y < WORM_HEAD[1]; y++) {
    const r = Math.hypot(x - c, y - c);
    if (r > c + 0.45) continue;
    const a = Math.atan2(y - c, x - c);
    for (let z = 0; z < WORM_HEAD[2]; z++) {
      let color: number = y <= 1 ? C.belly : (x + z) % 5 === 0 && y >= 6 ? C.fleshDark : C.flesh;
      if (z === 0) color = C.groove;
      if (z >= 3) {
        if (r < 1.2) color = z === 3 ? C.gullet : 0; // (the gullet, deep in)
        else if (r < 2.4) color = z === 4 && Math.round((a / Math.PI) * 4 + 8) % 2 === 0 ? C.tooth : z === 3 ? C.maw : 0; // teeth round the dark
        else if (r < 3.2) color = z === 4 ? (Math.round((a / Math.PI) * 6 + 12) % 2 === 0 ? C.tooth : C.maw) : C.lip; // (the outer ring of teeth)
        else if (z === 4) color = C.lip;
      }
      if (color) setColor(g, x, y, z, color);
    }
  }
  return g;
}

// A ring of its body, `width` across, a groove at its back.
export function wormRing(width: number): VoxelGrid {
  const g = createGrid([width, width, RING_LONG]);
  const c = (width - 1) / 2;
  for (let x = 0; x < width; x++) for (let y = 0; y < width; y++) {
    if (Math.hypot(x - c, y - c) > c + 0.45) continue;
    for (let z = 0; z < RING_LONG; z++) {
      const spot = y >= width - 2 && (x * 3 + width) % 4 === 0 && z === 1;
      setColor(g, x, y, z, z === 0 ? C.groove : spot ? C.fleshDark : y <= 1 ? C.belly : C.flesh);
    }
  }
  return g;
}

// The earth it heaves up: a hump of dirt with pebbles in it; `hole`, the torn ring round where it's up out of the ground.
export function wormMound(hole: boolean): VoxelGrid {
  const g = createGrid(MOUND);
  const c = (MOUND[0] - 1) / 2;
  for (let x = 0; x < MOUND[0]; x++) for (let z = 0; z < MOUND[2]; z++) {
    const r = Math.hypot(x - c, z - c) + (hashUnit(x, z, 611) - 0.5) * 1.4; // (its edge ragged)
    if (r > c) continue;
    const high = hole ? Math.round(3.5 * Math.max(0, 1 - Math.abs(r - c * 0.62) / (c * 0.42))) : Math.round(3.6 * (1 - (r / c) ** 2));
    if (hole && r < c * 0.38) continue; // (the hole itself)
    for (let y = 0; y < Math.max(1, high); y++) {
      const top = y === Math.max(1, high) - 1;
      const roll = hashUnit(x * 7 + y, z, 612);
      setColor(g, x, y, z, top && roll < 0.12 ? C.pebble : top && roll > 0.8 ? C.dirtLight : y === 0 ? C.dirtDark : C.dirt);
    }
  }
  return g;
}

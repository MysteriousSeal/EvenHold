// The ground's colour by the kind of country (model/scenery/biomes.ts), world-design's palette: each country its own
// green (the woods dark and mossy, the moor ochre-olive, the marsh a damp olive, the hills stony), a step darker each
// tier down; and here and there, in clumps of tiles, the woods' leaf litter and moss, the marsh's mud. Handed out as a
// multiplier on each tile's own colour (TERRAIN_COLORS: its instance's colour, no draw more), and on the grass growing
// on it, so tufts sit in their ground. Colour by the tile, never by the voxel (the greedy mesh, no shimmer).

import * as THREE from 'three';
import { TERRAIN_COLORS } from '../../constants';
import { hashUnit } from '../../../util/random';
import type { Biome } from '../../../model/scenery/biomes';

const GROUND: Record<Biome, number> = {
  meadow: 0x78b553,
  forest: 0x3f6b35,
  heath: 0x9a9a5c, // the moor
  marsh: 0x5e7a48,
  hills: 0x8c8a6a,
};
// Patches of other ground, in clumps (a clump of tiles a CLUMP a side, most of its tiles), by the country.
const PATCHES: Partial<Record<Biome, Array<{ color: number; chance: number }>>> = {
  forest: [{ color: 0x7a5a36, chance: 0.08 }, { color: 0x5f8a3e, chance: 0.1 }], // leaf litter, moss
  marsh: [{ color: 0x5a4a36, chance: 0.1 }], // mud
};
const CLUMP = 3;
const PATCH_STRENGTH = 0.5; // of the way from the country's ground to its patch's: a hint, never a ploughed field
const TIER_STEP = [0.86, 0.92, 0.97, 1.02, 1.06]; // the lower, the darker

// The patch at tile (x, z) of `biome`, if any: its index in PATCHES' list (-1: the country's own ground).
export function patchAt(biome: Biome, x: number, z: number): number {
  const patches = PATCHES[biome];
  if (!patches || hashUnit(x, z, 0x6d0) > 0.6) return -1;
  let roll = hashUnit(Math.floor(x / CLUMP), Math.floor(z / CLUMP), 0x6d1);
  for (let i = 0; i < patches.length; i++) {
    if (roll < patches[i].chance) return i;
    roll -= patches[i].chance;
  }
  return -1;
}

// The multiplier on tier `tier`'s green for `biome` (and its patch: patchAt), made once each.
const made = new Map<string, THREE.Color>();
export function groundTint(biome: Biome, tier: number, patch = -1): THREE.Color {
  const key = `${biome}:${tier}:${patch}`;
  let tint = made.get(key);
  if (!tint) {
    const base = new THREE.Color(TERRAIN_COLORS[tier % TERRAIN_COLORS.length]);
    const ground = new THREE.Color(GROUND[biome]);
    const to = (patch >= 0 ? ground.lerp(new THREE.Color(PATCHES[biome]![patch].color), PATCH_STRENGTH) : ground).multiplyScalar(TIER_STEP[Math.min(tier, TIER_STEP.length - 1)]);
    tint = new THREE.Color(to.r / base.r, to.g / base.g, to.b / base.b);
    made.set(key, tint);
  }
  return tint;
}

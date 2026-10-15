// The ground's colour by the kind of country (model/scenery/biomes.ts): each tier's own green (TERRAIN_COLORS) drawn
// toward the country's, so the woods read dark and mossy, the heath olive-brown, the marsh a damp blue-green, the hills
// a stony grey-green, and the meadows as they ever were. Handed out as a multiplier on each tile's own colour (its
// instance's colour: no draw calls more), and on the grass growing on it, so tufts sit in their ground.

import * as THREE from 'three';
import { TERRAIN_COLORS } from '../../constants';
import type { Biome } from '../../../model/scenery/biomes';

const GROUND: Record<Biome, { color: number; amount: number }> = {
  meadow: { color: 0xffffff, amount: 0 },
  forest: { color: 0x3d6a36, amount: 0.55 }, // moss under the canopy
  heath: { color: 0x8c8a4c, amount: 0.5 }, // dry olive, browning
  marsh: { color: 0x58785c, amount: 0.45 }, // damp, blue-green
  hills: { color: 0x9c9c7c, amount: 0.45 }, // stony, grey-green
};

// The multiplier on tier `tier`'s green for `biome` (made once each).
const made = new Map<string, THREE.Color>();
export function groundTint(biome: Biome, tier: number): THREE.Color {
  const key = `${biome}:${tier}`;
  let tint = made.get(key);
  if (!tint) {
    const base = new THREE.Color(TERRAIN_COLORS[tier % TERRAIN_COLORS.length]);
    const { color, amount } = GROUND[biome];
    const to = base.clone().lerp(new THREE.Color(color), amount);
    tint = new THREE.Color(to.r / base.r, to.g / base.g, to.b / base.b);
    made.set(key, tint);
  }
  return tint;
}

// The ground's colour by the kind of country (model/scenery/biomes.ts), world-design's palette: each country its own
// green, differing from its neighbours mostly in hue (the woods a deeper green, the moor olive, the marsh a wet green,
// the hills stony), a step darker each tier down; blended over the few tiles either side of a border (each tile's the
// weighted mean of the grounds round it), so the land shades from one to the next, never a patchwork; mud here and there
// right at the marsh's water, blended the same (a ground of its own in the mean). Handed out as a multiplier on each tile's own colour (TERRAIN_COLORS: its instance's
// colour, no draw more), and on the grass growing on it, so tufts sit in their ground. Colour by the tile, never by
// the voxel (the greedy mesh, no shimmer).

import * as THREE from 'three';
import { TERRAIN_COLORS } from '../../constants';
import { BIOMES, type Biome, type BiomeMap } from '../../../model/scenery/biomes';
import { hashUnit } from '../../../util/random';
import type { Tiles } from '../../../model/map/tiles';

export const GROUND: Record<Biome, number> = { // (the map washes its country in these too: view/atlas/mapPaint.ts)
  meadow: 0x7cbd58, // sunny: home (main's mid greens, on screen)
  forest: 0x4f8a42,
  heath: 0x9aa25e, // the moor: a lighter, yellower olive than the meadow, clear of the roads' brown (its heather its colour)
  marsh: 0x5f8a5a, // a touch lighter and bluer than the woods'
  hills: 0x8a9a72, // rocky: stony, still green under the haze
};
const MUD = 0x5a5038; // a marsh tile at the water's edge, here and there (MUD_CHANCE): a ground of its own, blended
const MUD_CHANCE = 0.45;
const TIER_STEP = [0.84, 0.92, 1, 1.05, 1.08]; // the lower, the darker: a step of some 8% a tier, so the terraces read (the highest meadow never lime)
// The countries read round a tile, and how much each counts: the 5x5 round it, the nearer the more (a border shades
// over some five tiles).
const FALLOFF = [1, 2, 3, 2, 1];
const ROUND: ReadonlyArray<[number, number, number]> = FALLOFF.flatMap((wx, i) => FALLOFF.map((wz, k): [number, number, number] => [i - 2, k - 2, wx * wz]));
const WEIGHT = ROUND.reduce((sum, [, , w]) => sum + w, 0);
const BLOCK = 16; // tiles a side of each block of countries kept
const KEPT = 512; // blocks kept (the oldest let go)

const colours = [...BIOMES.map((b) => new THREE.Color(GROUND[b])), new THREE.Color(MUD)]; // (by ground: each country's, then mud)
const MUD_GROUND = BIOMES.length;
const bases = TERRAIN_COLORS.map((c) => new THREE.Color(c));

export type GroundColours = (x: number, z: number, tier: number) => THREE.Color;

// The multiplier on tile (x, z)'s own colour (its tier's, TERRAIN_COLORS), its country's ground blended with those round
// it. The colour handed back is reused from call to call: copy it to keep it.
export function createGroundColours(biomes: BiomeMap, tiles: Tiles): GroundColours {
  const byWater = (x: number, z: number) => {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (tiles.has(x + dx, z + dz) && tiles.lake(x + dx, z + dz)) return true;
    return false;
  };
  const blocks = new Map<string, Uint8Array>();
  const countryAt = (x: number, z: number): number => {
    const [bx, bz] = [Math.floor(x / BLOCK), Math.floor(z / BLOCK)];
    const key = `${bx},${bz}`;
    let block = blocks.get(key);
    if (!block) {
      block = new Uint8Array(BLOCK * BLOCK);
      for (let i = 0; i < BLOCK; i++) for (let k = 0; k < BLOCK; k++) {
        const [x, z] = [bx * BLOCK + i, bz * BLOCK + k];
        const country = biomes.at(x, z);
        block[i * BLOCK + k] = country === 'marsh' && hashUnit(x, z, 0x3d0) < MUD_CHANCE && byWater(x, z) ? MUD_GROUND : BIOMES.indexOf(country);
      }
      if (blocks.size >= KEPT) blocks.delete(blocks.keys().next().value!);
      blocks.set(key, block);
    }
    return block[(x - bx * BLOCK) * BLOCK + (z - bz * BLOCK)];
  };
  const out = new THREE.Color();
  return (x, z, tier) => {
    out.setRGB(0, 0, 0);
    for (const [dx, dz, weight] of ROUND) {
      const c = colours[countryAt(x + dx, z + dz)];
      out.r += c.r * weight;
      out.g += c.g * weight;
      out.b += c.b * weight;
    }
    out.multiplyScalar(1 / WEIGHT);
    const base = bases[tier % bases.length];
    const step = TIER_STEP[Math.min(tier, TIER_STEP.length - 1)];
    return out.setRGB((out.r * step) / base.r, (out.g * step) / base.g, (out.b * step) / base.b);
  };
}

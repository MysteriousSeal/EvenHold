// Potions in voxels (potions.ts), grid-aligned only: round corked flasks,
// health red and energy blue, larger for each size: a minor one a small
// bulb, a lesser one rounder with a longer neck, a greater one the largest,
// a gold band round its neck, a gold stopper, its liquid glowing pale
// through the glass on its near sides. Each lit from above: its liquid darker low, paler high, a glint
// of glass on its shoulder, a glass lip round the neck.

import type { PotionId } from '../../../model/loot/potions';
import { setColor } from '../voxel/voxelShapes';
import { model, type LootModel } from './lootModel';

type Tier = 'minor' | 'lesser' | 'greater';
// The bulb's radius at each row (bottom up), the neck's height.
const SHAPE: Record<Tier, { rows: number[]; neck: number }> = {
  minor: { rows: [1, 2, 2, 1], neck: 1 },
  lesser: { rows: [1, 2, 2, 2, 1], neck: 2 },
  greater: { rows: [2, 3, 3, 3, 2], neck: 2 },
};

// Its colours: the liquid deep, mid and pale, the glass's glint, the cork (gold, the greater's) and the glow.
function flask(tier: Tier, [deep, mid, pale, glow]: [number, number, number, number]): LootModel {
  const { rows, neck } = SHAPE[tier];
  const r = Math.max(...rows);
  const n = 2 * r + 1;
  const height = rows.length + neck + 2; // (the lip, the cork)
  const greater = tier === 'greater';
  // Palette: 1 deep, 2 mid, 3 pale, 4 glow, 5 glass, 6 cork, 7 gold.
  return model([deep, mid, pale, glow, 0xeaf4f8, 0x8a5a35, 0xd4b060], [n, height, n], (g) => {
    rows.forEach((radius, y) => {
      for (let z = 0; z < n; z++) {
        for (let x = 0; x < n; x++) {
          const [dx, dz] = [x - r, z - r];
          if (dx * dx + dz * dz > radius * radius + 0.6) continue;
          const shoulder = y === rows.length - 2 && dx === -radius + 1 && dz === radius - 1; // (the glint, on the lit side)
          const heart = greater && y >= 1 && y <= 3 && ((dz === radius && Math.abs(dx) <= 1) || (dx === radius && Math.abs(dz) <= 1)); // (its glow, seen through the glass on the near sides)
          setColor(g, x, y, z, shoulder ? 5 : heart ? 4 : y === 0 ? 1 : y >= rows.length - 1 ? 3 : 2);
        }
      }
    });
    const top = rows.length;
    for (let y = top; y < top + neck; y++) setColor(g, r, y, r, greater && y === top ? 7 : 5); // the neck (gold-banded, the greater's)
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) setColor(g, r + dx, top + neck, r + dz, dx || dz ? 5 : greater ? 7 : 6); // the lip
    setColor(g, r, top + neck + 1, r, greater ? 7 : 6); // the stopper
  });
}

const RED: [number, number, number, number] = [0x8e1c24, 0xc8323a, 0xf0606a, 0xffb0a8];
const BLUE: [number, number, number, number] = [0x1c3e8e, 0x3264c8, 0x6a9cf0, 0xb8e0ff];

export const POTION_MODELS: Record<PotionId, LootModel> = {
  minorHealthPotion: flask('minor', RED),
  lesserHealthPotion: flask('lesser', RED),
  greaterHealthPotion: flask('greater', RED),
  minorEnergyPotion: flask('minor', BLUE),
  lesserEnergyPotion: flask('lesser', BLUE),
  greaterEnergyPotion: flask('greater', BLUE),
};

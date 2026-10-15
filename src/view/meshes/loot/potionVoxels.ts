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

// A pot of salve (the pox's): a squat glazed pot 1 (lit 2), its salve 3 under a cloth 4 tied with twine 5.
const salvePot = (): LootModel =>
  model([0x7a5a3a, 0xa8805a, 0xe0d4a8, 0xe8e0cc, 0xb89a68], [5, 4, 5], (g) => {
    for (let y = 0; y < 3; y++) for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) if (!((x === 0 || x === 4) && (z === 0 || z === 4))) setColor(g, x, y, z, y === 2 && (x === 0 || z === 4) ? 5 : y === 1 && x === 1 ? 2 : 1);
    for (let x = 1; x < 4; x++) for (let z = 1; z < 4; z++) setColor(g, x, 3, z, x === 2 && z === 2 ? 3 : 4);
  });

const GREEN: [number, number, number, number] = [0x1e5a2a, 0x3a8a3e, 0x7ac46a, 0xc8f0a8];
const MUD: [number, number, number, number] = [0x4a3a1e, 0x6e5a2e, 0x9a8448, 0xd8c890];
const DEEP_RED: [number, number, number, number] = [0x5e0e18, 0x9a1a2a, 0xe0404e, 0xffd090];
const DEEP_BLUE: [number, number, number, number] = [0x101e5e, 0x203a9a, 0x5a7ae0, 0xd0f0ff];

export const POTION_MODELS: Record<PotionId, LootModel> = {
  minorHealthPotion: flask('minor', RED),
  lesserHealthPotion: flask('lesser', RED),
  greaterHealthPotion: flask('greater', RED),
  minorEnergyPotion: flask('minor', BLUE),
  lesserEnergyPotion: flask('lesser', BLUE),
  greaterEnergyPotion: flask('greater', BLUE),
  // An alchemist's (loot/potions.ts): the superior ones the greater's flask, deeper and glowing gold; the cures green
  // and mud-brown, the pox's a pot of salve; each draught its blessing's colour; the philtre a little pink one.
  superiorHealthPotion: flask('greater', DEEP_RED),
  superiorEnergyPotion: flask('greater', DEEP_BLUE),
  antidote: flask('lesser', GREEN),
  purge: flask('minor', MUD),
  poxSalve: salvePot(),
  swiftDraught: flask('lesser', [0x8a7a10, 0xc8b42a, 0xf0e06a, 0xfff6b0]),
  shadowDraught: flask('lesser', [0x1e1428, 0x3a2a4e, 0x5e4a78, 0x9a8ab8]),
  oxDraught: flask('lesser', [0x8a3a0e, 0xc8641e, 0xf0964a, 0xffd0a0]),
  barkDraught: flask('lesser', [0x4a3e30, 0x6e6250, 0x9a8e78, 0xd0c8b0]),
  hawkDraught: flask('lesser', [0x8a6010, 0xd49a20, 0xf8d060, 0xfff0c0]),
  lovePhiltre: flask('minor', [0xa83a6a, 0xe0609a, 0xf8a0c8, 0xffe0f0]),
};

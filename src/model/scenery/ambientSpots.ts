// Where the small life of the wilds is (drawn round the hero:
// view/meshes/wildlife/ambientLife.ts), from the seed, patch by patch of
// ground (LIFE_CELL tiles a side): butterflies over a meadow, a little flock
// of songbirds on open grass, fireflies, rabbits; on a lake's shore,
// dragonflies and frogs; out on open water, fish (now and then leaping);
// each where on open, natural ground (or water), and its own roll. A field's
// fence has a songbird or two perched on it (perchesOn). And when they're
// out: the butterflies, the birds, the rabbits and the dragonflies by day
// (the birds from dawn), the fireflies from dusk through the night, the
// frogs from evening till morning, the fish always. Kept here so what's
// drawn and what's looked for (the cheats' Sights) are the one.

import { hashUnit } from '../../util/random';
import { hourAt } from '../clock';
import { createMeadowDensity } from '../worldgen/meadows';
import type { Tiles } from '../map/tiles';
import type { Field } from '../types';
import { fenceEdges } from '../worldgen/fields';
import { NEIGHBORS_4 } from '../map/grid';

export const LIFE_CELL = 6; // tiles a side of each patch of ground
export type LifeKind = 'butterfly' | 'bird' | 'firefly' | 'rabbit' | 'dragonfly' | 'frog' | 'fish';

export interface LifeSpot {
  kind: LifeKind;
  x: number; // its home, where it wanders round
  z: number;
  seed: number; // its own rolls (0..1)
  perch?: boolean; // a bird on a fence post (else on the ground)
}

export interface LifeWorld {
  seed: number;
  tiles: Tiles;
  isOpenTile(x: number, z: number): boolean;
  // What country each tile is (scenery/biomes.ts, flora's createBiomes), if known: frogs and dragonflies to the
  // marsh's banks first (else any lake's), rabbits to the meadows and the woods' edges, butterflies to the open.
  biomes?: { at(x: number, z: number): string; woods(x: number, z: number): number };
}

// Whether `kind` is out at `minutes`.
export function lifeOut(kind: LifeKind, minutes: number): boolean {
  const hour = hourAt(minutes);
  const [from, till] = OUT[kind];
  return from < till ? hour >= from && hour < till : hour >= from || hour < till;
}

// The hours each is out (from, till: over midnight if till's the earlier).
const OUT: Record<LifeKind, [number, number]> = {
  butterfly: [6.5, 19.5],
  bird: [5, 19.5], // (up with the dawn)
  firefly: [19, 5.5],
  rabbit: [5, 21.5],
  dragonfly: [8.5, 18.5],
  frog: [17, 8],
  fish: [0, 24],
};

// The hour each comes out at its best (for the cheats: noon for the day's, ten at night for the fireflies and frogs).
export const LIFE_HOUR: Record<LifeKind, number> = { butterfly: 12, bird: 12, firefly: 22, rabbit: 12, dragonfly: 12, frog: 22, fish: 12 };

// What lives in patch (cx, cz).
export function lifeIn(world: LifeWorld, cx: number, cz: number, meadow = createMeadowDensity(world.seed)): LifeSpot[] {
  const roll = (salt: number) => hashUnit(cx, cz, world.seed + salt);
  const out: LifeSpot[] = [];
  const spot = (salt: number) => {
    const [x, z] = [Math.floor(cx * LIFE_CELL + roll(salt) * LIFE_CELL), Math.floor(cz * LIFE_CELL + roll(salt + 1) * LIFE_CELL)];
    return world.isOpenTile(x, z) && world.tiles.has(x, z) && world.tiles.surface(x, z) === 'natural' ? { x: x + 0.5, z: z + 0.5 } : null;
  };
  const add = (kind: LifeKind, count: number, salt: number, spread: number, suits: (x: number, z: number) => boolean = () => true) => {
    const at = spot(salt);
    if (!at || !suits(Math.floor(at.x), Math.floor(at.z))) return;
    for (let i = 0; i < count; i++) {
      out.push({ kind, x: at.x + (hashUnit(i, cx, world.seed + salt + 4) - 0.5) * spread, z: at.z + (hashUnit(i, cz, world.seed + salt + 5) - 0.5) * spread, seed: hashUnit(cx * 7 + i, cz * 11, world.seed + salt + 3) });
    }
  };
  const lush = meadow(cx * LIFE_CELL + LIFE_CELL / 2, cz * LIFE_CELL + LIFE_CELL / 2);
  const { biomes } = world;
  const open = (x: number, z: number) => !biomes || ['meadow', 'heath'].includes(biomes.at(x, z));
  const edge = (x: number, z: number) => !biomes || biomes.at(x, z) === 'meadow' || (biomes.at(x, z) !== 'forest' && biomes.at(x, z) !== 'marsh' && biomes.woods(x, z) >= 0.15 && biomes.woods(x, z) <= 0.5);
  if (roll(11) < 0.15 + lush * 0.35) add('butterfly', 1 + Math.floor(roll(12) * 3), 13, 2, open);
  if (roll(21) < 0.14) add('bird', 2 + Math.floor(roll(22) * 4), 23, 1.6);
  if (roll(31) < 0.3 + lush * 0.3) add('firefly', 3 + Math.floor(roll(32) * 6), 33, 4);
  if (roll(41) < 0.12) add('rabbit', 2 + Math.floor(roll(42) * 3), 43, 3, edge);
  // By the water: a few tries at a tile of shore, then each one on shore of its own round it.
  const tries = (salt: number, fits: (x: number, z: number) => boolean) => {
    for (let t = 0; t < 4; t++) {
      const [x, z] = [Math.floor(cx * LIFE_CELL + roll(salt + t * 2) * LIFE_CELL), Math.floor(cz * LIFE_CELL + roll(salt + t * 2 + 1) * LIFE_CELL)];
      if (fits(x, z)) return { x, z };
    }
    return null;
  };
  const near = (kind: LifeKind, count: number, salt: number, fits: (x: number, z: number) => boolean, rather?: (x: number, z: number) => boolean) => {
    // Where it'd rather be; else anywhere it can, now and then (a third as often).
    const at = (rather && tries(salt, (x, z) => fits(x, z) && rather(x, z))) || (!rather || roll(salt + 20) < 0.35 ? tries(salt, fits) : null);
    for (let i = 0; at && i < count; i++) {
      const [x, z] = [at.x + Math.round((hashUnit(i, cx, world.seed + salt + 9) - 0.5) * 3), at.z + Math.round((hashUnit(i, cz, world.seed + salt + 10) - 0.5) * 3)];
      if (i === 0 || fits(x, z)) out.push({ kind, x: (i ? x : at.x) + 0.5, z: (i ? z : at.z) + 0.5, seed: hashUnit(cx * 7 + i, cz * 11, world.seed + salt + 11) });
    }
  };
  const shore = (x: number, z: number) => onLand(world, x, z) && NEIGHBORS_4.some(([dx, dz]) => wet(world, x + dx, z + dz));
  const marsh = biomes && ((x: number, z: number) => biomes.at(x, z) === 'marsh');
  if (roll(51) < 0.5) near('dragonfly', 1 + Math.floor(roll(52) * 2), 53, shore, marsh);
  if (roll(61) < 0.55) near('frog', 2 + Math.floor(roll(62) * 3), 63, shore, marsh);
  if (roll(71) < 0.45) near('fish', 1 + Math.floor(roll(72) * 2), 73, (x, z) => NEIGHBORS_8.every(([dx, dz]) => wet(world, x + dx, z + dz)));
  return out;
}

const NEIGHBORS_8 = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const wet = (world: LifeWorld, x: number, z: number) => world.tiles.has(x, z) && world.tiles.lake(x, z);
const onLand = (world: LifeWorld, x: number, z: number) => world.tiles.has(x, z) && !world.tiles.lake(x, z) && world.tiles.surface(x, z) === 'natural' && world.isOpenTile(x, z);

// The songbirds perched on a field's fence (none on most): each on the middle post of a stretch of it, on the
// tile's edge (x, z: just inside it).
export function perchesOn(field: Field, seed: number): LifeSpot[] {
  const roll = (salt: number) => hashUnit(field.x0, field.z0, seed + salt);
  if (roll(81) > 0.45) return [];
  const edges = fenceEdges(field);
  const count = 1 + Math.floor(roll(82) * 3);
  return Array.from({ length: count }, (_, i) => {
    const { x, z, side } = edges[Math.floor(hashUnit(i, field.x0, seed + 83) * edges.length)];
    const [dx, dz] = NEIGHBORS_4[side];
    return { kind: 'bird' as const, x: x + dx * 0.46, z: z + dz * 0.46, seed: hashUnit(i, field.z0, seed + 84), perch: true };
  }).filter((b, i, all) => all.findIndex((o) => o.x === b.x && o.z === b.z) === i); // (one to a post)
}

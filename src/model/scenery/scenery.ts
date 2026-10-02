// Rocks and landmarks out in the wilds: mossy boulders, layered outcrops,
// fallen logs in the woods, stacked-stone cairns, old dry-stone walls in the
// meadows, and now and then a ring of standing stones. Placed from the seed's
// hashes (not the world's rng: every map stays as it was), on open, dry,
// natural ground, clear of the roads and fields, the villages, the ruins, the
// camps, where the hero sets out and where a foe stands. Each blocks the way
// (a log and a cairn low enough to see over); the grass keeps off them.

import { hashUnit } from '../../util/random';
import { VILLAGE_OUTER_RADIUS, LANE_LENGTH_MAX } from '../constants';
import type { Obstacles } from '../map/obstacles';
import type { MapSize } from '../map/grid';
import type { Surface, Village } from '../types';
import type { Ruin } from '../ruins/ruins';
import type { Camp } from '../camps/camps';
import { createForestDensity } from '../worldgen/trees';

export type SceneryKind = 'boulder' | 'outcrop' | 'log' | 'cairn' | 'wall' | 'menhir';

export interface Scenery {
  kind: SceneryKind;
  x: number; // its first tile (least x, z)
  z: number;
  w: number; // tiles across x
  d: number; // along z
  quarterTurns: number; // how it's turned (a log, a wall: along x when even)
  variant: number; // 0..3: its look
}

export interface SceneryWorld {
  seed: number;
  size: MapSize;
  heightMap: readonly (readonly number[])[];
  surfaceMap: readonly (readonly Surface[])[];
  villages: readonly Village[];
  ruins: readonly Ruin[];
  camps: readonly Camp[];
  hero: { x: number; z: number };
  enemies: ReadonlyArray<{ x: number; z: number }>;
  isOpenTile(x: number, z: number): boolean;
}

const SITE = 13; // tiles a side of each candidate site
const SITE_CHANCE = 0.6;
const CIRCLE_SITE = 90; // a ring of standing stones: one candidate to so many tiles a side
const CIRCLE_CHANCE = 0.45;
const CIRCLE_RADIUS = 3; // tiles from its middle to its stones
const CIRCLE_STONES = 7;
const CIRCLE_TRIES = 12; // spots in each site tried for a ring
const VILLAGE_CLEAR = VILLAGE_OUTER_RADIUS + LANE_LENGTH_MAX + 4; // tiles round a village's well kept clear (its lanes, its fields' near side)
const SPAWN_CLEAR = 8;
const FOE_CLEAR = 2;
// What each blocks: the rounded ones (ROUND) a disc round their middle as wide as their stone (a boulder's reaching 0.4 at
// most, a cairn's 0.36, a standing stone's 0.2, an outcrop's 0.82 from its middle: sceneryVoxels.ts), met as close from
// any side (an outcrop's one disc over its four tiles); a log or a wall a box, along it.
const HALF = { boulder: 0.36, outcrop: 0.76, log: 0.5, cairn: 0.32, wall: 0.5, menhir: 0.2 } as const;
const ROUND: ReadonlySet<SceneryKind> = new Set(['boulder', 'outcrop', 'cairn', 'menhir']);
const ACROSS: Partial<Record<SceneryKind, number>> = { wall: 0.16, log: 0.23 }; // and across a log or a wall: they're narrow (sceneryVoxels.ts: a wall 7 voxels thick, a log 11 across)
const LOW: ReadonlySet<SceneryKind> = new Set(['log', 'cairn']); // low enough to see over

export function placeScenery(world: SceneryWorld): Scenery[] {
  const forest = createForestDensity(world.seed);
  const taken = new Set<string>();
  const out: Scenery[] = [];
  // The ground kept clear (round the villages, the ruins, the camps, the start, the foes), marked once, by tile.
  const { width, depth } = world.size;
  const kept = new Uint8Array(width * depth);
  const keep = (x0: number, z0: number, x1: number, z1: number) => {
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(width - 1, Math.ceil(x1)); x++) kept.fill(1, x * depth + Math.max(0, Math.floor(z0)), x * depth + Math.min(depth - 1, Math.ceil(z1)) + 1);
  };
  const round = (p: { x: number; z: number }, r: number) => keep(p.x - r, p.z - r, p.x + r, p.z + r);
  round(world.hero, SPAWN_CLEAR);
  for (const v of world.villages) round(v, VILLAGE_CLEAR);
  for (const r of world.ruins) keep(r.x - 2, r.z - 2, r.x + r.w + 1, r.z + r.d + 1);
  for (const c of world.camps) round(c, 5);
  for (const e of world.enemies) round(e, FOE_CLEAR);
  const clear = (x: number, z: number) =>
    world.heightMap[x]?.[z] !== undefined &&
    !kept[x * depth + z] &&
    world.isOpenTile(x, z) &&
    world.surfaceMap[x][z] === 'natural' &&
    !taken.has(`${x},${z}`);
  // A footprint all clear and level, a tile round it free of any other piece (never walling a way off: the trees about
  // stand thin).
  const fits = (x: number, z: number, w: number, d: number) => {
    const tier = world.heightMap[x]?.[z];
    for (let i = x - 1; i <= x + w; i++) {
      for (let k = z - 1; k <= z + d; k++) {
        const inside = i >= x && i < x + w && k >= z && k < z + d;
        if (inside && (!clear(i, k) || world.heightMap[i][k] !== tier)) return false;
        if (!inside && taken.has(`${i},${k}`)) return false;
      }
    }
    return true;
  };
  const put = (piece: Scenery) => {
    for (const [i, k] of sceneryTiles(piece)) taken.add(`${i},${k}`);
    out.push(piece);
  };

  // A ring of standing stones, now and then, on open ground (its middle open: to stand in).
  for (let gx = 0; gx * CIRCLE_SITE < world.size.width; gx++) {
    for (let gz = 0; gz * CIRCLE_SITE < world.size.depth; gz++) {
      if (hashUnit(gx, gz, world.seed + 501) >= CIRCLE_CHANCE) continue;
      for (let tri = 0; tri < CIRCLE_TRIES; tri++) {
        // (Its spots in turn, the first clear of trees and bushes: a ring wants open ground.)
        const cx = Math.floor(gx * CIRCLE_SITE + 10 + hashUnit(gx * 31 + tri, gz, world.seed + 502) * (CIRCLE_SITE - 20));
        const cz = Math.floor(gz * CIRCLE_SITE + 10 + hashUnit(gx, gz * 31 + tri, world.seed + 503) * (CIRCLE_SITE - 20));
        const stones = Array.from({ length: CIRCLE_STONES }, (_, i) => {
          const a = (i / CIRCLE_STONES) * Math.PI * 2;
          return [Math.round(cx + Math.cos(a) * CIRCLE_RADIUS), Math.round(cz + Math.sin(a) * CIRCLE_RADIUS)] as const;
        });
        if (forest(cx, cz) >= 0.2 || !stones.every(([x, z]) => fits(x, z, 1, 1)) || !clear(cx, cz)) continue;
        stones.forEach(([x, z], i) => put({ kind: 'menhir', x, z, w: 1, d: 1, quarterTurns: i % 4, variant: Math.floor(hashUnit(x, z, world.seed + 504) * 4) }));
        break;
      }
    }
  }

  // Elsewhere, one piece to a site now and then: what by the ground (logs in the woods, walls in the open).
  for (let gx = 0; gx * SITE < world.size.width; gx++) {
    for (let gz = 0; gz * SITE < world.size.depth; gz++) {
      if (hashUnit(gx, gz, world.seed + 511) >= SITE_CHANCE) continue;
      const x = Math.floor(gx * SITE + 1 + hashUnit(gx, gz, world.seed + 512) * (SITE - 3));
      const z = Math.floor(gz * SITE + 1 + hashUnit(gx, gz, world.seed + 513) * (SITE - 3));
      const roll = hashUnit(gx, gz, world.seed + 514);
      const variant = Math.floor(hashUnit(gx, gz, world.seed + 515) * 4);
      const along = hashUnit(gx, gz, world.seed + 516) < 0.5; // (along x, else z)
      const woods = forest(x, z) >= 0.2;
      const kind: SceneryKind = woods ? (roll < 0.45 ? 'log' : roll < 0.8 ? 'boulder' : 'outcrop') : roll < 0.35 ? 'boulder' : roll < 0.55 ? 'wall' : roll < 0.75 ? 'outcrop' : roll < 0.9 ? 'cairn' : 'log';
      const [w, d] = kind === 'outcrop' ? [2, 2] : kind === 'log' ? (along ? [2, 1] : [1, 2]) : kind === 'wall' ? (along ? [3, 1] : [1, 3]) : [1, 1];
      if (!fits(x, z, w, d)) continue;
      put({ kind, x, z, w, d, quarterTurns: kind === 'log' || kind === 'wall' ? (along ? 0 : 1) : Math.floor(hashUnit(x, z, world.seed + 517) * 4), variant });
    }
  }
  return out;
}

// The tiles a piece stands on.
export const sceneryTiles = (s: Pick<Scenery, 'x' | 'z' | 'w' | 'd'>): Array<[number, number]> =>
  Array.from({ length: s.w * s.d }, (_, i) => [s.x + (i % s.w), s.z + Math.floor(i / s.w)]);

// Each piece in the way: every tile it stands on blocking (a log, a cairn low enough to see over).
export function addSceneryObstacles(obstacles: Obstacles, scenery: readonly Scenery[]): void {
  for (const s of scenery) {
    const across = ACROSS[s.kind];
    const [hx, hz] = across === undefined ? [HALF[s.kind], HALF[s.kind]] : s.w > s.d ? [HALF[s.kind], across] : [across, HALF[s.kind]]; // (narrow across its length)
    const [mx, mz] = [s.x + (s.w - 1) / 2, s.z + (s.d - 1) / 2]; // (its middle: a round one's disc round it)
    for (const [x, z] of sceneryTiles(s)) obstacles.addProp(x, z, hx, LOW.has(s.kind), hz, ROUND.has(s.kind), mx - x, mz - z);
  }
}

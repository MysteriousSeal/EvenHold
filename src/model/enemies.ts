// Enemies: wolf packs in the forests and bandit camps in the open
// countryside, each with one of either near spawn to meet early. They
// wander around home, chase the hero on sight, give up if outrun, and
// attack once within reach. Placed from hashes and
// noise, not the world rng, so they don't change the world.

import { ENEMY_STATS, VILLAGE_OUTER_RADIUS } from './constants';
import type { Camp, CampPiece, CampPieceKind, Enemy, EnemyKind, Surface, Village } from './types';
import { createForestDensity } from './worldgen/trees';
import { hashUnit } from '../util/random';
import { pickOutfit } from './human/equipment';
import { lookAt } from './human/humanoid';
import type { MapSize } from './grid';

interface Sites {
  grid: number; // one candidate site per grid x grid tiles
  chance: number;
  forest: (density: number) => boolean; // which land it likes
  clearance: number; // from villages
}
// Dense enough that walking any direction meets something every so often:
// wolf packs in the woods, fewer out on open ground, and bandit camps in the
// countryside between villages.
const PACKS: Sites = { grid: 18, chance: 0.7, forest: (d) => d >= 0.2, clearance: 14 };
const MEADOW_PACKS: Sites = { grid: 32, chance: 0.35, forest: (d) => d < 0.2, clearance: 14 };
const CAMPS: Sites = { grid: 26, chance: 0.4, forest: (d) => d < 0.15, clearance: 12 };
const SPAWN_CLEARANCE = 20;

export interface EnemyWorld {
  seed: number;
  size: MapSize;
  villages: Village[];
  hero: { x: number; z: number };
  heightMap: number[][];
  surfaceMap: Surface[][];
  isOpenTile(x: number, z: number): boolean;
}

// A fresh enemy of `kind` at (x, z), at home around (homeX, homeZ).
export function makeEnemy(id: number, kind: EnemyKind, x: number, z: number, homeX = x, homeZ = z): Enemy {
  return {
    id,
    kind,
    x,
    z,
    y: 0,
    homeX,
    homeZ,
    hp: ENEMY_STATS[kind].hp,
    state: 'wander',
    target: null,
    restFor: hashUnit(x, z, 3) * 3,
    hurtFor: 0,
    deadFor: 0,
    swingFor: null,
    cooldown: 0,
    path: null,
    pathAge: 0,
    // Bandits: someone different each, in their own mix of bandit gear.
    human: kind === 'bandit' ? { look: lookAt(x, z), equipment: pickOutfit('bandit', x, z) } : null,
  };
}

export function spawnEnemies(world: EnemyWorld): { enemies: Enemy[]; camps: Camp[] } {
  const forest = createForestDensity(world.seed);
  const enemies: Enemy[] = [];
  const camps: Camp[] = [];
  const taken = new Set<string>();
  const open = (x: number, z: number) => world.isOpenTile(x, z) && !taken.has(`${x},${z}`);

  // Up to `count` enemies on open tiles in rings around (cx, cz).
  const group = (kind: EnemyKind, cx: number, cz: number, count: number, salt: number, minRing = 0) => {
    let placed = 0;
    for (let r = minRing; r <= 3 && placed < count; r++) {
      for (let dx = -r; dx <= r && placed < count; dx++) {
        for (let dz = -r; dz <= r && placed < count; dz++) {
          const x = cx + dx;
          const z = cz + dz;
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r || !open(x, z) || hashUnit(x, z, salt) >= 0.6) continue;
          taken.add(`${x},${z}`);
          enemies.push(makeEnemy(enemies.length, kind, x, z, cx, cz));
          placed++;
        }
      }
    }
  };
  // A camp needs a flat 5x5 patch of open grass; bandits start inside.
  const camp = (cx: number, cz: number, count: number, salt: number): boolean => {
    const tier = world.heightMap[cx]?.[cz];
    if (tier === undefined) return false; // off the map (sites near its far edge)
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const x = cx + dx;
        const z = cz + dz;
        if (!open(x, z) || world.surfaceMap[x]?.[z] !== 'natural' || world.heightMap[x][z] !== tier) return false;
      }
    }
    const site: Camp = { x: cx, z: cz, quarterTurns: Math.floor(hashUnit(cx, cz, salt + 9) * 4) };
    camps.push(site);
    for (const piece of campPieces(site)) taken.add(`${piece.x},${piece.z}`);
    group('bandit', cx, cz, count, salt, 1);
    return true;
  };

  // One of each a short walk from spawn, so there's something to fight right away.
  const { x: sx, z: sz } = world.hero;
  group('wolf', Math.round(sx + 7), Math.round(sz - 6), 2, 41);
  // A camp takes the nearest good site within `reach` of its spot: a flat,
  // open 5x5 is rarely exactly where you'd like it.
  const campNear = (x: number, z: number, reach: number, count: number, salt: number) => {
    for (let r = 0; r <= reach; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) === r && camp(x + dx, z + dz, count, salt)) return;
        }
      }
    }
  };
  campNear(Math.round(sx - 9), Math.round(sz + 9), 12, 3, 47);

  const scatter = (sites: Sites, salt: number, place: (x: number, z: number, big: boolean) => void) => {
    for (let gx = 0; gx * sites.grid < world.size.width; gx++) {
      for (let gz = 0; gz * sites.grid < world.size.depth; gz++) {
        if (hashUnit(gx, gz, salt) >= sites.chance) continue;
        const x = Math.floor(gx * sites.grid + hashUnit(gx, gz, salt + 1) * sites.grid);
        const z = Math.floor(gz * sites.grid + hashUnit(gx, gz, salt + 2) * sites.grid);
        if (!sites.forest(forest(x, z))) continue;
        if (Math.hypot(x - sx, z - sz) < SPAWN_CLEARANCE) continue;
        if (world.villages.some((v) => Math.hypot(v.x - x, v.z - z) < sites.clearance + VILLAGE_OUTER_RADIUS)) continue;
        place(x, z, hashUnit(gx, gz, salt + 3) < 0.5);
      }
    }
  };
  scatter(PACKS, 42, (x, z, big) => group('wolf', x, z, big ? 3 : 2, 46));
  scatter(MEADOW_PACKS, 62, (x, z) => group('wolf', x, z, 2, 66));
  scatter(CAMPS, 52, (x, z, big) => campNear(x, z, 5, big ? 4 : 2, 56));
  return { enemies, camps };
}

// One frame of a living enemy: chase the hero when close (once in reach it
// attacks instead: a bandit swings, a wolf lunges and bites), otherwise wander between spots around home, resting in
// between. `move` walks it with collisions and returns whether it got anywhere.
export function stepEnemy(
  enemy: Enemy,
  hero: { x: number; z: number },
  dt: number,
  move: (enemy: Enemy, dx: number, dz: number) => boolean,
  steer: (enemy: Enemy) => { x: number; z: number } = () => hero,
): void {
  const stats = ENEMY_STATS[enemy.kind];
  enemy.cooldown = Math.max(0, enemy.cooldown - dt);
  if (enemy.swingFor !== null) {
    enemy.swingFor += dt;
    if (enemy.swingFor >= stats.swing) {
      enemy.swingFor = null;
      enemy.cooldown = stats.cooldown;
    }
    return; // committed to the blow
  }

  const toHero = Math.hypot(hero.x - enemy.x, hero.z - enemy.z);
  if (enemy.state === 'wander' && toHero < stats.sight) enemy.state = 'chase';
  if (enemy.state === 'chase' && toHero > stats.giveUp) {
    enemy.state = 'wander';
    enemy.target = { x: enemy.homeX, z: enemy.homeZ };
  }

  if (enemy.state === 'chase') {
    // A small margin: stepping exactly to `stop` can leave it a hair outside,
    // which would never count as in reach.
    if (toHero > stats.stop + 0.02) {
      // Toward the hero, or the next point on the way around what's between.
      const goal = steer(enemy);
      const d = Math.hypot(goal.x - enemy.x, goal.z - enemy.z);
      const step = Math.min(stats.run * dt, goal === hero ? toHero - stats.stop : d);
      if (d > 1e-4) move(enemy, ((goal.x - enemy.x) / d) * step, ((goal.z - enemy.z) / d) * step);
    } else if (enemy.cooldown === 0) {
      enemy.swingFor = 0;
    }
    return;
  }

  if (!enemy.target) {
    enemy.restFor -= dt;
    if (enemy.restFor > 0) return;
    const t = enemy.id * 7.31 + enemy.x;
    enemy.target = {
      x: enemy.homeX + (hashUnit(Math.floor(t * 10), enemy.id, 5) - 0.5) * 2 * stats.wander,
      z: enemy.homeZ + (hashUnit(Math.floor(t * 10), enemy.id, 6) - 0.5) * 2 * stats.wander,
    };
  }
  const dx = enemy.target.x - enemy.x;
  const dz = enemy.target.z - enemy.z;
  const d = Math.hypot(dx, dz);
  const step = Math.min(stats.walk * dt, d);
  // Arrived, or stuck against something: rest a while, then go elsewhere.
  if (d < 0.05 || !move(enemy, (dx / d) * step, (dz / d) * step)) {
    enemy.target = null;
    enemy.restFor = 1.5 + hashUnit(enemy.id, Math.floor(enemy.x * 10), 7) * 2.5;
  }
}

// Turns a local camp offset by the camp's quarter turns (as three.js turns an
// instance: (x, z) -> (z, -x) per turn).
function turn(dx: number, dz: number, quarterTurns: number): [number, number] {
  let [x, z] = [dx, dz];
  for (let q = 0; q < quarterTurns; q++) [x, z] = [z, -x];
  return [x, z];
}

// The camp's layout, local offsets before turning (entrance at local +Z):
// the fire in the middle, two tents and the weapon rack along the back, crates
// on one side and the loot pile on the other.
const LAYOUT: Array<[CampPieceKind, number, number]> = [
  ['fire', 0, 0],
  ['tent', -1, -2],
  ['tent', 1, -2],
  ['rack', 0, -2],
  ['crates', -2, 0],
  ['loot', 2, 0],
];

export function campPieces(camp: Camp): CampPiece[] {
  return LAYOUT.map(([kind, dx, dz]) => {
    const [ox, oz] = turn(dx, dz, camp.quarterTurns);
    return { kind, x: camp.x + ox, z: camp.z + oz, quarterTurns: camp.quarterTurns };
  });
}

// The palisade: every outer edge of the camp's border tiles, except the
// entrance (the middle of the local +Z side), as (tile, side) with sides
// in NEIGHBORS_4 order (+x, -x, +z, -z).
export function campPalisade(camp: Camp): Array<{ x: number; z: number; side: number }> {
  const [ex, ez] = turn(0, 2, camp.quarterTurns);
  const edges: Array<{ x: number; z: number; side: number }> = [];
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (dx === ex && dz === ez) continue;
      if (dx === 2) edges.push({ x: camp.x + dx, z: camp.z + dz, side: 0 });
      if (dx === -2) edges.push({ x: camp.x + dx, z: camp.z + dz, side: 1 });
      if (dz === 2) edges.push({ x: camp.x + dx, z: camp.z + dz, side: 2 });
      if (dz === -2) edges.push({ x: camp.x + dx, z: camp.z + dz, side: 3 });
    }
  }
  return edges;
}

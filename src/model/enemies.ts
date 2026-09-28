// Enemies: wolf packs in the forests and bandit camps in the open
// countryside, each with one of either near spawn to meet early. They
// wander around home, chase the hero on sight and give up if outrun;
// bandits also swing at the hero once within reach. Placed from hashes and
// noise, not the world rng, so they don't change the world.

import { BANDIT_SWING_COOLDOWN, BANDIT_SWING_TIME, ENEMY_STATS, VILLAGE_OUTER_RADIUS } from './constants';
import type { Camp, Enemy, EnemyKind, Village } from './types';
import { createForestDensity } from './worldgen/trees';
import { hashUnit } from '../util/random';
import type { MapSize } from './grid';

interface Sites {
  grid: number; // one candidate site per grid x grid tiles
  chance: number;
  forest: (density: number) => boolean; // which land it likes
  clearance: number; // from villages
}
const PACKS: Sites = { grid: 24, chance: 0.6, forest: (d) => d >= 0.25, clearance: 18 };
const CAMPS: Sites = { grid: 40, chance: 0.35, forest: (d) => d < 0.15, clearance: 20 };
const SPAWN_CLEARANCE = 20;

export interface EnemyWorld {
  seed: number;
  size: MapSize;
  villages: Village[];
  hero: { x: number; z: number };
  isOpenTile(x: number, z: number): boolean;
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
          enemies.push({
            id: enemies.length,
            kind,
            x,
            z,
            y: 0,
            homeX: cx,
            homeZ: cz,
            hp: ENEMY_STATS[kind].hp,
            state: 'wander',
            target: null,
            restFor: hashUnit(x, z, 3) * 3,
            hurtFor: 0,
            deadFor: 0,
            swingFor: null,
            cooldown: 0,
          });
          placed++;
        }
      }
    }
  };
  // A camp: fire in the middle, tent beside it, bandits around the fire.
  const camp = (cx: number, cz: number, count: number, salt: number) => {
    if (!open(cx, cz) || !open(cx + 1, cz)) return;
    camps.push({ x: cx, z: cz, tentX: cx + 1, tentZ: cz });
    taken.add(`${cx},${cz}`);
    taken.add(`${cx + 1},${cz}`);
    group('bandit', cx, cz, count, salt, 1);
  };

  // One of each a short walk from spawn, so there's something to fight right away.
  const { x: sx, z: sz } = world.hero;
  group('wolf', Math.round(sx + 7), Math.round(sz - 6), 2, 41);
  camp(Math.round(sx - 8), Math.round(sz + 7), 3, 47);

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
  scatter(CAMPS, 52, (x, z, big) => camp(x, z, big ? 4 : 2, 56));
  return { enemies, camps };
}

// One frame of a living enemy: chase the hero when close (a bandit in reach
// swings instead), otherwise wander between spots around home, resting in
// between. `move` walks it with collisions and returns whether it got anywhere.
export function stepEnemy(
  enemy: Enemy,
  hero: { x: number; z: number },
  dt: number,
  move: (enemy: Enemy, dx: number, dz: number) => boolean,
): void {
  const stats = ENEMY_STATS[enemy.kind];
  enemy.cooldown = Math.max(0, enemy.cooldown - dt);
  if (enemy.swingFor !== null) {
    enemy.swingFor += dt;
    if (enemy.swingFor >= BANDIT_SWING_TIME) {
      enemy.swingFor = null;
      enemy.cooldown = BANDIT_SWING_COOLDOWN;
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
      const step = Math.min(stats.run * dt, toHero - stats.stop);
      move(enemy, ((hero.x - enemy.x) / toHero) * step, ((hero.z - enemy.z) / toHero) * step);
    } else if (enemy.kind === 'bandit' && enemy.cooldown === 0) {
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

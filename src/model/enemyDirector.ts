// Runs the enemies near the hero each frame, in the world's obstacles: each
// thinks (enemies.ts stepEnemy) and moves with collisions, sliding along
// walls; they're solid to each other and ease apart when they overlap; a
// chaser heads straight for its quarry when the way is clear, else along a
// path around (pathfinding.ts); and it needs a clear line of sight to see
// the hero. The dead lie a while, then are gone.

import {
  ENEMY_ACTIVE_RADIUS,
  ENEMY_CORPSE_TIME,
  ENEMY_PATH_RADIUS,
  ENEMY_PATH_REFRESH,
  ENEMY_SEPARATION_SPEED,
  ENEMY_STATS,
} from './constants';
import { stepEnemy, type EnemyActions } from './enemies';
import type { MapSize } from './grid';
import { clearLine, type Obstacles, type Point } from './obstacles';
import { findPath } from './pathfinding';
import type { Enemy, Hero } from './types';

const EDGE_MARGIN = 0.4; // how close to the map's edge anyone may go

export class EnemyDirector {
  frozen = false; // dev cheat: enemies stand still
  private readonly actions: EnemyActions = {
    move: (e, dx, dz) => this.move(e, dx, dz),
    steer: (e, quarry) => this.chaseGoal(e, quarry),
    sees: (e) => this.canSee(e),
    strike: (e) => this.onStrike(e),
  };

  constructor(
    private readonly enemies: Enemy[],
    private readonly hero: Hero,
    private readonly obstacles: Obstacles,
    private readonly size: MapSize,
    private readonly groundY: (x: number, z: number) => number,
    private readonly onStrike: (enemy: Enemy) => void, // an enemy's blow lands (reach is the model's to judge)
  ) {}

  update(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!this.nearHero(enemy)) continue;
      enemy.hurtFor = Math.max(0, enemy.hurtFor - dt);
      if (enemy.state === 'dead') {
        enemy.deadFor += dt;
        if (enemy.deadFor >= ENEMY_CORPSE_TIME) this.enemies.splice(i, 1);
        continue;
      }
      enemy.pathAge += dt;
      if (!this.frozen) stepEnemy(enemy, this.hero, dt, this.actions);
    }
    if (!this.frozen) this.separate(dt);
  }

  // Moves an enemy with the same collisions as the hero (axis by axis, so it
  // slides along obstacles), never into another; returns whether it moved.
  move(enemy: Enemy, dx: number, dz: number): boolean {
    const x0 = enemy.x;
    const z0 = enemy.z;
    const r = ENEMY_STATS[enemy.kind].radius;
    const nx = Math.min(this.size.width - 1 - EDGE_MARGIN, Math.max(EDGE_MARGIN, enemy.x + dx));
    const nz = Math.min(this.size.depth - 1 - EDGE_MARGIN, Math.max(EDGE_MARGIN, enemy.z + dz));
    if (!this.obstacles.isBlocked(nx, enemy.z, r) && !this.bumpsOther(enemy, nx, enemy.z)) enemy.x = nx;
    if (!this.obstacles.isBlocked(enemy.x, nz, r) && !this.bumpsOther(enemy, enemy.x, nz)) enemy.z = nz;
    enemy.y = this.groundY(enemy.x, enemy.z);
    return enemy.x !== x0 || enemy.z !== z0;
  }

  private nearHero(enemy: Enemy): boolean {
    return Math.abs(enemy.x - this.hero.x) <= ENEMY_ACTIVE_RADIUS && Math.abs(enemy.z - this.hero.z) <= ENEMY_ACTIVE_RADIUS;
  }

  // Living enemies are solid to each other, by the same rule as for the hero:
  // no step that overlaps another and brings the two closer.
  private bumpsOther(enemy: Enemy, x: number, z: number): boolean {
    return this.enemies.some((other) => {
      if (other === enemy || other.state === 'dead') return false;
      const reach = ENEMY_STATS[enemy.kind].radius + ENEMY_STATS[other.kind].radius;
      if (Math.abs(other.x - x) >= reach || Math.abs(other.z - z) >= reach) return false;
      const after = Math.hypot(other.x - x, other.z - z);
      return after < reach && after < Math.hypot(other.x - enemy.x, other.z - enemy.z);
    });
  }

  // Enemies that overlap (spawned close, or shoved together) ease apart,
  // each moving half the way, so a group closing in spreads around the hero.
  private separate(dt: number): void {
    const near = this.enemies.filter((e) => e.state !== 'dead' && this.nearHero(e));
    for (let i = 0; i < near.length; i++) {
      for (let j = i + 1; j < near.length; j++) {
        const a = near[i];
        const b = near[j];
        const reach = ENEMY_STATS[a.kind].radius + ENEMY_STATS[b.kind].radius;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d >= reach) continue;
        // Exactly on top of each other: part along a direction from their ids.
        const [ux, uz] = d > 1e-6 ? [dx / d, dz / d] : [Math.cos(a.id + b.id), Math.sin(a.id + b.id)];
        const push = Math.min(reach - d, ENEMY_SEPARATION_SPEED * dt) / 2;
        this.move(a, -ux * push, -uz * push);
        this.move(b, ux * push, uz * push);
      }
    }
  }

  // Where a chaser heads for `quarry`: straight at it when nothing's in the
  // way, else the next tile of a path around, found afresh twice a second
  // so it follows along. With no way through, the path ends as close as it
  // gets, and the enemy waits there.
  private chaseGoal(enemy: Enemy, quarry: Point): Point {
    const r = ENEMY_STATS[enemy.kind].radius;
    const free = (x: number, z: number) => !this.obstacles.isBlocked(x, z, r);
    if (clearLine(enemy, quarry, free)) {
      enemy.path = null;
      return quarry;
    }
    if (!enemy.path || enemy.pathAge > ENEMY_PATH_REFRESH) {
      enemy.path = findPath(enemy, quarry, ENEMY_PATH_RADIUS, free);
      enemy.pathAge = 0;
    }
    const path = enemy.path;
    while (path.length > 0 && Math.hypot(path[0].x - enemy.x, path[0].z - enemy.z) < 0.12) path.shift();
    return path[0] ?? enemy;
  }

  // Whether an enemy can see the hero: nothing solid on the line between,
  // checked in fine steps so a thin fence can't slip between two.
  private canSee(enemy: Enemy): boolean {
    return clearLine(enemy, this.hero, (x, z) => !this.obstacles.blocksSight(x, z), 0.05);
  }
}

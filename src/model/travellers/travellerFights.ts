// Travellers and the foes of the wilds (travellers.ts). A foe that isn't set
// on the hero goes after a traveller it sees nearer than the hero (the enemy
// director's prey: chasing, seeing and striking them as it would the hero),
// till they're down or it's lost them. Guards go for any foe near them that's
// set on someone (or not to be trusted near: all but the passive), walking
// off the road to it, blow after blow, and back to the road once it's dead.
// A foe a guard strikes turns on them. Only where the hero is (the foes there
// awake): the rest of the road's quiet.

import { ENEMY_ACTIVE_RADIUS, ENEMY_STATS } from '../constants';
import type { Enemy } from '../types';
import { WALK, onRoadSide, turnToward, type Traveller, type Travellers } from './travellers';
import type { Road } from '../worldgen/roads';
import { FIRST_MOB_ID } from '../quests/questBook';

const GUARD_SIGHT = 5; // tiles: a foe this near a guard, they go for it
const GUARD_RUN = 2.1; // tiles a second, after a foe
const GUARD_REACH = 0.75; // tiles: their blow reaches this far
const SWING = 0.8; // seconds a guard's blow takes (it lands halfway)
const COOLDOWN = 1.2; // seconds between their blows

export class TravellerFights {
  private readonly hunting = new WeakMap<Enemy, Traveller>(); // whom each foe's after (a traveller), while it is

  constructor(
    private readonly travellers: Travellers,
    private readonly roads: readonly Road[],
    private readonly hero: { x: number; z: number },
    private readonly groundY: (x: number, z: number) => number,
    private readonly slain: (enemy: Enemy) => void, // a foe a guard's slain (the world's, for good)
  ) {}

  // Whom `enemy` is after, if a traveller (null: the hero, as ever).
  of = (enemy: Enemy): Traveller | null => {
    const kept = this.hunting.get(enemy);
    const stats = ENEMY_STATS[enemy.kind];
    if (kept && kept.down === null && Math.hypot(kept.x - enemy.x, kept.z - enemy.z) < stats.giveUp) return kept;
    this.hunting.delete(enemy);
    if (enemy.state !== 'wander' || stats.passive) return null; // (set on the hero already; or one that never starts it)
    const toHero = Math.hypot(this.hero.x - enemy.x, this.hero.z - enemy.z);
    let best: Traveller | null = null;
    let near = Math.min(stats.sight, toHero);
    for (const t of this.travellers.standing) {
      const d = Math.hypot(t.x - enemy.x, t.z - enemy.z);
      if (d < near) [best, near] = [t, d];
    }
    if (best) this.hunting.set(enemy, best);
    return best;
  };

  // A foe's blow landing on the traveller it's after, if they're still in its reach.
  struck = (enemy: Enemy, prey: { x: number; z: number }): void => {
    const t = prey as Traveller;
    if (t.down !== null || Math.hypot(t.x - enemy.x, t.z - enemy.z) > ENEMY_STATS[enemy.kind].stop + 0.25) return;
    hurt(t, enemy.damage);
  };

  // The guards near the hero, after the foes near them: each frame.
  update(dt: number, enemies: readonly Enemy[]): void {
    const near = (p: { x: number; z: number }) => Math.abs(p.x - this.hero.x) <= ENEMY_ACTIVE_RADIUS && Math.abs(p.z - this.hero.z) <= ENEMY_ACTIVE_RADIUS;
    const awake = enemies.filter((e) => e.state !== 'dead' && near(e));
    for (const guard of this.travellers.standing) {
      if (guard.role !== 'guard' || !near(guard)) continue;
      const foe = this.foeFor(guard, awake);
      if (foe) this.fight(guard, foe, dt);
      else if (guard.off) this.backToRoad(guard, dt);
    }
  }

  // The foe a guard goes for: the nearest within sight that's set on someone, or would be (not a passive one left be).
  private foeFor(guard: Traveller, awake: readonly Enemy[]): Enemy | null {
    let best: Enemy | null = null;
    let near = GUARD_SIGHT;
    for (const e of awake) {
      if (ENEMY_STATS[e.kind].passive && e.state !== 'chase') continue;
      const d = Math.hypot(e.x - guard.x, e.z - guard.z);
      if (d < near) [best, near] = [e, d];
    }
    return best;
  }

  // Off the road after it; in reach, a blow (landing halfway through), and another once they've their breath.
  private fight(guard: Traveller, foe: Enemy, dt: number): void {
    guard.off ??= { x: guard.x, z: guard.z };
    const [dx, dz] = [foe.x - guard.x, foe.z - guard.z];
    const d = Math.hypot(dx, dz);
    guard.facing = turnToward(guard.facing, Math.atan2(dx, dz), dt);
    if (guard.swingFor !== null) {
      const before = guard.swingFor;
      guard.swingFor += dt;
      if (before < SWING / 2 && guard.swingFor >= SWING / 2 && d <= GUARD_REACH + 0.25) this.blow(guard, foe);
      if (guard.swingFor >= SWING) [guard.swingFor, guard.cooldown] = [null, COOLDOWN];
      return;
    }
    if (d > GUARD_REACH) {
      const step = Math.min(GUARD_RUN * dt, d - GUARD_REACH);
      this.move(guard, (dx / d) * step, (dz / d) * step);
    } else if (guard.cooldown === 0) guard.swingFor = 0;
  }

  // A guard's blow: off its health, a flash; turned on them (if it lives), slain for good (if not).
  private blow(guard: Traveller, foe: Enemy): void {
    foe.hp -= guard.damage;
    foe.hurtFor = 0.25;
    foe.swingFor = null;
    if (foe.hp <= 0) {
      foe.state = 'dead';
      this.hunting.delete(foe);
      if (foe.id < FIRST_MOB_ID) this.slain(foe); // (a quest's marked foes aren't the world's)
      return;
    }
    foe.state = 'chase';
    this.hunting.set(foe, guard);
  }

  // No foe left: back to where they left the road, and on along it.
  private backToRoad(guard: Traveller, dt: number): void {
    const at = onRoadSide(this.roads[guard.road], guard.along, guard.way);
    const [dx, dz] = [at.x - guard.x, at.z - guard.z];
    const d = Math.hypot(dx, dz);
    if (d < 0.1) return void (guard.off = null);
    const step = Math.min(WALK * 1.5 * dt, d);
    guard.facing = turnToward(guard.facing, Math.atan2(dx, dz), dt);
    this.move(guard, (dx / d) * step, (dz / d) * step);
  }

  private move(t: Traveller, dx: number, dz: number): void {
    t.x += dx;
    t.z += dz;
    t.y = this.groundY(t.x, t.z);
  }
}

// A traveller hurt by `damage`: a flash; out of health, brought down (travellers.ts takes them away a while after).
export function hurt(t: Traveller, damage: number): void {
  t.hp = Math.max(0, t.hp - damage);
  t.hurtFor = 0.25;
  if (t.hp > 0) return;
  [t.down, t.off, t.swingFor] = [0, null, null];
}

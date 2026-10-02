// The guards on the roads and the foes of the wilds (travellers.ts). The foes
// leave travellers be; the guards don't leave the foes be: any near them
// that's set on the hero (or not to be trusted near: all but the passive),
// they walk off the road to, blow after blow, and back to the road once it's
// dead. Only where the hero is (the foes there awake): the rest of the
// road's quiet.

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
  constructor(
    private readonly travellers: Travellers,
    private readonly roads: readonly Road[],
    private readonly hero: { x: number; z: number },
    private readonly groundY: (x: number, z: number) => number,
    private readonly slain: (enemy: Enemy) => void, // a foe a guard's slain (the world's, for good)
  ) {}

  // The guards near the hero, after the foes near them: each frame.
  update(dt: number, enemies: readonly Enemy[]): void {
    const near = (p: { x: number; z: number }) => Math.abs(p.x - this.hero.x) <= ENEMY_ACTIVE_RADIUS && Math.abs(p.z - this.hero.z) <= ENEMY_ACTIVE_RADIUS;
    const awake = enemies.filter((e) => e.state !== 'dead' && near(e));
    for (const guard of this.travellers.list) {
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

  // A guard's blow: off its health, a flash; slain for good, if that's the last of it.
  private blow(guard: Traveller, foe: Enemy): void {
    foe.hp -= guard.damage;
    foe.hurtFor = 0.25;
    foe.swingFor = null;
    if (foe.hp > 0) return;
    foe.state = 'dead';
    if (foe.id < FIRST_MOB_ID) this.slain(foe); // (a quest's marked foes aren't the world's)
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

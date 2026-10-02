// Travellers on the roads between the villages (worldgen/roads.ts): pedlars
// with their wares (pedlarShop.ts), pilgrims and wanderers with a word to
// say, and guards walking their beat two by two. One or two parties to a
// road, set out from the seed, walking on and on: at a village, on along
// another of its roads (back the way they came, if it has no other). The
// hero close by, they stop for a word, turned to them.
//
// Foes go after them (wolves, bandits, a ghost: travellerFights.ts), and the
// guards fight what they meet. Brought down, they lie a moment and are gone,
// another of their kind setting out from a village a while after. They're
// the seed's, not kept in the save: they set out afresh each time.

import { hashUnit, mulberry32 } from '../../util/random';
import type { Road } from '../worldgen/roads';
import type { Humanoid } from '../human/humanoid';
import { lookAt } from '../human/humanoid';
import { pickOutfit } from '../human/equipment';
import { nameAt } from '../npcs/npcs';
import { enemyLevel } from '../enemies/enemyLevels';
import type { Enemy } from '../types';
import { TravellerFights } from './travellerFights';

export type TravellerRole = 'pedlar' | 'pilgrim' | 'guard';

export interface Traveller extends Humanoid {
  id: number;
  role: TravellerRole;
  name: string;
  where: null; // (always outdoors: as villagers are, for what talks to them)
  road: number; // the road they're on, by index
  along: number; // how far along its route (tiles, from its start)
  way: 1 | -1; // which way along it they're going
  x: number;
  z: number;
  y: number;
  facing: number;
  level: number; // from how far out they walk (as foes are: their blows, and their health)
  hp: number;
  maxHp: number;
  damage: number; // a guard's blow
  hurtFor: number; // seconds left of the hit flash
  swingFor: number | null; // into a blow (a guard's), or null
  cooldown: number; // before the next blow
  off: { x: number; z: number } | null; // off the road (a guard after a foe), else on it
  down: number | null; // seconds since brought down, or null standing
  leader: number | null; // a guard following another (their partner, by id), a pace behind
  waited: number; // seconds waited on someone in their way
}

export const WALK = 0.9; // tiles a second along the road
export const STOP_FOR_HERO = 1.6; // tiles: the hero this close, they stop for a word
const TURN = 6; // radians a second they turn
const GONE_AFTER = 4; // seconds lying, brought down, before they're gone
export const BACK_AFTER = 90; // seconds before another of their kind sets out in their place
const FOLLOW = 1.2; // tiles a guard follows their partner by
const KEEP = 0.22; // tiles to the side of the road's middle they keep to (their right)
const ROOM = 0.42; // tiles: no nearer someone else than this, walking (they wait, rather than walk into them)
const SEEN = 40; // tiles from the hero they keep clear of each other (past it, no one's there to see)
const GIVE_WAY = 1.5; // seconds waited on someone in the way before squeezing past
const HEALTH: Record<TravellerRole, number> = { pedlar: 8, pilgrim: 8, guard: 18 };
const GUARD_DAMAGE = 3;
export const PEDLAR_KEY = 1_000_000; // a pedlar's shop's key among the shops (theirs, by id, past every door's)

// Where `along` puts a walker on a road: between its tiles, and which way that faces.
export function onRoad(road: Road, along: number): { x: number; z: number; facing: number } {
  const last = road.route.length - 1;
  const a = Math.max(0, Math.min(last, along));
  const i = Math.min(last - 1, Math.floor(a));
  const [x0, z0] = road.route[Math.max(0, i)];
  const [x1, z1] = road.route[Math.max(0, i + 1)] ?? road.route[last];
  const t = a - i;
  return { x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, facing: Math.atan2(x1 - x0, z1 - z0) };
}

// Where a walker going `way` along a road is: on its right-hand side of the middle (KEEP), so those going the other
// way pass them by.
export function onRoadSide(road: Road, along: number, way: 1 | -1): { x: number; z: number; facing: number } {
  const at = onRoad(road, along);
  const heading = way > 0 ? at.facing : at.facing + Math.PI;
  return { x: at.x - Math.cos(heading) * KEEP, z: at.z + Math.sin(heading) * KEEP, facing: heading };
}

// The roads from each village, by index (a village's roads, each with which of its ends is the village's).
export function roadsFrom(roads: readonly Road[], villages: number): Array<Array<{ road: number; start: boolean }>> {
  const from = Array.from({ length: villages }, () => [] as Array<{ road: number; start: boolean }>);
  roads.forEach((r, road) => {
    from[r.from].push({ road, start: true });
    from[r.to].push({ road, start: false });
  });
  return from;
}

// The travellers the seed sets out: one or two parties to a road (a pedlar, a pilgrim, or two guards), somewhere along it.
export function spawnTravellers(seed: number, roads: readonly Road[], spawn: { x: number; z: number }): Traveller[] {
  const out: Traveller[] = [];
  roads.forEach((road, r) => {
    const rng = mulberry32((seed * 7919 + r * 104729) | 0);
    const parties = rng() < 0.5 ? 1 : 2;
    for (let p = 0; p < parties; p++) {
      const roll = rng();
      const role: TravellerRole = roll < 0.45 ? 'pedlar' : roll < 0.8 ? 'pilgrim' : 'guard';
      const along = rng() * (road.route.length - 1);
      const way = rng() < 0.5 ? 1 : -1;
      const first = makeTraveller(out.length, role, r, along, way, roads, seed, spawn, null);
      out.push(first);
      if (role === 'guard') out.push(makeTraveller(out.length, 'guard', r, along - way * FOLLOW, way, roads, seed, spawn, first.id));
    }
  });
  return out;
}

// `spawn`: where the hero first set out (the further from it, the higher their level, as foes').
export function makeTraveller(id: number, role: TravellerRole, road: number, along: number, way: 1 | -1, roads: readonly Road[], seed: number, spawn: { x: number; z: number }, leader: number | null, kept?: number): Traveller {
  const at = onRoadSide(roads[road], Math.max(0, Math.min(roads[road].route.length - 1, along)), way);
  const look = lookAt(id * 13 + 5, id * 7 + 3, seed + 31, role === 'guard' ? 0.15 : 0.45); // (who they are: theirs alone, wherever they walk)
  const level = kept ?? enemyLevel(spawn, at.x, at.z, id); // (theirs from where they set out: kept, walking on)
  const maxHp = HEALTH[role] + (level - 1) * (role === 'guard' ? 3 : 1);
  return {
    id,
    role,
    name: nameAt(id * 13 + 5, id * 7 + 3, seed + 31, look.build),
    where: null,
    look,
    equipment: pickOutfit(role, id * 17 + 1, id * 11 + 2),
    road,
    along: Math.max(0, Math.min(roads[road].route.length - 1, along)),
    way,
    x: at.x,
    z: at.z,
    y: 0,
    facing: at.facing,
    level,
    hp: maxHp,
    maxHp,
    damage: GUARD_DAMAGE + Math.floor(level / 3),
    hurtFor: 0,
    swingFor: null,
    cooldown: 0,
    off: null,
    down: null,
    leader,
    waited: 0,
  };
}

// The world's travellers, walking: each frame, along their roads (on to another at a village), stopped for the hero
// close by; brought down, gone a while after, and then another setting out in their place.
export class Travellers {
  readonly list: Traveller[];
  readonly fights: TravellerFights; // the foes after them, and the guards after the foes (the enemy director's prey)
  private readonly from: ReturnType<typeof roadsFrom>;
  private readonly gone: Array<{ role: TravellerRole; leader: boolean; in: number }> = []; // those brought down: when another of their kind sets out
  private nextId: number;

  constructor(
    private readonly seed: number,
    readonly roads: readonly Road[], // the roads they walk (worldgen/roads.ts)
    villages: number, // how many
    private readonly spawn: { x: number; z: number }, // where the hero first set out (for their levels)
    private readonly hero: { x: number; z: number },
    private readonly groundY: (x: number, z: number) => number,
    slain: (enemy: Enemy) => void, // a foe a guard's slain
  ) {
    this.fights = new TravellerFights(this, roads, hero, groundY, slain);
    this.list = spawnTravellers(seed, roads, spawn);
    this.from = roadsFrom(roads, villages);
    this.nextId = this.list.length;
    for (const t of this.list) t.y = groundY(t.x, t.z);
  }

  // Where everyone is, for the save: each on their road (how far along, which way), their health; those down left
  // out, with those still to set out again (and when).
  save(): { next: number; on: Array<[number, TravellerRole, number, number, 1 | -1, number, number | null, number]>; gone: Array<[TravellerRole, boolean, number]> } {
    return {
      next: this.nextId,
      on: this.list.filter((t) => t.down === null).map((t) => [t.id, t.role, t.road, Math.round(t.along * 100) / 100, t.way, t.hp, t.leader, t.level]),
      gone: [...this.gone.map((g): [TravellerRole, boolean, number] => [g.role, g.leader, Math.round(g.in)]), ...this.list.filter((t) => t.down !== null).map((t): [TravellerRole, boolean, number] => [t.role, t.leader === null, BACK_AFTER])],
    };
  }

  // Everyone back where the save had them (what doesn't fit this world's roads, left as the seed has it).
  load(saved: ReturnType<Travellers['save']>): void {
    const roles: readonly string[] = ['pedlar', 'pilgrim', 'guard'];
    const on = (Array.isArray(saved?.on) ? saved.on : []).filter(
      ([id, role, road, along, way, hp]) => Number.isInteger(id) && roles.includes(role) && this.roads[road] !== undefined && Number.isFinite(along) && (way === 1 || way === -1) && Number.isFinite(hp),
    );
    if (on.length === 0) return;
    this.list.splice(0, this.list.length, ...on.map(([id, role, road, along, way, hp, leader, level]) => {
      const t = makeTraveller(id, role, road, along, way, this.roads, this.seed, this.spawn, leader, Number.isInteger(level) && level > 0 ? level : undefined);
      [t.hp, t.y] = [Math.max(1, Math.min(t.maxHp, hp)), this.groundY(t.x, t.z)];
      return t;
    }));
    this.gone.splice(0, this.gone.length, ...(Array.isArray(saved.gone) ? saved.gone : []).filter(([role, , left]) => roles.includes(role) && Number.isFinite(left)).map(([role, leader, left]) => ({ role, leader, in: left })));
    this.nextId = Math.max(Number.isInteger(saved.next) ? saved.next : 0, ...this.list.map((t) => t.id + 1));
  }

  // Whoever's about, standing (for the foes and the guards: travellerFights.ts).
  get standing(): Traveller[] {
    return this.list.filter((t) => t.down === null);
  }

  // Each frame the hero's out in the world (`enemies`: the world's foes, for the guards to go for).
  update(dt: number, enemies: readonly Enemy[] = []): void {
    this.fights.update(dt, enemies);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      t.hurtFor = Math.max(0, t.hurtFor - dt);
      t.cooldown = Math.max(0, t.cooldown - dt);
      if (t.down !== null) {
        t.down += dt;
        if (t.down >= GONE_AFTER) {
          this.list.splice(i, 1);
          this.gone.push({ role: t.role, leader: t.leader === null, in: BACK_AFTER });
        }
        continue;
      }
      if (t.off) continue; // (a guard after a foe: travellerFights.ts walks them)
      const toHero = Math.hypot(this.hero.x - t.x, this.hero.z - t.z);
      if (toHero < STOP_FOR_HERO) {
        t.facing = turnToward(t.facing, Math.atan2(this.hero.x - t.x, this.hero.z - t.z), dt);
        continue;
      }
      this.walk(t, dt);
    }
    this.setOut(dt);
  }

  // Along the road (a guard following their partner, a pace behind them), on at its end.
  private walk(t: Traveller, dt: number): void {
    const leader = t.leader === null ? null : this.list.find((l) => l.id === t.leader && l.down === null) ?? null;
    if (leader && !leader.off) {
      [t.road, t.way] = [leader.road, leader.way];
      t.along = Math.max(0, Math.min(this.roads[t.road].route.length - 1, leader.along - leader.way * FOLLOW));
    } else {
      if (leader === null && t.leader !== null) t.leader = null; // (their partner gone: on alone)
      const next = onRoadSide(this.roads[t.road], t.along + t.way * WALK * dt, t.way);
      const seen = Math.abs(t.x - this.hero.x) < SEEN && Math.abs(t.z - this.hero.z) < SEEN; // (only where it shows: the roads are long)
      if (seen && this.inTheWay(t, next) && t.waited < GIVE_WAY) return void (t.waited += dt); // (someone just ahead: waiting on them, a while)
      t.waited = 0;
      t.along += t.way * WALK * dt;
      const end = this.roads[t.road].route.length - 1;
      if (t.along <= 0 || t.along >= end) this.onward(t);
    }
    const at = onRoadSide(this.roads[t.road], t.along, t.way);
    [t.x, t.z] = [at.x, at.z];
    t.y = this.groundY(t.x, t.z);
    t.facing = turnToward(t.facing, at.facing, dt);
  }

  // Whether stepping to `to` would walk `t` into someone (nearer than ROOM, and nearer than they are now): not their
  // partner (a guard following, a pace behind), nor the fallen.
  private inTheWay(t: Traveller, to: { x: number; z: number }): boolean {
    return this.list.some((o) => {
      if (o === t || o.down !== null || o.leader === t.id || t.leader === o.id) return false;
      if (Math.abs(o.x - to.x) > ROOM || Math.abs(o.z - to.z) > ROOM) return false;
      const after = Math.hypot(o.x - to.x, o.z - to.z);
      return after < ROOM && after < Math.hypot(o.x - t.x, o.z - t.z);
    });
  }

  // At a road's end (a village): on along another of its roads, or back along this one if it has no other.
  private onward(t: Traveller): void {
    const road = this.roads[t.road];
    const village = t.along <= 0 ? road.from : road.to;
    const others = this.from[village].filter((r) => r.road !== t.road);
    const next = others.length > 0 ? others[Math.floor(hashUnit(t.id, t.road, Math.floor(t.along) + 7) * others.length)] : { road: t.road, start: t.along <= 0 };
    t.road = next.road;
    t.along = next.start ? 0 : this.roads[next.road].route.length - 1;
    t.way = next.start ? 1 : -1;
  }

  // Those brought down a while ago: another of their kind sets out from a village (a guard and their partner).
  private setOut(dt: number): void {
    for (let i = this.gone.length - 1; i >= 0; i--) {
      const g = this.gone[i];
      g.in -= dt;
      if (g.in > 0) continue;
      this.gone.splice(i, 1);
      if (!g.leader || this.roads.length === 0) continue; // (a follower sets out with their partner)
      const road = Math.floor(hashUnit(this.nextId, this.seed % 9973, 5) * this.roads.length);
      const first = makeTraveller(this.nextId++, g.role, road, 0, 1, this.roads, this.seed, this.spawn, null);
      first.y = this.groundY(first.x, first.z);
      this.list.push(first);
      if (g.role === 'guard') {
        const second = makeTraveller(this.nextId++, 'guard', road, -FOLLOW, 1, this.roads, this.seed, this.spawn, first.id);
        second.y = first.y;
        this.list.push(second);
      }
    }
  }
}

// From `from` toward `to` (radians), the short way round, at TURN a second.
export function turnToward(from: number, to: number, dt: number): number {
  return from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * Math.min(1, TURN * dt);
}

// Travellers on the roads between the villages (worldgen/roads.ts): pedlars
// with their wares (pedlarShop.ts), pilgrims and wanderers with a word to
// say, and guards walking their beat two by two. One or two parties to a
// road, set out from the seed, walking on and on: at a village, on along
// another of its roads (back the way they came, if it has no other). The
// hero walking up to them, they walk on; spoken to (E), they stand a moment, turned to them (a pedlar, while trading); kept to their side of
// the road, giving way to one another.
//
// Foes leave them be; the guards go for the foes they meet (travellerFights.ts).
// Kept in the save, each where they were.

import { ENEMY_ACTIVE_RADIUS } from '../constants';
import { hashUnit, mulberry32, oneOf } from '../../util/random';
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
  level: number; // from how far out they set out (as foes are: a guard's blows)
  damage: number; // a guard's blow
  swingFor: number | null; // into a blow (a guard's), or null
  cooldown: number; // before the next blow
  off: { x: number; z: number } | null; // off the road (a guard after a foe), else on it
  leader: number | null; // a guard following another (their partner, by id), a pace behind
  lane: number; // where across the road they walk (KEEP a lane, from the middle): 1 their right (as ever), -1 the far side, LANES' others to walk round someone
}

export const WALK = 0.9; // tiles a second along the road
export const WORD_HOLD = 4; // seconds a traveller stands, spoken to (a pedlar trading: as long as the window's open)
const TURN = 6; // radians a second they turn
const FOLLOW = 1.2; // tiles a guard follows their partner by
const KEEP = 0.22; // tiles to the side of the road's middle they keep to (their right)
const ROOM = 0.32; // tiles: no nearer someone else than this (two of them side by side, not into each other)
const SEEN = 40; // tiles from the hero they keep clear of each other (past it, no one's there to see)
const SWAP = 3; // lanes a second they ease across the road, round someone and back
const LANES = [1, -1, 2.4, -2.4]; // where they'll walk to get round someone: their own side, the far side, the verges
const GUARD_DAMAGE = 3;
const SAVE_VERSION = 2; // how they're kept in the save: one older, they're set out afresh (the processions of old saves gone)
export const PEDLAR_KEY = 2 ** 40; // a pedlar's shop's key among the shops (theirs, by id, past every door's number: interiors.ts doorNumber)

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
// way pass them by; `lane` -1 on the far side (overtaking), between the two easing across.
export function onRoadSide(road: Road, along: number, way: 1 | -1, lane = 1): { x: number; z: number; facing: number } {
  const at = onRoad(road, along);
  const heading = way > 0 ? at.facing : at.facing + Math.PI;
  return { x: at.x - Math.cos(heading) * KEEP * lane, z: at.z + Math.sin(heading) * KEEP * lane, facing: heading };
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
export function spawnTravellers(seed: number, roads: readonly Road[], spawn: { x: number; z: number }, firstId = 0): Traveller[] {
  const out: Traveller[] = [];
  roads.forEach((road, r) => {
    const rng = mulberry32((seed * 7919 + r * 104729) | 0);
    const parties = rng() < 0.5 ? 1 : 2;
    for (let p = 0; p < parties; p++) {
      const roll = rng();
      const role: TravellerRole = roll < 0.45 ? 'pedlar' : roll < 0.8 ? 'pilgrim' : 'guard';
      const along = rng() * (road.route.length - 1);
      const way = rng() < 0.5 ? 1 : -1;
      const first = makeTraveller(firstId + out.length, role, r, along, way, roads, seed, spawn, null);
      out.push(first);
      if (role === 'guard') out.push(makeTraveller(firstId + out.length, 'guard', r, along - way * FOLLOW, way, roads, seed, spawn, first.id));
    }
  });
  return out;
}

// `spawn`: where the hero first set out (the further from it, the higher their level, as foes').
export function makeTraveller(id: number, role: TravellerRole, road: number, along: number, way: 1 | -1, roads: readonly Road[], seed: number, spawn: { x: number; z: number }, leader: number | null, kept?: number): Traveller {
  const at = onRoadSide(roads[road], Math.max(0, Math.min(roads[road].route.length - 1, along)), way);
  const look = lookAt(id * 13 + 5, id * 7 + 3, seed + 31, role === 'guard' ? 0.15 : 0.45); // (who they are: theirs alone, wherever they walk)
  const level = kept ?? enemyLevel(spawn, at.x, at.z, id); // (theirs from where they set out: kept, walking on)
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
    damage: GUARD_DAMAGE + Math.floor(level / 3),
    swingFor: null,
    cooldown: 0,
    off: null,
    leader,
    lane: 1,
  };
}

// The world's travellers, walking: each frame, along their roads (on to another at a village), stopped for the hero
// close by.
const AWAKE = ENEMY_ACTIVE_RADIUS; // tiles from the hero a traveller walks on (shown from 30: on their way as they come in sight)

export class Travellers {
  readonly list: Traveller[];
  readonly fights: TravellerFights; // the guards after the foes they meet
  private readonly from: ReturnType<typeof roadsFrom>;
  private byId = new Map<number, Traveller>(); // each by their id (a guard's partner found at once: no going through all of them, each a frame)

  constructor(
    private readonly seed: number,
    readonly roads: readonly Road[], // the roads they walk (worldgen/roads.ts)
    villages: number, // how many
    private readonly spawn: { x: number; z: number }, // where the hero first set out (for their levels)
    private readonly hero: { x: number; z: number },
    private readonly groundY: (x: number, z: number) => number,
    slain: (enemy: Enemy) => void, // a foe a guard's slain
    firstId = 0, // the first of their ids (a streamed world's region's block)
  ) {
    this.fights = new TravellerFights(this, roads, hero, groundY, slain);
    this.list = spawnTravellers(seed, roads, spawn, firstId);
    this.from = roadsFrom(roads, villages);
    for (const t of this.list) t.y = groundY(t.x, t.z);
    this.byId = new Map(this.list.map((t) => [t.id, t]));
  }

  // Where everyone is, for the save: each on their road (how far along, which way), their partner, their level.
  save(): { v: number; on: Array<[number, TravellerRole, number, number, 1 | -1, number | null, number]> } {
    return { v: SAVE_VERSION, on: this.list.map((t) => [t.id, t.role, t.road, Math.round(t.along * 100) / 100, t.way, t.leader, t.level]) };
  }

  // Everyone back where the save had them (what doesn't fit this world's roads, left as the seed has it).
  load(saved: ReturnType<Travellers['save']>): void {
    const roles: readonly string[] = ['pedlar', 'pilgrim', 'guard'];
    // (A save from before this one's way of keeping them: those were read as all following one another, and saved
    // bunched in a line. Not kept: they set out spread over the roads again, as the seed has them.)
    if (saved?.v !== SAVE_VERSION) return;
    const entries = saved.on;
    const on = entries.filter(
      (e) => Array.isArray(e) && Number.isInteger(e[0]) && roles.includes(e[1]) && this.roads[e[2]] !== undefined && Number.isFinite(e[3]) && (e[4] === 1 || e[4] === -1),
    );
    if (on.length === 0) return;
    // A partner only a guard's, following a guard who leads (anything else: on their own).
    const leads = new Set(on.filter(([, role, , , , leader]) => role === 'guard' && leader === null).map(([id]) => id));
    this.list.splice(0, this.list.length, ...on.map(([id, role, road, along, way, leader, level]) => {
      const partner = role === 'guard' && leader !== id && leads.has(leader as number) ? leader : null;
      const t = makeTraveller(id, role, road, along, way, this.roads, this.seed, this.spawn, partner, Number.isInteger(level) && level > 0 ? level : undefined);
      t.y = this.groundY(t.x, t.z);
      return t;
    }));
    this.byId = new Map(this.list.map((t) => [t.id, t]));
  }

  // Each frame the hero's out in the world (`enemies`: the world's foes, for the guards to go for).
  update(dt: number, enemies: readonly Enemy[] = []): void {
    this.fights.update(dt, enemies);
    this.heldFor = Math.max(0, this.heldFor - dt);
    const held = this.heldFor > 0 ? this.held : null; // (the one talking with the hero: the rest walk on by)
    for (const t of this.list) {
      if (Math.abs(t.x - this.hero.x) > AWAKE || Math.abs(t.z - this.hero.z) > AWAKE) continue; // (far off: stood where they are, till the hero comes near)
      t.cooldown = Math.max(0, t.cooldown - dt);
      if (t.off) continue; // (a guard after a foe: travellerFights.ts walks them)
      if (t === held || (held && t.leader === held.id)) {
        t.facing = turnToward(t.facing, Math.atan2(this.hero.x - t.x, this.hero.z - t.z), dt);
        continue;
      }
      this.walk(t, dt);
    }
  }

  // The traveller the hero's talking (or trading) with: stood still `seconds` more, turned to them (their partner
  // with them). Held again each frame while trading; a word, a few seconds.
  private held: Traveller | null = null;
  private heldFor = 0;
  hold(t: Traveller, seconds: number): void {
    [this.held, this.heldFor] = [t, Math.max(seconds, this.held === t ? this.heldFor : 0)];
  }

  // Along the road (a guard following their partner, a pace behind them), on at its end.
  private walk(t: Traveller, dt: number): void {
    const leader = t.leader === null ? null : this.byId.get(t.leader) ?? null;
    if (leader && !leader.off) {
      [t.road, t.way] = [leader.road, leader.way];
      t.along = Math.max(0, Math.min(this.roads[t.road].route.length - 1, leader.along - leader.way * FOLLOW));
    } else {
      if (leader === null && t.leader !== null) t.leader = null; // (their partner gone: on alone)
      if (!this.makeWay(t, dt)) return; // (both sides blocked: waiting, a while)
      t.along += t.way * WALK * dt;
      const end = this.roads[t.road].route.length - 1;
      if (t.along <= 0 || t.along >= end) this.onward(t);
    }
    const at = onRoadSide(this.roads[t.road], t.along, t.way, t.lane);
    [t.x, t.z] = [at.x, at.z];
    t.y = this.groundY(t.x, t.z);
    t.facing = turnToward(t.facing, at.facing, dt);
  }

  // Their way on, never into anyone (near the hero, where it shows: the roads are long): the step ahead clear on their
  // line, on; else easing over to a line that's clear (the far side, a verge) to walk round them, and back to their
  // own side once by; none clear, waiting. Whether they go on this frame.
  private makeWay(t: Traveller, dt: number): boolean {
    const seen = Math.abs(t.x - this.hero.x) < SEEN && Math.abs(t.z - this.hero.z) < SEEN;
    const ease = (to: number) => (t.lane += Math.sign(to - t.lane) * Math.min(Math.abs(to - t.lane), SWAP * dt));
    if (!seen) return (ease(1), true);
    const at = (along: number, lane: number) => onRoadSide(this.roads[t.road], along, t.way, lane);
    const clear = (along: number, lane: number) => !this.inTheWay(t, at(along, lane));
    const into = (along: number, lane: number) => this.inTheWay(t, at(along, lane), t); // (nearer anyone it's in: stepping apart always allowed)
    const step = t.along + t.way * WALK * dt;
    const ahead = t.along + t.way * Math.max(WALK * dt, ROOM); // (a body's length on: room to walk into)
    const line = LANES.find((lane) => clear(ahead, lane) && clear(t.along, lane)) ?? null; // (their own side first)
    if (line !== null && line !== t.lane) {
      const before = t.lane;
      ease(line);
      if (into(t.along, t.lane)) t.lane = before; // (not sideways into anyone either)
    }
    return !into(step, t.lane); // (someone in the way: not into them, waiting)
  }

  // Whether `t` at `to` would be in someone (nearer than ROOM): not their partner (a guard following, a pace behind).
  // `from`: where they are, a move from there into someone only if it brings them nearer (stepping apart, never held).
  private inTheWay(t: Traveller, to: { x: number; z: number }, from?: { x: number; z: number }): boolean {
    return this.list.some((o) => {
      if (o === t || o.leader === t.id || t.leader === o.id) return false;
      if (Math.abs(o.x - to.x) > ROOM || Math.abs(o.z - to.z) > ROOM) return false;
      const d = Math.hypot(o.x - to.x, o.z - to.z);
      return d < ROOM && (!from || d < Math.hypot(o.x - from.x, o.z - from.z));
    });
  }

  // At a road's end (a village): on along another of its roads, or back along this one if it has no other.
  private onward(t: Traveller): void {
    const road = this.roads[t.road];
    const village = t.along <= 0 ? road.from : road.to;
    const others = this.from[village].filter((r) => r.road !== t.road);
    const next = others.length > 0 ? oneOf(others, hashUnit(t.id, t.road, Math.floor(t.along) + 7)) : { road: t.road, start: t.along <= 0 };
    t.road = next.road;
    t.along = next.start ? 0 : this.roads[next.road].route.length - 1;
    t.way = next.start ? 1 : -1;
  }
}

// From `from` toward `to` (radians), the short way round, at TURN a second.
export function turnToward(from: number, to: number, dt: number): number {
  return from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * Math.min(1, TURN * dt);
}

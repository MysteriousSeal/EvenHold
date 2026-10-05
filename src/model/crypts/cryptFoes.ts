// The crypts' guards: the dead standing at their posts, skeletons with swords
// and bowmen, of the crypt's level, waking at the sight of the hero (far down
// the dark passages) and coming on as any foes do (enemies.ts, run by their
// own director on the crypt's floor). A bowman keeps his distance, draws and
// looses an arrow at where the hero stands: it flies straight on till it hits
// him, the rock or something solid (sidestepped, it misses). Posted: one along
// the corridor every so often, two or three in each hall and side room; none
// in the great hall (its lord's alone), none near the foot of the stairs. Slain, they
// stay slain (the crypt's, kept in the save): a cleared crypt stays clear.

import { ENEMY_STATS } from '../constants';
import type { Enemy, GameEvent, Hero } from '../types';
import type { DungeonHooks, DungeonRun } from '../dungeons/dungeonTypes';
import { FROST_BREATH } from './frostBreath';
import { CLEAVE, CLEAVE_KNOCK } from './cleave';
import { ToldMoves, knockAway, type Told } from '../enemies/toldMoves';
import { BARRAGE, CHARGE_KNOCK, ERUPTION, SWEEP, SWEEP_KNOCK, chargeMove } from './cryptLord';
import { AWARD_POST, CHEST_POST, LORD_POST, Lord, SLAM, RISES_AT, SUMMONED, chestHoard, clearedShare, lordName, lordSpot } from './cryptLord';
import { hashCell, mulberry32 } from '../../util/random';
import { cellKey } from '../map/grid';
import { makeEnemy } from '../enemies/enemies';
import { EnemyDirector, type Ground } from '../enemies/enemyDirector';
import { isFloor, type CryptPlan } from './cryptLayout';
import { cryptBlocks, type CryptInside } from './crypts';
import { exitDoor, floorHeight, solidTiles } from './cryptProps';

export const CRYPT_FOE_ID = 3_000_000; // guards' ids: this plus their post's number (clear of the world's and the quests')
const ARROW_SPEED = 7; // tiles a second
const ARROW_RANGE = 10; // tiles it flies, at most
const ARROW_HIT = 0.22; // how near the hero it must pass to strike him
const CLEAR_OF_STAIRS = 7; // tiles from the foot of the stairs no guard stands
const CORRIDOR_EVERY = 9; // corridor tiles to a guard along it, about
const ARCHERS = 0.35; // of the skeletons, about, bowmen
const DRAUGR: [number, number] = [0.06, 0.34]; // the chance a guard's a draugr, near the stairs and at the far end (about one in five)

// One of the lord's souls, drifting after the hero (BARRAGE: cryptLord.ts).
export interface Soul {
  x: number;
  z: number;
  dx: number; // its heading (a unit vector)
  dz: number;
  age: number;
  damage: number;
  by: Enemy;
}
const SOUL_SPEED = 2.6; // tiles a second: slow enough to step out of its way
const SOUL_TURN = 1.3; // radians a second it turns after the hero, at most
const SOUL_HIT = 0.28;
const SOUL_LIFE = 4.5; // seconds before it's spent

export interface Arrow {
  x: number;
  z: number;
  dx: number; // its heading (a unit vector)
  dz: number;
  flown: number;
  damage: number;
}

export type GuardKind = 'skeleton' | 'skeletonArcher' | 'draugr';
export interface Post {
  x: number;
  z: number;
  kind: GuardKind;
}

// Where the crypt's guards stand, and what each is: from the seed and the ruin, the same every time. Draugr
// the likelier the deeper in (DRAUGR: from near the stairs to the far end). None in the great hall: its lord's alone.
export function guardPosts(seed: number, inside: CryptInside): Post[] {
  const { plan, props, crypt } = inside;
  const rng = mulberry32(hashCell(crypt.ruin.x * 5 + 1, crypt.ruin.z * 3 + 7, seed + 4421));
  const solid = solidTiles(props);
  const taken = new Set<string>();
  const great = plan.places.find((p) => p.kind === 'great');
  const inGreat = (x: number, z: number) => !!great && x >= great.x0 - 1 && x <= great.x1 + 1 && z >= great.z0 - 1 && z <= great.z1 + 1; // (his alone)
  const open = (x: number, z: number) =>
    isFloor(plan, x, z) && !solid.has(cellKey(x, z)) && !taken.has(cellKey(x, z)) && !inGreat(x, z) && Math.hypot(x - plan.door, z - (plan.depth - 1)) > CLEAR_OF_STAIRS;
  const posts: Post[] = [];
  // What stands at (x, z): a draugr, the likelier the deeper in; else a bowman, or a swordsman.
  const roll = (z: number, archers: number): GuardKind => {
    const deep = 1 - z / Math.max(1, plan.depth - 1);
    if (rng() < DRAUGR[0] + (DRAUGR[1] - DRAUGR[0]) * deep) return 'draugr';
    return rng() < archers ? 'skeletonArcher' : 'skeleton';
  };
  // `count` in a rect, on open floor, picked from the rng (the first `draugr` of them draugr).
  const post = (x0: number, z0: number, x1: number, z1: number, count: number, archers = ARCHERS, draugr = 0) => {
    const spots = tilesOf(x0, z0, x1, z1).map((k) => k.split(',').map(Number) as [number, number]).filter(([x, z]) => open(x, z));
    for (let i = 0; i < count && spots.length > 0; i++) {
      const [x, z] = spots.splice(Math.floor(rng() * spots.length), 1)[0];
      taken.add(cellKey(x, z));
      posts.push({ x, z, kind: i < draugr ? 'draugr' : roll(z, archers) });
    }
  };
  let run = 0;
  for (const place of plan.places) {
    const tiles = (place.x1 - place.x0 + 1) * (place.z1 - place.z0 + 1);
    if (place.kind === 'corridor') {
      run += tiles / 2; // (two wide)
      if (run >= CORRIDOR_EVERY) {
        run = 0;
        post(place.x0, place.z0, place.x1, place.z1, 1);
      }
    } else if (place.kind === 'great') continue; // (the great hall's its lord's alone)
    else if (place.kind === 'side') post(place.x0, place.z0, place.x1, place.z1, 2);
    else post(place.x0, place.z0, place.x1, place.z1, 2 + (rng() < 0.25 ? 1 : 0));
  }
  return posts;
}

// A crypt's key, for its record of the slain: its ruin's corner.
export const cryptKey = (crypt: { ruin: { x: number; z: number } }): string => `${crypt.ruin.x},${crypt.ruin.z}`;

// How many guards a crypt has, all told (its posts).
const counted = new WeakMap<CryptInside, number>();
export function guardCount(seed: number, inside: CryptInside): number {
  if (!counted.has(inside)) counted.set(inside, guardPosts(seed, inside).length);
  return counted.get(inside)!;
}

function tilesOf(x0: number, z0: number, x1: number, z1: number): string[] {
  const tiles: string[] = [];
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) tiles.push(cellKey(x, z));
  return tiles;
}

// What the crypt's foes do to the game: any dungeon's hooks (dungeons/dungeonTypes.ts).
export type CryptHooks = DungeonHooks;

// A crypt's guards while the hero's down there: run, shooting, slain; and its lord, risen (cryptLord.ts), and his chest.
export class CryptFoes implements DungeonRun {
  readonly foes: Enemy[];
  readonly arrows: Arrow[] = [];
  readonly director: EnemyDirector;
  lord: Lord | null = null; // risen
  readonly frost = new ToldMoves(FROST_BREATH, (draugr) => this.hooks.frost(draugr)); // the draugr's breath
  readonly cleaves = new ToldMoves(CLEAVE, (draugr, c) => this.hooks.blow(draugr, draugr.damage * 2, { dx: c.dx * CLEAVE_KNOCK, dz: c.dz * CLEAVE_KNOCK })); // and their cleave
  readonly slams = new ToldMoves(SLAM, (lord) => this.hooks.blow(lord, lord.damage * 2)); // the lord's slam
  readonly sweeps = new ToldMoves(SWEEP, (lord, m) => this.hooks.blow(lord, Math.round(lord.damage * 1.5), knockAway(m, this.director.quarry, SWEEP_KNOCK))); // his sweep: knocked away from him
  readonly charges: ToldMoves; // his charge: knocked back along it (made with the crypt's rock to stop him)
  readonly eruptions = new ToldMoves(ERUPTION, (lord) => this.hooks.blow(lord, Math.round(lord.damage * 1.5))); // his bones bursting up
  readonly barrages = new ToldMoves(BARRAGE, (lord, m) => this.loosesSouls(lord, m)); // his souls loosed
  readonly souls: Soul[] = []; // in flight, after the hero
  chest: { x: number; z: number; open: boolean } | null = null; // his, once he's slain
  private readonly plan: CryptPlan;
  private readonly guards: number; // all its posts
  private calledUp = 0;

  constructor(
    private readonly seed: number,
    private readonly inside: CryptInside,
    private readonly slain: Set<number>, // of its posts, those slain (kept: the save's)
    hero: Hero,
    private readonly hooks: CryptHooks,
  ) {
    this.plan = inside.plan;
    const posts = guardPosts(seed, inside);
    this.guards = posts.length;
    this.foes = posts.flatMap((p, i) => (slain.has(i) ? [] : [this.standing(makeEnemy(CRYPT_FOE_ID + i, p.kind, p.x, p.z, p.x, p.z, inside.crypt.level))]));
    if (slain.has(LORD_POST)) this.chest = { ...lordSpot(inside), open: slain.has(CHEST_POST) };
    this.exit = exitDoor(inside);
    const ground: Ground = {
      isBlocked: (x, z, r) => cryptBlocks(inside, x, z, r),
      blocksSight: (x, z) => !isFloor(this.plan, Math.round(x), Math.round(z)),
    };
    const size = { width: this.plan.width, depth: this.plan.depth };
    this.charges = new ToldMoves(chargeMove((x, z) => cryptBlocks(inside, x, z, 0.24)), (lord, m) => this.hooks.blow(lord, Math.round(lord.damage * 1.5), { dx: m.dx * CHARGE_KNOCK, dz: m.dz * CHARGE_KNOCK })); // (bowled back along it)
    this.director = new EnemyDirector(this.foes, hero, ground, size, (x, z) => floorHeight(inside.props, x, z), (e) => (e.kind === 'skeletonArcher' ? this.loose(e, hero) : this.hooks.strike(e)), true);
  }

  // A foe stood on the floor where it is (up on the dais, there: cryptProps.ts floorHeight).
  standing(foe: Enemy): Enemy {
    foe.y = floorHeight(this.inside.props, foe.x, foe.z);
    return foe;
  }

  // The lord's name: who the crypt's named for.
  get lordName(): string {
    return lordName(this.inside.crypt.name);
  }

  // Which post a guard stood at (for the save's record of the slain).
  static postOf(enemy: Enemy): number {
    return enemy.id - CRYPT_FOE_ID;
  }

  update(dt: number): void {
    const hero = this.director.quarry;
    if (!this.lord && !this.slain.has(LORD_POST) && clearedShare(this.slain, this.guards) >= RISES_AT) this.rise();
    this.director.update(dt);
    this.lord?.update();
    this.wakeLord(hero);
    const told = [this.frost, this.cleaves, this.slams, this.sweeps, this.charges, this.eruptions, this.barrages];
    for (const moves of told) moves.update(this.foes, hero, dt, (foe) => told.some((other) => other !== moves && other.doing(foe))); // (one at a time)
    if (this.lord && this.lord.enemy.state === 'dead' && !this.chest) this.chest = { ...lordSpot(this.inside), open: false }; // his chest, where he rose
    for (let i = this.arrows.length - 1; i >= 0; i--) if (this.fly(this.arrows[i], dt)) this.arrows.splice(i, 1);
    for (let i = this.souls.length - 1; i >= 0; i--) if (this.drift(this.souls[i], dt)) this.souls.splice(i, 1);
  }

  // The lord, risen and standing before his tomb, set on the hero the moment they come into his great hall.
  private wakeLord(hero: Hero): void {
    const lord = this.lord?.enemy;
    const great = this.plan.places.find((p) => p.kind === 'great');
    if (!lord || !great || lord.state !== 'wander') return;
    if (hero.x < great.x0 - 0.5 || hero.x > great.x1 + 0.5 || hero.z < great.z0 - 0.5 || hero.z > great.z1 + 0.5) return;
    Object.assign(lord, { state: 'chase', lastSeen: { x: hero.x, z: hero.z }, lostFor: 0, target: null });
  }

  // The lord's souls loosed: three in a fan from him, toward the hero.
  private loosesSouls(lord: Enemy, m: Told): void {
    const heading = Math.atan2(m.dz, m.dx);
    for (const spread of [-0.6, 0, 0.6]) {
      const a = heading + spread;
      this.souls.push({ x: lord.x + Math.cos(a) * 0.4, z: lord.z + Math.sin(a) * 0.4, dx: Math.cos(a), dz: Math.sin(a), age: 0, damage: Math.max(1, Math.round(lord.damage * 0.6)), by: lord });
    }
  }

  // A soul on: turning slowly after the hero, drifting on; striking them, or lost at the rock, or spent. True once done.
  private drift(soul: Soul, dt: number): boolean {
    const hero = this.director.quarry;
    soul.age += dt;
    const want = Math.atan2(hero.z - soul.z, hero.x - soul.x);
    let turn = want - Math.atan2(soul.dz, soul.dx);
    turn = Math.atan2(Math.sin(turn), Math.cos(turn)); // (the shorter way round)
    const a = Math.atan2(soul.dz, soul.dx) + Math.max(-SOUL_TURN * dt, Math.min(SOUL_TURN * dt, turn));
    [soul.dx, soul.dz] = [Math.cos(a), Math.sin(a)];
    soul.x += soul.dx * SOUL_SPEED * dt;
    soul.z += soul.dz * SOUL_SPEED * dt;
    if (Math.hypot(hero.x - soul.x, hero.z - soul.z) < SOUL_HIT) {
      this.hooks.blow(soul.by, soul.damage);
      return true;
    }
    return soul.age > SOUL_LIFE || cryptBlocks(this.inside, soul.x, soul.z, 0.02);
  }

  // The lord rises before his tomb.
  private rise(): void {
    const enemy = this.standing({ ...Lord.rise(this.inside, this.lordName), id: CRYPT_FOE_ID + LORD_POST });
    this.foes.push(enemy);
    this.lord = new Lord(enemy, (at, n) => {
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + 0.6;
        const [x, z] = [at.x + Math.cos(a) * 0.9, at.z + Math.sin(a) * 0.9];
        const spot = cryptBlocks(this.inside, x, z, 0.14) ? at : { x, z };
        this.foes.push(this.standing({ ...makeEnemy(CRYPT_FOE_ID + SUMMONED + this.calledUp++, 'skeleton', spot.x, spot.z, spot.x, spot.z, this.inside.crypt.level), state: 'chase' }));
      }
    });
    this.hooks.report({ kind: 'rises', name: this.lordName });
  }

  // Whether a walker of half-width `r` could stand at (x, z): on the floor, clear of anything solid.
  free(x: number, z: number, r: number): boolean {
    return !cryptBlocks(this.inside, x, z, r);
  }

  // One of its foes slain, for good: its post kept (not those the lord calls up); its lord the first time, a point to
  // spend for the hero (once a crypt, ever: AWARD_POST kept even through a reset); all of it, cleared. What's told.
  slay(enemy: Enemy, hero: Hero): GameEvent[] {
    const post = CryptFoes.postOf(enemy);
    if (enemy.id < CRYPT_FOE_ID || post >= SUMMONED) return [];
    this.slain.add(post);
    const told: GameEvent[] = [];
    const point = post === LORD_POST && !this.slain.has(AWARD_POST);
    if (point) {
      this.slain.add(AWARD_POST);
      hero.statPoints += 1;
      told.push({ kind: 'point', why: `${this.lordName} slain` });
    }
    if (this.share === 1) told.push({ kind: 'cleared', name: this.inside.crypt.name, point });
    return told;
  }

  // The way out at the great hall's far end: a door in the rock behind the great tomb (exitDoor), opened when its
  // lord's slain; where to stand for it (or null, shut).
  get exitOpen(): { x: number; z: number } | null {
    return this.slain.has(LORD_POST) && this.exit ? { x: this.exit.x, z: this.exit.z + 1 } : null;
  }
  readonly exit: { x: number; z: number } | null; // the door's tile, in the rock (cryptProps.ts: exitDoor)

  // His chest, if the hero's at it and it's not opened yet.
  chestInReach(hero: { x: number; z: number }): boolean {
    return !!this.chest && !this.chest.open && Math.hypot(hero.x - this.chest.x, hero.z - this.chest.z) < 0.9;
  }

  // Opens it: what it holds, out on the floor before it.
  openChest(): void {
    if (!this.chest || this.chest.open) return;
    this.chest.open = true;
    this.slain.add(CHEST_POST);
    const { item, coins } = chestHoard(this.inside, this.seed);
    this.hooks.dropLoot(item, this.chest.x + 0.3, this.chest.z + 0.35);
    this.hooks.dropCoins(coins, this.chest.x - 0.3, this.chest.z + 0.35);
  }

  // How much of it's cleared (0..1): its guards slain and its lord, of all of them.
  get share(): number {
    return clearedShare(this.slain, this.guards);
  }

  // A bowman looses: an arrow from his hand toward where the hero stands now.
  private loose(archer: Enemy, hero: Hero): void {
    const d = Math.hypot(hero.x - archer.x, hero.z - archer.z);
    if (d < 1e-6) return;
    const [dx, dz] = [(hero.x - archer.x) / d, (hero.z - archer.z) / d];
    this.arrows.push({ x: archer.x + dx * 0.25, z: archer.z + dz * 0.25, dx, dz, flown: 0, damage: archer.damage });
  }

  // An arrow on, in short steps (so it can't skip past the hero or through a corner); true once it's done.
  private fly(arrow: Arrow, dt: number): boolean {
    const hero = this.director.quarry;
    let left = ARROW_SPEED * dt;
    while (left > 0) {
      const step = Math.min(0.1, left);
      left -= step;
      arrow.x += arrow.dx * step;
      arrow.z += arrow.dz * step;
      arrow.flown += step;
      if (Math.hypot(hero.x - arrow.x, hero.z - arrow.z) < ARROW_HIT) {
        this.hooks.arrow(arrow);
        return true;
      }
      if (arrow.flown > ARROW_RANGE || cryptBlocks(this.inside, arrow.x, arrow.z, 0.02)) return true;
    }
    return false;
  }

  // Whether a bowman is drawing (for its look), and how far (0..1).
  static drawn(enemy: Enemy): number | null {
    return enemy.kind === 'skeletonArcher' && enemy.swingFor !== null ? Math.min(1, enemy.swingFor / ENEMY_STATS.skeletonArcher.swing) : null;
  }
}

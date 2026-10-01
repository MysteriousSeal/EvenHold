// The crypts' guards: the dead standing at their posts, skeletons with swords
// and bowmen, of the crypt's level, waking at the sight of the hero (far down
// the dark passages) and coming on as any foes do (enemies.ts, run by their
// own director on the crypt's floor). A bowman keeps his distance, draws and
// looses an arrow at where the hero stands: it flies straight on till it hits
// him, the rock or something solid (sidestepped, it misses). Posted: one along
// the corridor every so often, one or two in each hall and side room, a band
// of them in the great hall; none near the foot of the stairs. Slain, they
// stay slain (the crypt's, kept in the save): a cleared crypt stays clear.

import { ENEMY_STATS } from '../constants';
import type { Enemy, GameEvent, Hero } from '../types';
import type { BagItem } from '../hero/bag';
import { FrostBreaths } from './frostBreath';
import { Cleaves } from './cleave';
import { CHEST_POST, LORD_POST, Lord, RISES_AT, SUMMONED, chestHoard, clearedShare, lordName, lordSpot } from './cryptLord';
import { hashCell, mulberry32 } from '../../util/random';
import { cellKey } from '../map/grid';
import { makeEnemy } from '../enemies/enemies';
import { EnemyDirector, type Ground } from '../enemies/enemyDirector';
import { isFloor, type CryptPlan } from './cryptLayout';
import { cryptBlocks, type CryptInside } from './crypts';

export const CRYPT_FOE_ID = 3_000_000; // guards' ids: this plus their post's number (clear of the world's and the quests')
const ARROW_SPEED = 7; // tiles a second
const ARROW_RANGE = 10; // tiles it flies, at most
const ARROW_HIT = 0.22; // how near the hero it must pass to strike him
const CLEAR_OF_STAIRS = 7; // tiles from the foot of the stairs no guard stands
const CORRIDOR_EVERY = 9; // corridor tiles to a guard along it, about
const ARCHERS = 0.35; // of the skeletons, about, bowmen
const DRAUGR: [number, number] = [0.06, 0.34]; // the chance a guard's a draugr, near the stairs and at the far end (about one in five)

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
// the likelier the deeper in (DRAUGR: from near the stairs to the far end), two in the great hall.
export function guardPosts(seed: number, inside: CryptInside): Post[] {
  const { plan, props, crypt } = inside;
  const rng = mulberry32(hashCell(crypt.ruin.x * 5 + 1, crypt.ruin.z * 3 + 7, seed + 4421));
  const solid = new Set(props.filter((p) => p.solid).flatMap((p) => tilesOf(p.x, p.z, p.x + p.w - 1, p.z + p.d - 1)));
  const taken = new Set<string>();
  const open = (x: number, z: number) =>
    isFloor(plan, x, z) && !solid.has(cellKey(x, z)) && !taken.has(cellKey(x, z)) && Math.hypot(x - plan.door, z - (plan.depth - 1)) > CLEAR_OF_STAIRS;
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
    } else if (place.kind === 'great') post(place.x0 + 1, place.z0 + 1, place.x1 - 1, place.z1 - 1, 6 + (rng() < 0.5 ? 1 : 0), 0.4, 2);
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

// What the crypt's foes do to the game: their blows, arrows and slams on the hero, what's told, what they leave.
export interface CryptHooks {
  strike(enemy: Enemy): void; // a swordsman's (or the lord's) blow lands (reach is the model's to judge)
  arrow(arrow: Arrow): void; // an arrow strikes the hero
  slam(damage: number, lord: Enemy): void; // the lord's slam catches the hero
  frost(draugr: Enemy): void; // a draugr's frost breath catches the hero
  cleave(draugr: Enemy, from: { dx: number; dz: number }): void; // a draugr's cleave comes down on the hero (knocked back along it)
  report(event: GameEvent): void;
  dropLoot(item: BagItem, x: number, z: number): void;
  dropCoins(amount: number, x: number, z: number): void;
}

// A crypt's guards while the hero's down there: run, shooting, slain; and its lord, risen (cryptLord.ts), and his chest.
export class CryptFoes {
  readonly foes: Enemy[];
  readonly arrows: Arrow[] = [];
  readonly director: EnemyDirector;
  lord: Lord | null = null; // risen
  readonly frost = new FrostBreaths(); // the draugr's breath
  readonly cleaves = new Cleaves(); // and their cleave
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
    this.foes = posts.flatMap((p, i) => (slain.has(i) ? [] : [makeEnemy(CRYPT_FOE_ID + i, p.kind, p.x, p.z, p.x, p.z, inside.crypt.level)]));
    if (slain.has(LORD_POST)) this.chest = { ...lordSpot(inside), open: slain.has(CHEST_POST) };
    const ground: Ground = {
      isBlocked: (x, z, r) => cryptBlocks(inside, x, z, r),
      blocksSight: (x, z) => !isFloor(this.plan, Math.round(x), Math.round(z)),
    };
    const size = { width: this.plan.width, depth: this.plan.depth };
    this.director = new EnemyDirector(this.foes, hero, ground, size, () => 0, (e) => (e.kind === 'skeletonArcher' ? this.loose(e, hero) : this.hooks.strike(e)), true);
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
    const held = this.lord?.before() ?? null;
    this.director.update(dt);
    this.lord?.after(dt, held, hero);
    this.frost.update(this.foes, hero, dt, (draugr) => this.hooks.frost(draugr), (draugr) => this.cleaves.cleaving(draugr));
    this.cleaves.update(this.foes, hero, dt, (draugr) => this.frost.breaths.some((b) => b.draugr === draugr), (draugr, cleave) => this.hooks.cleave(draugr, cleave));
    if (this.lord && this.lord.enemy.state === 'dead' && !this.chest) this.chest = { ...lordSpot(this.inside), open: false }; // his chest, where he rose
    for (let i = this.arrows.length - 1; i >= 0; i--) if (this.fly(this.arrows[i], dt)) this.arrows.splice(i, 1);
  }

  // The lord rises before his tomb.
  private rise(): void {
    const enemy = { ...Lord.rise(this.inside, this.lordName), id: CRYPT_FOE_ID + LORD_POST };
    this.foes.push(enemy);
    this.lord = new Lord(enemy, {
      slam: (damage, lord) => this.hooks.slam(damage, lord),
      call: (at, n) => {
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + 0.6;
          const [x, z] = [at.x + Math.cos(a) * 0.9, at.z + Math.sin(a) * 0.9];
          const spot = cryptBlocks(this.inside, x, z, 0.14) ? at : { x, z };
          this.foes.push({ ...makeEnemy(CRYPT_FOE_ID + SUMMONED + this.calledUp++, 'skeleton', spot.x, spot.z, spot.x, spot.z, this.inside.crypt.level), state: 'chase' });
        }
      },
    });
    this.hooks.report({ kind: 'rises', name: this.lordName });
  }

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

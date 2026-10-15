// What every dungeon's run of foes shares (a crypt's guards and lord, crypts/cryptFoes.ts; a cave's beasts and brood
// mother, caves/caveFoes.ts; a stronghold's packs, bosses and king, strongholds/strongholdFoes.ts): its foes and their director, the record of those slain for good (by post:
// dungeonRecord.ts), how much of it's cleared, its boss's first fall a point to spend for the hero, and its boss's
// chest (or hoard) once slain, opened once, what it holds out on the floor before it. Each kind its own foes, moves,
// way out and ground.

import type { Enemy, EnemyKind, GameEvent, Hero } from '../types';
import type { EnemyDirector } from '../enemies/enemyDirector';
import type { Hoard } from '../loot/hoard';
import type { DungeonHooks, DungeonRun } from './dungeonTypes';
import { AWARD_POST, BOSS_POST, CHAMPION_POST, CHEST_POST, SUMMONED, clearedShare } from './dungeonRecord';
import { championOf, type ChampionHome } from '../champions/champions';
import { ChampionRun, makeChampion } from '../champions/championRun';
import { ENEMY_STATS } from '../constants';
import { makeEnemy } from '../enemies/enemies';

export interface DungeonFoesSpec {
  firstId: number; // its foes' ids: this plus their post's number (clear of the world's, the quests', the other kind's)
  chestReach: number; // tiles from its chest the hero can open it
  drop: { x: number; z: number }; // where what's in it lands, off its chest (the gear one side, the coins the other)
}

const CHEST_HALF = { x: 0.3, z: 0.2 }; // a chest's (or a hoard's) half-width across and half-depth, room tiles
const CHAMPION_CALLED = SUMMONED + 800_000; // the ids of those a champion calls up, from here (this plus the dungeon's first)

export abstract class DungeonFoes implements DungeonRun {
  abstract readonly foes: Enemy[];
  abstract readonly director: EnemyDirector;
  chest: { x: number; z: number; open: boolean } | null = null; // the boss's, once slain
  protected abstract readonly posts: number; // all its posts (those its foes stood at)
  champion: ChampionRun | null = null; // its champion, standing (champions/: if it has one, not slain yet)
  private calledByChampion = 0;

  // A shot (a bowman's arrow, a spider's web) on along its way, in short steps (so it can't skip past the hero or
  // through a corner): `strike` once it reaches them; true once it's done (struck, flown its range, or stopped by what
  // `blocks` its way).
  protected flyShot(shot: { x: number; z: number; dx: number; dz: number; flown: number }, how: { speed: number; hit: number; range: number }, dt: number, blocks: (x: number, z: number) => boolean, strike: () => void): boolean {
    const hero = this.director.quarry;
    let left = how.speed * dt;
    while (left > 0) {
      const step = Math.min(0.1, left);
      left -= step;
      shot.x += shot.dx * step;
      shot.z += shot.dz * step;
      shot.flown += step;
      if (Math.hypot(hero.x - shot.x, hero.z - shot.z) < how.hit) return strike(), true;
      if (shot.flown > how.range || blocks(shot.x, shot.z)) return true;
    }
    return false;
  }

  protected constructor(
    protected readonly seed: number,
    protected readonly slain: Set<number>, // of its posts, those slain (kept: the save's)
    protected readonly hooks: DungeonHooks,
    private readonly spec: DungeonFoesSpec,
  ) {}

  abstract update(dt: number): void;
  abstract readonly exitOpen: { x: number; z: number } | null;
  abstract free(x: number, z: number, r: number): boolean;
  abstract standing(foe: Enemy): Enemy;
  protected abstract get bossFell(): string; // what's told as its boss falls the first time ("Lord Aldric slain")
  protected abstract cleared(point: boolean): GameEvent; // what's told once all of it's cleared
  protected abstract hoard(): Hoard; // what its chest holds

  // Which post a foe stood at (for the save's record of the slain).
  protected postOf(enemy: Enemy): number {
    return enemy.id - this.spec.firstId;
  }

  // Its champion, if it has one and it's not slain yet (champions/champions.ts: `home` its kind of dungeon, `at` its way
  // in), set among its foes deeper in: beside one of `beside` (its foes' posts, from the way in on) past the first third,
  // on the nearest spot it could stand. The champion, or null.
  protected crown(home: ChampionHome, at: { x: number; z: number }, level: number, beside: ReadonlyArray<{ x: number; z: number }>): Enemy | null {
    const id = championOf(home, this.seed, at);
    if (!id || this.slain.has(CHAMPION_POST) || beside.length === 0) return null;
    const from = Math.floor(beside.length / 3);
    const near = beside[from + Math.floor(((at.x * 7 + at.z * 13 + this.seed) >>> 0) % Math.max(1, beside.length - from))];
    const spot = this.near(near.x, near.z, 0.2);
    if (!spot) return null;
    const foe = this.standing(makeChampion(this.spec.firstId + CHAMPION_POST, id, spot.x, spot.z, level));
    this.foes.push(foe);
    this.champion = new ChampionRun(foe as Enemy & { champion: typeof id }, (kind, from, count) => this.callUp(kind, from, count, level), (event) => this.hooks.report(event));
    return foe;
  }

  // Its champion's trait run (each kind's update, after its director's).
  protected runChampion(): void {
    this.champion?.update();
    if (this.champion?.foe.state === 'dead') this.champion = null;
  }

  // The nearest spot to (x, z) a walker of half-width r could stand, a step or two off it (or null: none).
  private near(x: number, z: number, r: number): { x: number; z: number } | null {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1], [0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]]) if (this.free(x + dx, z + dz, r)) return { x: x + dx, z: z + dz };
    return null;
  }

  // Those a champion calls up round it, set on the hero: never counted, never kept.
  private callUp(kind: EnemyKind, at: { x: number; z: number }, count: number, level: number): void {
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + 0.4;
      const [x, z] = [at.x + Math.cos(a) * 0.9, at.z + Math.sin(a) * 0.9];
      const spot = this.free(x, z, ENEMY_STATS[kind].radius) ? { x, z } : at;
      this.foes.push(this.standing({ ...makeEnemy(this.spec.firstId + CHAMPION_CALLED + this.calledByChampion++, kind, spot.x, spot.z, spot.x, spot.z, level), state: 'chase' }));
    }
  }

  // One of its foes slain, for good: its post kept (not those called up mid-fight); its boss the first time, a point to
  // spend for the hero (once a dungeon, ever: AWARD_POST kept even through a reset); all of it, cleared (its champion
  // no part of that). What's told.
  slay(enemy: Enemy, hero: Hero): GameEvent[] {
    const post = this.postOf(enemy);
    if (enemy.id < this.spec.firstId || post >= SUMMONED) return [];
    this.slain.add(post);
    if (post === CHAMPION_POST) return [{ kind: 'banner', title: `${enemy.name} slain`, line: 'A champion of the deep, fallen' }];
    const told: GameEvent[] = [];
    const point = post === BOSS_POST && !this.slain.has(AWARD_POST);
    if (point) {
      this.slain.add(AWARD_POST);
      hero.statPoints += 1;
      told.push({ kind: 'point', why: this.bossFell });
    }
    if (this.share === 1) told.push(this.cleared(point));
    return told;
  }

  // How much of it's cleared (0..1): its foes slain and its boss, of all of them.
  get share(): number {
    return clearedShare(this.slain, this.posts);
  }

  // Its boss's chest, if the hero's at it and it's not opened yet.
  chestInReach(hero: { x: number; z: number }): boolean {
    return !!this.chest && !this.chest.open && Math.hypot(hero.x - this.chest.x, hero.z - this.chest.z) < this.spec.chestReach;
  }

  // Whether its chest stands in the way of a walker of half-width r at (x, z): solid, once the hero's first clear of it
  // (it may come to be where they stand: never walled in by it).
  private chestSolid = false;
  chestBlocks(x: number, z: number, r: number): boolean {
    const chest = this.chest;
    if (!chest) return false;
    const over = (px: number, pz: number) => Math.abs(px - chest.x) < r + CHEST_HALF.x && Math.abs(pz - chest.z) < r + CHEST_HALF.z;
    if (!this.chestSolid) {
      const hero = this.director.quarry;
      if (over(hero.x, hero.z)) return false;
      this.chestSolid = true;
    }
    return over(x, z);
  }

  // Opens it: what it holds, out on the floor before it (a charm written down, if there's one, between).
  openChest(): void {
    if (!this.chest || this.chest.open) return;
    this.chest.open = true;
    this.slain.add(CHEST_POST);
    const { item, coins, charm } = this.hoard();
    const { x, z } = this.spec.drop;
    this.hooks.dropLoot(item, this.chest.x + x, this.chest.z + z);
    this.hooks.dropCoins(coins, this.chest.x - x, this.chest.z + z);
    if (charm) this.hooks.dropLoot(charm, this.chest.x, this.chest.z + z * 1.6);
  }
}

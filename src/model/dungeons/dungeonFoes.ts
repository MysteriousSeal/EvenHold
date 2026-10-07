// What every dungeon's run of foes shares (a crypt's guards and lord, crypts/cryptFoes.ts; a cave's beasts and brood
// mother, caves/caveFoes.ts): its foes and their director, the record of those slain for good (by post:
// dungeonRecord.ts), how much of it's cleared, its boss's first fall a point to spend for the hero, and its boss's
// chest (or hoard) once slain, opened once, what it holds out on the floor before it. Each kind its own foes, moves,
// way out and ground.

import type { Enemy, GameEvent, Hero } from '../types';
import type { EnemyDirector } from '../enemies/enemyDirector';
import type { Hoard } from '../loot/hoard';
import type { DungeonHooks, DungeonRun } from './dungeonTypes';
import { AWARD_POST, BOSS_POST, CHEST_POST, SUMMONED, clearedShare } from './dungeonRecord';

export interface DungeonFoesSpec {
  firstId: number; // its foes' ids: this plus their post's number (clear of the world's, the quests', the other kind's)
  chestReach: number; // tiles from its chest the hero can open it
  drop: { x: number; z: number }; // where what's in it lands, off its chest (the gear one side, the coins the other)
}

export abstract class DungeonFoes implements DungeonRun {
  abstract readonly foes: Enemy[];
  abstract readonly director: EnemyDirector;
  chest: { x: number; z: number; open: boolean } | null = null; // the boss's, once slain
  protected abstract readonly posts: number; // all its posts (those its foes stood at)

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

  // One of its foes slain, for good: its post kept (not those called up mid-fight); its boss the first time, a point to
  // spend for the hero (once a dungeon, ever: AWARD_POST kept even through a reset); all of it, cleared. What's told.
  slay(enemy: Enemy, hero: Hero): GameEvent[] {
    const post = this.postOf(enemy);
    if (enemy.id < this.spec.firstId || post >= SUMMONED) return [];
    this.slain.add(post);
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

  // Opens it: what it holds, out on the floor before it.
  openChest(): void {
    if (!this.chest || this.chest.open) return;
    this.chest.open = true;
    this.slain.add(CHEST_POST);
    const { item, coins } = this.hoard();
    const { x, z } = this.spec.drop;
    this.hooks.dropLoot(item, this.chest.x + x, this.chest.z + z);
    this.hooks.dropCoins(coins, this.chest.x - x, this.chest.z + z);
  }
}

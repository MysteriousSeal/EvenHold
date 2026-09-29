// The hero's dealings with the notice boards: what each board offers (its
// six quests, all it will ever have: once one's handed in it's done for
// good, and a board whose six are done has nothing more), the quests
// taken (ten at most, three from any one board), and the foes each gathers where it sends the hero,
// marked for it. While a quest isn't done its pack is kept up: a marked foe
// slain comes back a minute later, so there's always something to hunt.
// Slaying marked foes counts for "slay" quests; for "bring" quests they drop
// what's wanted now and then, and what's in the bag counts.

import { hashUnit } from '../../util/random';
import { makeEnemy } from '../enemies/enemies';
import type { BagItem } from '../hero/bag';
import { gainXp } from '../hero/heroStats';
import type { Enemy, GameEvent, Hero } from '../types';
import { isQuestItem } from './questItems';
import { noticeBoards, type BoardWorld } from './noticeBoards';
import { OFFERS, MAX_ACTIVE, MAX_PER_BOARD, questAt, questProgress, type Quest, type QuestWorld } from './quests';

export const RESPAWN_EVERY = 60; // seconds before a slain marked foe is back
export const BOARD_RANGE = 1.6; // how close the hero must be to read a board
const PACK = 2; // foes gathered for each still asked for
const SPREAD = 2.5; // tiles round the spot a pack gathers in
export const FIRST_MOB_ID = 1_000_000; // marked foes' ids, clear of the world's own

export interface TakenQuest {
  quest: Quest;
  kills: number; // marked foes slain (slay quests)
  respawnIn: number; // seconds before the next marked foe comes back
  tracked: boolean; // shown on screen (the quest tracker); set in the journal
}

export interface QuestHost extends QuestWorld, BoardWorld {
  hero: Hero;
  enemies: Enemy[];
  getGroundY(x: number, z: number): number;
}

export class QuestBook {
  readonly taken: TakenQuest[] = [];
  readonly events: GameEvent[] = []; // progress and rewards to show, drained with the model's (GameModel.takeEvents)
  private readonly completed = new Set<string>(); // quests handed in, by key: done for good
  private readonly gathered = new Map<string, number>(); // foes each quest has gathered so far, by key (their ids and places come from it)

  constructor(private readonly host: QuestHost) {}

  // A board's six quests, in order.
  offersAt(board: number): Quest[] {
    return Array.from({ length: OFFERS }, (_, n) => questAt(this.host, board, n));
  }

  // Whether a quest's been handed in (done for good).
  isCompleted(key: string): boolean {
    return this.completed.has(key);
  }

  // The board the hero is standing at (outdoors), by its village's index; else null.
  boardInReach(): number | null {
    const { hero } = this.host;
    const i = noticeBoards(this.host).findIndex((spot) => Math.hypot(spot.x - hero.x, spot.z - hero.z) <= BOARD_RANGE);
    return i < 0 ? null : i;
  }

  // Whether a board has a quest the hero could take now (one neither taken nor done, and room for it).
  available(board: number): boolean {
    return !this.full && !this.fullAt(board) && Array.from({ length: OFFERS }, (_, n) => `${board}:${n}`).some((key) => !this.takenOf(key) && !this.completed.has(key));
  }

  // Whether a quest taken from a board is done, to hand in there.
  readyAt(board: number): boolean {
    return this.taken.some((t) => t.quest.board === board && this.done(t));
  }

  takenOf(key: string): TakenQuest | null {
    return this.taken.find((t) => t.quest.key === key) ?? null;
  }

  // How far along a quest is: foes slain, or things carried (capped at what's asked).
  progress(taken: TakenQuest): number {
    const { quest } = taken;
    const have = quest.kind === 'kill' ? taken.kills : (this.host.hero.bag[quest.item as BagItem] ?? 0);
    return Math.min(quest.count, have);
  }

  done(taken: TakenQuest): boolean {
    return this.progress(taken) >= taken.quest.count;
  }

  // How many quests are taken from a board; whether that's all it allows.
  takenAt(board: number): number {
    return this.taken.filter((t) => t.quest.board === board).length;
  }

  fullAt(board: number): boolean {
    return this.takenAt(board) >= MAX_PER_BOARD;
  }

  get full(): boolean {
    return this.taken.length >= MAX_ACTIVE;
  }

  // Takes a quest from the board: its foes gather at once.
  accept(quest: Quest): boolean {
    if (this.full || this.fullAt(quest.board) || this.takenOf(quest.key) || this.completed.has(quest.key)) return false;
    const taken = { quest, kills: 0, respawnIn: RESPAWN_EVERY, tracked: true };
    this.taken.push(taken);
    for (let i = this.wanted(taken); i > 0; i--) this.gather(taken);
    return true;
  }

  // Gives up a quest: its foes stay, no longer marked.
  abandon(key: string): void {
    const taken = this.takenOf(key);
    if (!taken) return;
    this.taken.splice(this.taken.indexOf(taken), 1);
    for (const e of this.host.enemies) if (e.quest === key) e.quest = undefined;
  }

  // Hands a done quest in: what was brought is given up, the reward paid
  // (coins, experience), and the quest is done for good.
  // Returns whether it was (it must be done).
  handIn(key: string): boolean {
    const taken = this.takenOf(key);
    if (!taken || !this.done(taken)) return false;
    const { quest } = taken;
    if (quest.item) {
      const bag = this.host.hero.bag;
      const left = (bag[quest.item] ?? 0) - quest.count;
      if (left > 0) bag[quest.item] = left;
      else delete bag[quest.item];
    }
    this.abandon(key);
    this.completed.add(key);
    const { hero } = this.host;
    hero.money += quest.copper;
    gainXp(hero, quest.xp);
    this.events.push({ kind: 'coins', amount: quest.copper });
    return true;
  }

  // A marked foe slain: counts toward its "slay" quest, or, for a "bring"
  // quest, drops what's wanted now and then (returned, else null).
  onKill(enemy: Enemy): BagItem | null {
    const taken = enemy.quest ? this.takenOf(enemy.quest) : null;
    if (!taken || this.done(taken)) return null;
    const { quest } = taken;
    if (quest.kind === 'collect') return hashUnit(enemy.id, this.host.seed % 1_000_003, 91) < quest.dropChance ? quest.item : null;
    taken.kills++;
    this.tell(taken, enemy);
    return null;
  }

  // Something picked up: if a quest wants it, how far along that is now.
  onPickUp(item: BagItem): void {
    const taken = isQuestItem(item) ? this.taken.find((t) => t.quest.item === item) : null;
    if (taken) this.tell(taken, this.host.hero);
  }

  private tell(taken: TakenQuest, at: { x: number; y: number; z: number }): void {
    this.events.push({ kind: 'quest', ...questProgress(taken.quest, this.progress(taken)), x: at.x, y: at.y, z: at.z });
  }

  // Whether a foe wears its quest's mark: marked, and the quest not done.
  marked(enemy: Enemy): boolean {
    const taken = enemy.quest ? this.takenOf(enemy.quest) : null;
    return !!taken && !this.done(taken);
  }

  // Keeps each unfinished quest's pack up, one foe back a minute after each falls.
  update(dt: number): void {
    for (const taken of this.taken) {
      if (this.done(taken) || this.alive(taken) >= this.wanted(taken)) {
        taken.respawnIn = RESPAWN_EVERY;
        continue;
      }
      taken.respawnIn -= dt;
      if (taken.respawnIn > 0) continue;
      taken.respawnIn = RESPAWN_EVERY;
      this.gather(taken);
    }
  }

  // Foes the quest should have about: twice those still to slay, or twice the things asked.
  private wanted(taken: TakenQuest): number {
    return PACK * (taken.quest.kind === 'kill' ? taken.quest.count - taken.kills : taken.quest.count);
  }

  private alive(taken: TakenQuest): number {
    return this.host.enemies.filter((e) => e.quest === taken.quest.key && e.state !== 'dead').length;
  }

  // One more marked foe, somewhere open near the quest's spot. Who it is and
  // where it stands come from the seed, the quest and how many it's gathered
  // (so a given world's quests always play out alike): its id is unique to
  // the quest and its count, and decides the loot it drops.
  private gather(taken: TakenQuest): void {
    const { quest } = taken;
    const count = this.gathered.get(quest.key) ?? 0;
    this.gathered.set(quest.key, count + 1);
    const [board, n] = quest.key.split(':').map(Number);
    const id = FIRST_MOB_ID + (board * 10_000 + n) * 10_000 + count;
    const salt = this.host.seed % 1_000_003;
    let [x, z] = [quest.x, quest.z];
    for (let t = 0; t < 10; t++) {
      const tx = Math.round(quest.x + (hashUnit(id, salt + t, 93) * 2 - 1) * SPREAD);
      const tz = Math.round(quest.z + (hashUnit(id, salt + t, 94) * 2 - 1) * SPREAD);
      if (this.host.isOpenTile(tx, tz)) {
        [x, z] = [tx, tz];
        break;
      }
    }
    const enemy = makeEnemy(id, quest.foe, x, z, x, z, quest.level);
    enemy.quest = quest.key;
    enemy.y = this.host.getGroundY(x, z);
    this.host.enemies.push(enemy);
  }

  // For saving: the quests handed in, and those taken.
  save(): { completed: string[]; taken: Array<{ key: string; kills: number; gathered?: number; tracked?: boolean }> } {
    return {
      completed: [...this.completed],
      taken: this.taken.map((t) => ({ key: t.quest.key, kills: t.kills, gathered: this.gathered.get(t.quest.key) ?? 0, tracked: t.tracked })),
    };
  }

  // Back from a save: the boards as they were, the quests taken again (their foes gathering anew).
  load(data: ReturnType<QuestBook['save']>, boards: number): void {
    const whole = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
    const valid = (key: unknown) => {
      const [board, n] = String(key).split(':').map(Number);
      return whole(board) && board < boards && whole(n) && n < OFFERS;
    };
    for (const key of Array.isArray(data?.completed) ? data.completed : []) if (valid(key)) this.completed.add(key);
    for (const { key, kills, gathered, tracked } of Array.isArray(data?.taken) ? data.taken : []) {
      const [board, n] = String(key).split(':').map(Number);
      if (!valid(key) || this.full || this.takenOf(key) || this.completed.has(key)) continue;
      const quest = questAt(this.host, board, n);
      const taken = { quest, kills: whole(kills) ? Math.min(kills, quest.count) : 0, respawnIn: RESPAWN_EVERY, tracked: tracked !== false };
      this.taken.push(taken);
      this.gathered.set(key, whole(gathered) ? gathered : 0); // the next foes are the ones that would have come next
      for (let i = this.wanted(taken); i > 0; i--) this.gather(taken);
    }
  }
}

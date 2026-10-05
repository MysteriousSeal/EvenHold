// The hero's dealings with the notice boards: what each board offers (its
// six quests, all it will ever have: once one's handed in it's done for
// good, and a board whose six are done has nothing more), the quests
// taken (ten at most, three from any one board), and the foes each
// gathers where it sends the hero, marked for it. While a quest isn't done its pack is kept up: a marked foe
// slain comes back a minute later, so there's always something to hunt.
// Slaying marked foes counts for "slay" quests; for "bring" quests they drop
// what's wanted now and then, and what's in the bag counts.

import { hashUnit } from '../../util/random';
import { makeEnemy } from '../enemies/enemies';
import type { BagItem } from '../hero/bag';
import { gainXp, xpAgainst } from '../hero/heroStats';
import { dropFactor, xpGained } from '../hero/blessing';
import type { Enemy, GameEvent, Hero } from '../types';
import { isQuestItem } from './questItems';
import { noticeBoards, type BoardWorld } from './noticeBoards';
import { OFFERS, MAX_ACTIVE, MAX_PER_BOARD, MAX_TRACKED, boardNumber, questAt, questProgress, type Quest, type QuestWorld } from './quests';

export const RESPAWN_EVERY = 60; // seconds before a slain marked foe is back
const READ_FROM = [0.3, 0.8]; // how far out in front of a board (tiles) the hero can read it: right up against it
const READ_ASIDE = 0.45; // and how far to either side of straight out
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
  readonly streamed?: boolean; // a streamed world's (its boards' numbers big: its quests' foes numbered as gathered)
}

export class QuestBook {
  readonly taken: TakenQuest[] = [];
  readonly events: GameEvent[] = []; // progress and rewards to show, drained with the model's (GameModel.takeEvents)
  private readonly completed = new Set<string>(); // quests handed in, by key: done for good
  private readonly gathered = new Map<string, number>(); // foes each quest has gathered so far, by key (their ids and places come from it)
  private readonly slots = new Map<string, number>(); // a streamed world's quests' own blocks of foe ids, as each is first gathered for

  constructor(private readonly host: QuestHost) {}

  // A board's six quests, in order.
  offersAt(board: number): Quest[] {
    return Array.from({ length: OFFERS }, (_, n) => questAt(this.host, board, n));
  }

  // Whether a quest's been handed in (done for good).
  isCompleted(key: string): boolean {
    return this.completed.has(key);
  }

  // The board the hero is standing in front of (on the tile its notes face,
  // the square's side), by its village's index; else null.
  boardInReach(): number | null {
    const { hero } = this.host;
    const i = noticeBoards(this.host).findIndex(({ x, z, front }) => {
      const out = (hero.x - x) * front.dx + (hero.z - z) * front.dz; // straight out from its face
      const aside = (hero.x - x) * front.dz - (hero.z - z) * front.dx;
      return out >= READ_FROM[0] && out <= READ_FROM[1] && Math.abs(aside) <= READ_ASIDE;
    });
    return i < 0 ? null : boardNumber(this.host, i);
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

  // How far along a quest is: foes slain, or things carried (capped at what's
  // asked). Two quests wanting the same thing share what's carried: the one
  // taken first counts it first, the other only what's over.
  progress(taken: TakenQuest): number {
    const { quest } = taken;
    if (quest.kind === 'kill') return Math.min(quest.count, taken.kills);
    let left = this.host.hero.bag[quest.item as BagItem] ?? 0;
    for (const t of this.taken) {
      if (t === taken) break;
      if (t.quest.item === quest.item) left -= Math.min(t.quest.count, left);
    }
    return Math.min(quest.count, left);
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

  // How many are tracked (shown on screen), three at most.
  get tracked(): number {
    return this.taken.filter((t) => t.tracked).length;
  }

  // Tracks a quest taken, or stops; returns whether it's as asked (not with three tracked already).
  setTracked(key: string, on: boolean): boolean {
    const taken = this.takenOf(key);
    if (!taken) return false;
    if (on && !taken.tracked && this.tracked >= MAX_TRACKED) return false;
    taken.tracked = on;
    return true;
  }

  get full(): boolean {
    return this.taken.length >= MAX_ACTIVE;
  }

  // Takes a quest from the board: its foes gather at once.
  accept(quest: Quest): boolean {
    if (this.full || this.fullAt(quest.board) || this.takenOf(quest.key) || this.completed.has(quest.key)) return false;
    const taken = { quest, kills: 0, respawnIn: RESPAWN_EVERY, tracked: this.tracked < MAX_TRACKED }; // tracked, if there's room
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
    gainXp(hero, this.xpFor(quest));
    this.events.push({ kind: 'coins', amount: quest.copper });
    return true;
  }

  // What a quest's experience is worth to the hero now: less once they've outgrown its foes, more with Wise mind.
  xpFor(quest: Quest): number {
    const { hero } = this.host;
    return xpGained(hero, xpAgainst(quest.xp, quest.level, hero.level));
  }

  // A marked foe slain: counts toward its "slay" quest, or, for a "bring"
  // quest, drops what's wanted now and then (returned, else null).
  onKill(enemy: Enemy): BagItem | null {
    const taken = enemy.quest ? this.takenOf(enemy.quest) : null;
    if (!taken || this.done(taken)) return null;
    const { quest } = taken;
    if (quest.kind === 'collect') return hashUnit(enemy.id, this.host.seed % 1_000_003, 91) < quest.dropChance * dropFactor(this.host.hero) ? quest.item : null;
    taken.kills++;
    this.tell(taken, enemy);
    return null;
  }

  // Something picked up: if a quest wants it, how far along that is now:
  // the quest it counts for, the first (in the order taken) whose share of
  // what's carried it falls in.
  onPickUp(item: BagItem): void {
    if (!isQuestItem(item)) return;
    const carried = this.host.hero.bag[item] ?? 0;
    let shares = 0;
    for (const t of this.taken) {
      if (t.quest.item !== item) continue;
      shares += t.quest.count;
      if (carried <= shares) return this.tell(t, this.host.hero);
    }
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
    // Its foe's id (its spot comes from it too): a classic world's from its board and number; a streamed world's from the
    // quest's own block, given as it's first gathered for (its boards' numbers too big to count from).
    const slot = this.host.streamed ? (this.slots.get(quest.key) ?? this.slots.set(quest.key, this.slots.size).get(quest.key)!) : board * 10_000 + n;
    const id = FIRST_MOB_ID + slot * 10_000 + count;
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
    // (A board's village known, for a quest taken from it: its foes are placed by it; one done, kept anyway.)
    const valid = (key: unknown, known = true) => {
      const [board, n] = String(key).split(':').map(Number);
      return whole(board) && (!known || (this.host.villageOf ? !!this.host.villageOf(board) : board < boards)) && whole(n) && n < OFFERS;
    };
    for (const key of Array.isArray(data?.completed) ? data.completed : []) if (valid(key, false)) this.completed.add(key);
    for (const { key, kills, gathered, tracked } of Array.isArray(data?.taken) ? data.taken : []) {
      const [board, n] = String(key).split(':').map(Number);
      if (!valid(key) || this.full || this.fullAt(board) || this.takenOf(key) || this.completed.has(key)) continue;
      const quest = questAt(this.host, board, n);
      const taken = { quest, kills: whole(kills) ? Math.min(kills, quest.count) : 0, respawnIn: RESPAWN_EVERY, tracked: tracked !== false && this.tracked < MAX_TRACKED };
      this.taken.push(taken);
      this.gathered.set(key, whole(gathered) ? gathered : 0); // the next foes are the ones that would have come next
      for (let i = this.wanted(taken); i > 0; i--) this.gather(taken);
    }
  }
}

// The hero's dealings with the notice boards: what each board offers (five
// quests, a taken one staying pinned up until it's handed in), the quests
// taken (three at most), and the foes each gathers where it sends the hero,
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
import { OFFERS, MAX_ACTIVE, questAt, questProgress, type Quest, type QuestWorld } from './quests';

export const RESPAWN_EVERY = 60; // seconds before a slain marked foe is back
export const BOARD_RANGE = 1.6; // how close the hero must be to read a board
const PACK = { wolf: 4, bandit: 3 }; // foes kept around a "bring" quest's spot
const SPREAD = 2.5; // tiles round the spot a pack gathers in
export const FIRST_MOB_ID = 1_000_000; // marked foes' ids, clear of the world's own

export interface TakenQuest {
  quest: Quest;
  kills: number; // marked foes slain (slay quests)
  respawnIn: number; // seconds before the next marked foe comes back
}

export interface QuestHost extends QuestWorld, BoardWorld {
  hero: Hero;
  enemies: Enemy[];
  getGroundY(x: number, z: number): number;
}

export class QuestBook {
  readonly taken: TakenQuest[] = [];
  readonly events: GameEvent[] = []; // progress and rewards to show, drained with the model's (GameModel.takeEvents)
  private readonly offers = new Map<number, number[]>(); // each board's quest numbers (the seed's first five, until some are handed in)
  private nextMobId = FIRST_MOB_ID;

  constructor(private readonly host: QuestHost) {}

  // A board's five quests, in order.
  offersAt(board: number): Quest[] {
    return this.numbersAt(board).map((n) => questAt(this.host, board, n));
  }

  private numbersAt(board: number): number[] {
    let numbers = this.offers.get(board);
    if (!numbers) this.offers.set(board, (numbers = Array.from({ length: OFFERS }, (_, n) => n)));
    return numbers;
  }

  // The board the hero is standing at (outdoors), by its village's index; else null.
  boardInReach(): number | null {
    const { hero } = this.host;
    const i = noticeBoards(this.host).findIndex((spot) => Math.hypot(spot.x - hero.x, spot.z - hero.z) <= BOARD_RANGE);
    return i < 0 ? null : i;
  }

  // Whether a board has a quest the hero could take now (one not taken, and room for it).
  available(board: number): boolean {
    return !this.full && this.numbersAt(board).some((n) => !this.takenOf(`${board}:${n}`));
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

  get full(): boolean {
    return this.taken.length >= MAX_ACTIVE;
  }

  // Takes a quest from the board: its foes gather at once.
  accept(quest: Quest): boolean {
    if (this.full || this.takenOf(quest.key)) return false;
    const taken = { quest, kills: 0, respawnIn: RESPAWN_EVERY };
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
  // (coins, experience), and the board pins up a new quest in its place.
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
    const numbers = this.numbersAt(quest.board);
    const n = Number(key.split(':')[1]);
    numbers[numbers.indexOf(n)] = Math.max(...numbers) + 1;
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

  // Foes the quest should have about: those still to slay, or a pack.
  private wanted(taken: TakenQuest): number {
    return taken.quest.kind === 'kill' ? taken.quest.count - taken.kills : PACK[taken.quest.foe];
  }

  private alive(taken: TakenQuest): number {
    return this.host.enemies.filter((e) => e.quest === taken.quest.key && e.state !== 'dead').length;
  }

  // One more marked foe, somewhere open near the quest's spot.
  private gather(taken: TakenQuest): void {
    const { quest } = taken;
    const id = this.nextMobId++;
    let [x, z] = [quest.x, quest.z];
    for (let t = 0; t < 10; t++) {
      const tx = Math.round(quest.x + (hashUnit(id, t, 93) * 2 - 1) * SPREAD);
      const tz = Math.round(quest.z + (hashUnit(id, t, 94) * 2 - 1) * SPREAD);
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

  // For saving: each board's offers, and the quests taken.
  save(): { boards: Array<{ board: number; offers: number[] }>; taken: Array<{ key: string; kills: number }> } {
    return {
      boards: [...this.offers].map(([board, offers]) => ({ board, offers: [...offers] })),
      taken: this.taken.map((t) => ({ key: t.quest.key, kills: t.kills })),
    };
  }

  // Back from a save: the boards as they were, the quests taken again (their foes gathering anew).
  load(data: ReturnType<QuestBook['save']>, boards: number): void {
    const whole = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
    for (const { board, offers } of Array.isArray(data?.boards) ? data.boards : []) {
      if (whole(board) && board < boards && Array.isArray(offers) && offers.length === OFFERS && offers.every(whole)) this.offers.set(board, [...offers]);
    }
    for (const { key, kills } of Array.isArray(data?.taken) ? data.taken : []) {
      const [board, n] = String(key).split(':').map(Number);
      if (!whole(board) || board >= boards || !this.numbersAt(board).includes(n) || this.full || this.takenOf(key)) continue;
      if (this.accept(questAt(this.host, board, n))) {
        const taken = this.taken[this.taken.length - 1];
        taken.kills = whole(kills) ? Math.min(kills, taken.quest.count) : 0;
        // Only the foes still to slay.
        const extra = this.alive(taken) - this.wanted(taken);
        for (let i = this.host.enemies.length - 1, left = extra; i >= 0 && left > 0; i--) {
          if (this.host.enemies[i].quest === key) {
            this.host.enemies.splice(i, 1);
            left--;
          }
        }
      }
    }
  }
}

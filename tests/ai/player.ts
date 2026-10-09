// The whole game, for an AI learning it from nothing (train.py): a new world and a new hero each life, as a new player
// launching the game, played a decision at a time by the game's own keys (keys.ts) and the clicks a player makes in its
// windows (windows.ts), seeing only what's on screen (senses.ts). It's told nothing of what's good to do. It's paid
// (PAY) for what the game itself counts as getting on: experience (a level's worth: 1), coin earned, quests handed in;
// and pays for falling. Whatever path pays most is the one it takes: that's what the hour says about the game's
// balance (play.ts: the report). Each life is EPISODE game minutes; windows that hold the game (the board's, the jobs')
// hold it here too, a few decisions at most.
import { GameModel } from '../../src/model/GameModel';
import { STREAMED_SIZE } from '../../src/model/worldgen/regions';
import { maxHpOf } from '../../src/model/hero/attributes';
import { xpToNext } from '../../src/model/hero/heroStats';
import { chestInReach } from '../../src/model/loot/chests';
import { talkingTo } from '../../src/model/npcs/talk';
import { travellerInReach } from '../../src/model/travellers/travellerTalk';
import { takeStairs, useHallDoor } from '../../src/model/interiors/upstairs';
import { callBarkeep, placeOrder } from '../../src/model/inn/barOrders';
import { rentRoom, roomAction, sleepTillMorning } from '../../src/model/inn/roomLetting';
import { shopAt } from '../../src/model/inn/tavernShop';
import { doorNumber } from '../../src/model/interiors/interiors';
import { barmaidHere, callFor, serveOrder, type BarMenuItem } from '../../src/controller/trade/barOrder';
import { isHerbalistHome } from '../../src/model/herbalist/herbalistHomes';
import { goesUnder } from '../../src/model/dungeons/dungeonTypes';
import { mulberry32 } from '../../src/util/random';
import type { Enemy } from '../../src/model/types';
import { FRAME, FRAMES_PER_DECISION, KEYS, MOVES, ROWS, ROW_KEY, WAYS, type Key } from './keys';
import { EVENTS, OBSERVATION_SIZE, Senses, prompt } from './senses';
import { openWindow, shown, type Window, type WindowKind } from './windows';
import { count, emptyTally, type Tally } from './tally';

export { FRAME, FRAMES_PER_DECISION, MOVES, OBSERVATION_SIZE };
export const ACTIONS = KEYS.length;

export const EPISODE_MINUTES = Number(process.env.AI_MINUTES ?? 30); // game minutes a life lasts
const MODAL_MOST = 16; // decisions a window that holds the game may hold it for
// What it's paid for, and what it pays: the game's own progress, nothing else.
export const PAY = {
  level: 1, // a level's worth of experience
  coin: 1 / 500, // each copper earned (not what's spent: coin's for spending)
  quest: 1, // a quest handed in
  fall: -1,
};

export interface PlayStep {
  observation: number[];
  reward: number;
  done: boolean;
  truncated: boolean;
  info: Tally;
}

export class Player {
  model!: GameModel;
  senses!: Senses;
  tally = emptyTally();
  window: Window | null = null;
  private t = 0;
  private way: [number, number] = [0, 0];
  private picked = 0; // the row last picked
  private held = 0; // decisions a modal window has held the game
  private events = new Set<string>(); // what the game told this decision
  private before = { xp: 0, money: 0, hp: 0 };
  private paid = 0; // paid (or paying) this decision, besides what settle() works out
  private order: { served: boolean; what: BarMenuItem } | null = null; // an order on its way to the hero's stool
  private alive = new Set<Enemy>(); // foes seen alive near, to count the kills

  // A new life: a new world (from `seed`) and a new hero in it.
  reset(seed: number): number[] {
    Math.random = mulberry32(seed ^ 0x5eed);
    this.model = new GameModel(seed, STREAMED_SIZE);
    this.senses = new Senses(this.model);
    const fall = this.model.fall;
    this.model.fall = () => ((this.tally.falls++, this.paid += PAY.fall), fall());
    [this.t, this.way, this.picked, this.held, this.paid, this.order, this.window] = [0, [0, 0], 0, 0, 0, null, null];
    [this.tally, this.events, this.alive] = [emptyTally(), new Set(), new Set()];
    this.before = { xp: 0, money: this.model.hero.money, hp: this.model.hero.hp };
    this.model.takeEvents();
    return this.observe();
  }

  get seconds(): number {
    return this.t;
  }

  // One decision: a way (0 still, 1..8) and a key (KEYS, by index), the game played on a decision's worth (held, by a
  // window that holds it: not at all), and the reckoning. (The watch page does the same a frame at a time: decide,
  // advance, settle.)
  step(move: number, keyIndex: number): PlayStep {
    const held = this.decide(move, keyIndex);
    if (!held) for (let f = 0; f < FRAMES_PER_DECISION; f++) this.advance(FRAME);
    return this.settle(held);
  }

  // The decision made: its key pressed, its way taken up; whether a window holds the game meanwhile.
  decide(move: number, keyIndex: number): boolean {
    const key = KEYS[keyIndex] ?? 'none';
    count(this.tally.keys, key);
    this.press(key);
    this.way = WAYS[move] ?? [0, 0];
    if (this.window && !this.window.valid()) this.window = null;
    const holds = !!this.window?.modal;
    if (holds && ++this.held > MODAL_MOST) [this.window, this.held] = [null, 0];
    if (!holds) {
      this.held = 0;
      if (this.way[0] || this.way[1]) this.tally.moving++;
    }
    return holds;
  }

  advance(dt: number): void {
    const { model } = this;
    model.update(this.way[0], this.way[1], dt);
    this.t += dt;
    if (this.order?.served) {
      const { drank } = serveOrder(model, this.order.what);
      if (drank) this.order.what === 'ale' ? this.tally.ales++ : this.tally.pies++;
      this.order = null;
    }
    const { places } = this.tally;
    const inside = model.inside;
    const place = inside ? (inside.below ? 'upstairs' : goesUnder(inside.entrance) ? 'dungeon' : inside.entrance.type === 'house' && isHerbalistHome(inside.entrance) ? 'herbalist' : (inside.entrance.type as 'inn' | 'smithy' | 'house')) : model.campLife.status(model.hero) ? 'camp' : 'outdoors';
    places[place] += dt;
  }

  // A key, as the game has it.
  private press(key: Key): void {
    const { model } = this;
    const { hero } = model;
    const w = this.window;
    model.raiseGuard(key === 'guard');
    switch (key) {
      case 'strike': return void model.startAttack();
      case 'roll': return void model.roll(...this.way);
      case 'focus': return void model.cycleFocus();
      case 'use': return this.pressE();
      case 'ale': return this.orderAtTheBar('ale');
      case 'other': return this.pressG();
      case 'bag': return this.toggle('bag');
      case 'points': return this.toggle('points');
      case 'skills': return this.toggle('recipes');
      case 'close': return void (this.window = null);
      case 'button': return void (w && this.did(shown(w)[this.picked]?.other?.()));
      case 'page': return void w?.flip?.();
      case 'down': return void (w && (w.offset = Math.min(w.offset + ROWS, Math.max(0, w.rows().length - 1))));
      case 'up': return void (w && (w.offset = Math.max(0, w.offset - ROWS)));
      default: {
        const i = KEYS.indexOf(key) - ROW_KEY;
        if (i >= 0 && i < ROWS && w) {
          this.picked = i;
          const row = shown(w)[i];
          if (row) this.did(row.act());
          else if (hero.level) this.tally.wasted++;
        }
      }
    }
  }

  // What a window's button came to, counted; a shift begun or a quest handed in shuts the window, as the game's do.
  private did(what: string | null | undefined): void {
    if (!what) return;
    const { tally } = this;
    if (what === 'questTaken') tally.quests.taken++;
    else if (what === 'questDone') [tally.quests.done++, (this.paid += PAY.quest)];
    else if (what === 'questAbandoned') tally.quests.abandoned++;
    else if (what === 'shift') [tally.shifts++, (this.window = null)];
    else if (what in tally && typeof (tally as unknown as Record<string, unknown>)[what] === 'number') (tally as unknown as Record<string, number>)[what]++;
    else if (what === 'fitted') tally.equipped++;
    else if (what === 'dropped' || what === 'bedroll') count(tally.did, what);
    if (what === 'questDone' && this.window?.kind === 'board' && this.window.rows().length === 0) this.window = null;
  }

  private toggle(kind: WindowKind): void {
    this.window = this.window?.kind === kind ? null : this.open(kind);
  }

  private open(kind: WindowKind, about?: Parameters<typeof openWindow>[2]): Window | null {
    const w = openWindow(this.model, kind, about);
    if (w) [count(this.tally.windows, kind), (this.picked = 0)];
    return w;
  }

  // E, as the game has it (GameController): at work, the work's; chopping, stop; loot picked up; the inn's board (a
  // shift); a chest opened; a tree chopped; the barmaid from a stool; sat down or up; a word with a keeper (their
  // window), a traveller (a pedlar's); a board read (its window); the bench (its window); a coin in the well; a door.
  private pressE(): void {
    const { model, tally } = this;
    const { hero } = model;
    if (prompt(model) === 'none') tally.wasted++;
    if (model.work.shift) {
      if (!model.work.use() && model.work.noticeInReach) this.window = this.open('jobs', model.work.noticeInReach);
      return;
    }
    if (model.lumber.chopping) return model.lumber.stop();
    if (model.pickUp()) return;
    const talker = talkingTo(model.folk, model.inside, hero);
    if (model.work.noticeInReach) return void (this.window = this.open('jobs', model.work.noticeInReach));
    const chest = chestInReach(model);
    if (chest) {
      chest.open();
      if (chest.what !== 'locked' && !chestInReach(model)) tally.chests++;
      return;
    }
    if (model.lumber.action?.kind === 'chop') return void (model.lumber.use() && count(tally.did, 'chopBegun'));
    if (talker && model.inside?.seated?.seat.piece.kind === 'barStool') return void (this.window = this.open(talker.role === 'barkeep' ? 'inn' : 'smith', talker));
    if (model.sitOrStand()) return;
    const board = model.boardInReach;
    const leaving = !!model.inside && !!model.doorInReach;
    const traveller = !model.inside && !model.yard ? travellerInReach(model.travellers.list, hero) : null;
    if (talker && !leaving) {
      if (talker.role === 'bouncer') return;
      return void (this.window = this.open(talker.role === 'barkeep' ? 'inn' : talker.role === 'smith' ? 'smith' : 'herbalist', talker));
    }
    if (traveller) return void (traveller.role === 'pedlar' ? (this.window = this.open('pedlar', traveller)) : count(tally.did, 'travellerWord'));
    if (board !== null) return void (this.window = this.open('board', board));
    if (model.salvage.benchInReach) return void (this.window = this.open('salvage'));
    if (model.wellInReach !== null) return void (model.tossCoin() && tally.wishes++);
    if (!useHallDoor(model) && !takeStairs(model)) {
      const door = model.doorInReach;
      if (model.useDoor() && door && !model.inside?.below) count(tally.doors, door.type === 'house' && isHerbalistHome(door) ? 'herbalist' : door.type);
    }
  }

  // F: an ale from the stool; G: a pie there, else a room off the barmaid, else sleep in the let bed at night.
  private orderAtTheBar(what: BarMenuItem): void {
    const { model } = this;
    const stool = model.inside?.seated?.seat.piece;
    const barmaid = barmaidHere(model);
    if (!stool || stool.kind !== 'barStool' || !barmaid || this.order || model.hero.drinking || model.hero.eating || !callFor(model, what).coming) return;
    const order = { served: false, what };
    this.order = order;
    placeOrder(model.inside!.entrance, { stool, by: null, drink: what, served: () => void (order.served = true) });
    callBarkeep(barmaid);
  }

  private pressG(): void {
    const { model, tally } = this;
    if (model.inside?.seated?.seat.piece.kind === 'barStool') return this.orderAtTheBar('pie');
    const action = roomAction(model);
    if (action?.kind === 'rent') {
      if (rentRoom(model, action.barmaid, shopAt(model.shops, model.seed, doorNumber(model.inside!.entrance))) === 'let') tally.rooms++;
    } else if (action?.kind === 'sleep') {
      if (!model.seated) model.sitOrStand();
      sleepTillMorning(model);
      count(tally.did, 'slept');
    }
  }

  // The decision's reckoning: what it's paid, what it sees next, where it stands.
  settle(held: boolean): PlayStep {
    const { model, tally } = this;
    const { hero } = model;
    const xp = totalXp(hero.level, hero.xp);
    let reward = this.paid + ((xp - this.before.xp) / xpToNext(hero.level)) * PAY.level;
    const coin = hero.money - this.before.money;
    if (coin > 0) [tally.earned += coin, (reward += coin * PAY.coin)];
    else tally.spent -= coin;
    if (hero.hp < this.before.hp) tally.hurt += (this.before.hp - hero.hp) / maxHpOf(hero);
    this.before = { xp, money: hero.money, hp: hero.hp };
    this.paid = 0;
    this.kills();
    this.events = this.told();
    Object.assign(tally, { seconds: this.t, level: hero.level, xp, money: hero.money });
    return { observation: this.observe(), reward, done: false, truncated: !held && this.t >= EPISODE_MINUTES * 60, info: tally };
  }

  // Foes near that were alive and now aren't: slain (by the hero: nothing else kills them).
  private kills(): void {
    const { hero } = this.model;
    for (const e of this.model.foes) {
      const near = Math.abs(e.x - hero.x) < 12 && Math.abs(e.z - hero.z) < 12;
      if (e.state !== 'dead') {
        if (near) this.alive.add(e);
        continue;
      }
      if (this.alive.delete(e)) this.tally.kills++;
    }
  }

  // What the game told this decision (floating text, a word), by kind.
  private told(): Set<string> {
    const kinds = new Set<string>();
    for (const event of this.model.takeEvents()) {
      if (event.kind === 'hit') kinds.add(event.on === 'hero' ? 'hitTaken' : 'hitDealt');
      else if (event.kind === 'quest') kinds.add(event.done ? 'questDone' : 'quest');
      else if (event.kind === 'cleared') [kinds.add('cleared'), event.place === 'camp' ? this.tally.camps++ : this.tally.dungeons++];
      else if (event.kind === 'felled') [kinds.add('felled'), this.tally.chopped++];
      else if ((EVENTS as readonly string[]).includes(event.kind)) kinds.add(event.kind);
    }
    return kinds;
  }

  observe(): number[] {
    return this.senses.observe(this.window, this.events);
  }
}

// Experience earned in all, from level 1: each level's to the next, and what's toward the next.
export function totalXp(level: number, xp: number): number {
  let total = xp;
  for (let l = 1; l < level; l++) total += xpToNext(l);
  return total;
}

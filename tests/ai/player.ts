// The whole game, for an AI learning it from nothing (train.py): a new world and a new hero each life, as a new player
// launching the game, played a decision at a time by the game's own keys (keys.ts) and the clicks a player makes in its
// windows (windows.ts), seeing only what's on screen (senses.ts). It's told nothing of what's good to do. It's paid
// (PAY) for what the game itself counts as getting on: experience (a level's worth: 1), coin earned, quests handed in;
// and pays for falling. Two helpers besides, while it learns (a hero pressing keys at random earns nothing of the
// game's for millions of decisions, and learns nothing): a little for each new patch of ground walked onto (up to
// EXPLORE_MOST a life), and a share of each blow landed on a foe. Each source of pay is kept apart (tally.pay), so the
// report can always tell the game's own rewards from the helpers'. Whatever path pays most is the one it takes:
// that's what a life says about the game's balance (play.ts: the report). Each life is EPISODE game minutes; windows that hold the game (the board's, the jobs')
// hold it here too, a few decisions at most.
import { GameModel } from '../../src/model/GameModel';
import { STREAMED_SIZE } from '../../src/model/worldgen/regions';
import { maxHpOf } from '../../src/model/hero/attributes';
import { xpToNext } from '../../src/model/hero/heroStats';
import { chestInReach } from '../../src/model/loot/chests';
import { takeStairs, useHallDoor } from '../../src/model/interiors/upstairs';
import { callBarkeep, placeOrder } from '../../src/model/inn/barOrders';
import { rentRoom, roomAction, sleepTillMorning } from '../../src/model/inn/roomLetting';
import { shopAt } from '../../src/model/inn/tavernShop';
import { doorNumber } from '../../src/model/interiors/interiors';
import { barmaidHere, callFor, serveOrder, type BarMenuItem } from '../../src/controller/trade/barOrder';
import { isHerbalistHome } from '../../src/model/herbalist/herbalistHomes';
import { goesUnder } from '../../src/model/dungeons/dungeonTypes';
import { mulberry32 } from '../../src/util/random';
import { interactionOf, type Interaction, type InteractionKind } from '../../src/model/hero/interaction';
import type { Who } from '../../src/model/story/story';
import type { Enemy } from '../../src/model/types';
import { FRAME, FRAMES_PER_DECISION, KEYS, MOVES, ROWS, ROW_KEY, WAYS, type Key } from './keys';
import { EVENTS, OBSERVATION_SIZE, Senses, patchOf } from './senses';
import { openWindow, shown, type Window, type WindowKind } from './windows';
import { count, emptyTally, type PaySource, type Tally } from './tally';

export { FRAME, FRAMES_PER_DECISION, MOVES, OBSERVATION_SIZE };
export const ACTIONS = KEYS.length;

export const EPISODE_MINUTES = Number((typeof process !== 'undefined' && process.env.AI_MINUTES) || 10); // game minutes a life lasts (AI_MINUTES; short while it learns, many lives)
const MODAL_MOST = 16; // decisions a window that holds the game may hold it for
// What it's paid for, and what it pays: the game's own progress, nothing else.
export const PAY = {
  level: 1, // a level's worth of experience
  coin: 1 / 500, // each copper earned (not what's spent: coin's for spending)
  quest: 1, // a quest handed in
  fall: -1,
  // The helpers:
  explore: 0.01, // a new patch of ground (PATCH tiles a side), outdoors
  blow: 0.3, // a foe's whole health in blows landed
};
const EXPLORE_MOST = 1.5; // paid for new ground, at most a life (else a walker, not a player)

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
  private foeHp = new Map<Enemy, number>(); // the foes near, as they last stood: blows landed, by their health lost
  private walked = new Set<number>(); // patches of ground walked onto, this life

  // A new life: a new world (from `seed`) and a new hero in it.
  reset(seed: number): number[] {
    Math.random = mulberry32(seed ^ 0x5eed);
    this.model = new GameModel(seed, STREAMED_SIZE);
    this.senses = new Senses(this.model);
    const fall = this.model.fall;
    this.model.fall = () => ((this.tally.falls++, this.earn('fall', PAY.fall)), fall());
    [this.t, this.way, this.picked, this.held, this.paid, this.order, this.window] = [0, [0, 0], 0, 0, 0, null, null];
    [this.tally, this.events, this.alive, this.foeHp, this.walked] = [emptyTally(), new Set(), new Set(), new Map(), new Set()];
    this.walked.add(patchOf(this.model.hero.x, this.model.hero.z)); // (where it wakes: not new)
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
    else if (what === 'questDone') [tally.quests.done++, this.earn('quest', PAY.quest)];
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

  // E, as the game has it (model/hero/interaction.ts: the first thing there to be done; one that comes to nothing, the
  // next): a keeper's, a board's, the bench's window opened here (windows.ts) where the game opens its own; a word
  // with someone of the story's answered at once with the first answer (a quest taken, or handed in).
  private pressE(): void {
    const { model, tally } = this;
    const tried = new Set<InteractionKind>();
    let found = interactionOf(model);
    if (!found) tally.wasted++;
    for (; found && !this.interact(found); found = interactionOf(model, tried)) tried.add(found.kind);
  }

  private interact(found: Interaction): boolean {
    const { model, tally } = this;
    const opened = (window: Window | null) => ((this.window = window), true);
    switch (found.kind) {
      case 'work':
        return model.work.use();
      case 'jobBoard':
        return opened(this.open('jobs', found.inn));
      case 'stopChop':
        return model.lumber.stop(), true;
      case 'stopMine':
        return model.mining.stop(), true;
      case 'loot':
        return !!model.pickUp();
      case 'chest':
        found.chest.open();
        if (found.chest.what !== 'locked' && !chestInReach(model)) tally.chests++;
        return true;
      case 'carter':
        return this.word(found.carter), true;
      case 'chop':
        return model.lumber.use() && (count(tally.did, 'chopBegun'), true);
      case 'talk':
        if (this.word(found.npc) || found.npc.role === 'bouncer') return true;
        return opened(this.open(found.npc.role === 'barkeep' ? 'inn' : found.npc.role === 'smith' ? 'smith' : 'herbalist', found.npc));
      case 'stand':
      case 'sit':
        return model.sitOrStand();
      case 'traveller':
        return found.traveller.role === 'pedlar' ? opened(this.open('pedlar', found.traveller)) : (count(tally.did, 'travellerWord'), true);
      case 'board':
        return opened(this.open('board', found.board));
      case 'bench':
        return opened(this.open('salvage'));
      case 'fire':
        return false; // (no cooking for the player yet)
      case 'anvil':
        return false; // (no smithing for the player yet)
      case 'well':
        return model.tossCoin() && tally.wishes++, true;
      case 'hallDoor':
        return useHallDoor(model);
      case 'stairs':
        return takeStairs(model);
      case 'door': {
        const went = model.useDoor();
        if (went && !model.inside?.below) count(tally.doors, found.door.type === 'house' && isHerbalistHome(found.door) ? 'herbalist' : found.door.type);
        return went;
      }
      case 'fish':
      case 'fishing':
        return model.fishing.use();
      case 'mine':
        return model.mining.use();
      case 'cannotChop':
      case 'cannotFish':
      case 'cannotMine':
        return tally.wasted++, true;
    }
  }

  // A word with someone of the story's, if they've one to say: the first answer given (a quest taken, handed in).
  private word(who: Who): boolean {
    const talk = this.model.story.talk(who);
    if (!talk) return false;
    const before = this.model.story.save().states;
    talk.answers[0]?.pick();
    const now = this.model.story.save().states;
    for (const id of Object.keys(now)) if (now[id] !== before[id]) now[id] === 'done' ? [this.tally.quests.done++, this.earn('quest', PAY.quest)] : this.tally.quests.taken++;
    return true;
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
    this.earn('xp', ((xp - this.before.xp) / xpToNext(hero.level)) * PAY.level);
    const coin = hero.money - this.before.money;
    if (coin > 0) [(tally.earned += coin), this.earn('coin', coin * PAY.coin)];
    else tally.spent -= coin;
    this.explored();
    this.blows();
    const reward = this.paid;
    if (hero.hp < this.before.hp) tally.hurt += (this.before.hp - hero.hp) / maxHpOf(hero);
    this.before = { xp, money: hero.money, hp: hero.hp };
    this.paid = 0;
    this.kills();
    this.events = this.told();
    Object.assign(tally, { seconds: this.t, level: hero.level, xp, money: hero.money });
    return { observation: this.observe(), reward, done: false, truncated: !held && this.t >= EPISODE_MINUTES * 60, info: tally };
  }

  // Pay, kept by what for.
  private earn(source: PaySource, amount: number): void {
    if (!amount) return;
    this.paid += amount;
    this.tally.pay[source] += amount;
  }

  // A new patch of ground walked onto, outdoors: a little, up to EXPLORE_MOST a life.
  private explored(): void {
    const { model } = this;
    if (model.inside) return;
    const patch = patchOf(model.hero.x, model.hero.z);
    if (this.walked.has(patch)) return;
    this.walked.add(patch);
    this.earn('explore', Math.max(0, Math.min(PAY.explore, EXPLORE_MOST - this.tally.pay.explore)));
  }

  // Blows landed on foes near: each one's health lost, as a share of its whole (a kill's own pay is its experience).
  private blows(): void {
    const { hero } = this.model;
    for (const e of this.model.foes) {
      if (Math.abs(e.x - hero.x) > 12 || Math.abs(e.z - hero.z) > 12) {
        this.foeHp.delete(e);
        continue;
      }
      const now = e.state === 'dead' ? 0 : Math.max(0, e.hp);
      const was = this.foeHp.get(e);
      if (was !== undefined && now < was) this.earn('blows', ((was - now) / e.maxHp) * PAY.blow);
      if (e.state === 'dead') this.foeHp.delete(e);
      else this.foeHp.set(e, now);
    }
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
    return this.senses.observe(this.window, this.events, this.walked);
  }
}

// Experience earned in all, from level 1: each level's to the next, and what's toward the next.
export function totalXp(level: number, xp: number): number {
  let total = xp;
  for (let l = 1; l < level; l++) total += xpToNext(l);
  return total;
}

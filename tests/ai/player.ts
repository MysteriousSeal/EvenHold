// The whole game, for a player learning it from nothing (tests/ai/: train.py --env player): a world of its own (512
// a side, one of a few, made once and played again and again), the hero set down in it new (level 1, nothing on),
// played a decision at a time by keys alone, as a player would: which way to go (still, or one of 8), and one key
// (none, a blow, a roll, the guard, E, eat, put on the newest piece of gear). What it sees is what a player sees on
// screen, and no more: the ground round them (15 tiles a side: what blocks, water, paving, doors, foes, folk, loot,
// what's been walked before), how they stand (health, energy, breath, level, coin, the time of day), what E would do
// now (the prompt), and the quests taken (the tracker's arrows). It knows nothing of what's good to do: it's paid (PAY)
// for experience, quests and each step of them, places found, ground walked, blows landed, chests opened, camps and
// dungeons cleared, better gear, coin, a meal when hurt; and pays for falling, for being hurt, and a little for keys
// pressed for nothing (E with nothing to do, a roll with no foe near, walking into a wall); and learns.
// What needs a window (spending points, the notice board's button, the bar's order) goes as its key would: points
// spread at once, E at a board hands in what's done there else takes the next quest, E on a bar stool orders an ale.
import { GameModel } from '../../src/model/GameModel';
import { generateWorld } from '../../src/model/worldgen/world';
import type { World } from '../../src/model/types';
import { maxEnergyOf, maxHpOf } from '../../src/model/hero/attributes';
import { xpToNext } from '../../src/model/hero/heroStats';
import { STATS } from '../../src/model/hero/statKinds';
import { isProvision, PROVISIONS } from '../../src/model/loot/provisions';
import { canWear, gearSpecs, isGear, slotOfGear, type GearKey } from '../../src/model/human/items/gear';
import { chestInReach } from '../../src/model/loot/chests';
import { talkingTo } from '../../src/model/npcs/talk';
import { travellerInReach } from '../../src/model/travellers/travellerTalk';
import { doorAt, stairsInReach, takeStairs, useHallDoor } from '../../src/model/interiors/upstairs';
import { bumpsFurniture } from '../../src/model/interiors/furniture';
import { boardSpot } from '../../src/model/quests/noticeBoards';
import { onPaving } from '../../src/model/map/roads';
import { callBarkeep, placeOrder } from '../../src/model/inn/barOrders';
import { barmaidHere, callFor, serveOrder } from '../../src/controller/trade/barOrder';
import { HERO_RADIUS, INDOOR_SCALE } from '../../src/model/constants';
import { mulberry32 } from '../../src/util/random';
import type { MapSize } from '../../src/model/map/grid';
import { FRAME, FRAMES_PER_DECISION, MOVES, WAYS } from './keys';

export { FRAME, FRAMES_PER_DECISION, MOVES };

const EPISODE = 15 * 60; // game seconds a life lasts (a quarter of a game hour... of a real hour)
const SIZE: MapSize = { width: 512, depth: 512 };
const WORLD_SEEDS = [11, 12, 13, 14]; // the worlds it learns in
const VIEW = 7; // tiles each way round the hero it sees (15 a side)
const CELL = 8; // tiles a side of the patches it's paid for walking into, the first time
const CHANNELS = 9;
const PROMPTS = ['none', 'loot', 'chest', 'stand', 'sit', 'talk', 'traveller', 'board', 'well', 'stairs', 'door', 'bar'] as const;
const TRACKED = 3; // quests seen on the tracker
export const KEYS = 7; // none, a blow, a roll, the guard, E, eat, put on gear
// What it's paid for, and what it pays (a level's experience: 1). Each step of a quest paid once (taken, each foe or
// thing toward it, back at its board done), whatever's given up and taken again; blows only on foes fighting them (a
// boar let be is no punching bag); coin no more than COIN_MOST a life (foes keep coming: else a coin farm).
const PAY = {
  level: 1, // a level's worth of experience
  questDone: 1, // a quest handed in
  questTaken: 0.2,
  questStep: 0.1, // each foe slain or thing gathered toward it
  questBack: 0.3, // back at its board with it done
  place: 0.3, // a village, crypt, cave or camp come near, the first time
  patch: 0.01, // a patch of ground walked into, the first time
  dealt: 0.1, // a foe's whole health in blows (on one fighting them)
  chest: 0.5,
  cleared: 1, // a camp cleared, a dungeon's boss slain
  gear: 0.02, // a point better (armour and stats) put on
  coin: 0.002, // a copper picked up
  meal: 0.05, // eaten when hurt
  fall: -1,
  hurt: -0.5, // a whole health bar lost
  wasted: -0.001, // E with nothing to do, a roll with no foe near, a step into a wall
};
const COIN_MOST = 0.5; // coin paid a life, at most
export const OBSERVATION_SIZE = (2 * VIEW + 1) ** 2 * CHANNELS + 11 + PROMPTS.length + TRACKED * 5;

const worlds = new Map<number, World>();

export interface PlayStep {
  observation: number[];
  reward: number;
  done: boolean;
  truncated: boolean;
  info: { level: number; xp: number; quests: number; taken: number; falls: number; found: number; patches: number; dealt: number; chests: number; cleared: number; seconds: number };
}

export class Player {
  model!: GameModel;
  private t = 0;
  private way: [number, number] = [0, 0];
  private seen = new Set<number>(); // patches walked into, this life
  private found = new Set<unknown>(); // villages, crypts, caves and camps come near, this life
  private stats = { quests: 0, falls: 0 };
  private before = { xp: 0, quests: 0, falls: 0, found: 0, patches: 0 };
  private order: { served: boolean } | null = null; // an ale on its way to the hero's stool
  private paid = 0; // paid (or paying) this decision, besides what settle() works out
  private tally = { taken: 0, dealt: 0, chests: 0, cleared: 0, coin: 0 }; // this life's, for the report (and coin's cap)
  private quests = { taken: new Set<string>(), steps: new Map<string, number>(), back: new Set<string>() }; // each quest's steps paid, this life
  private foeHp = new Map<unknown, number>(); // the foes fighting them, as they last stood
  private hp = 0; // the hero's health, as it last stood
  private from = { x: 0, z: 0 }; // where they were as the decision was made

  // A new life: a new hero in one of the worlds (from `seed`), or (`keep`: the watch page) the same game, the hero
  // started over in it.
  reset(seed: number, keep = false): number[] {
    const worldSeed = WORLD_SEEDS[seed % WORLD_SEEDS.length];
    if (!worlds.has(worldSeed)) worlds.set(worldSeed, generateWorld(worldSeed, SIZE));
    Math.random = mulberry32(seed ^ 0x5eed);
    if (!keep || !this.model) {
      this.model = new GameModel(worldSeed, SIZE, worlds.get(worldSeed));
      const fall = this.model.fall;
      this.model.fall = () => ((this.stats.falls++, fall())); // (falls as in the game: woken at an inn, poorer; counted)
    }
    [this.t, this.way, this.order] = [0, [0, 0], null];
    [this.seen, this.found, this.stats] = [new Set(), new Set(), { quests: 0, falls: 0 }];
    this.before = { xp: 0, quests: 0, falls: 0, found: 0, patches: 0 };
    [this.paid, this.tally, this.foeHp, this.hp] = [0, { taken: 0, dealt: 0, chests: 0, cleared: 0, coin: 0 }, new Map(), this.model.hero.hp];
    this.quests = { taken: new Set(), steps: new Map(), back: new Set() };
    this.model.takeEvents(); // (the last life's, let go)
    this.walked();
    return this.observe();
  }

  // One decision: a way (0 still, 1..8), and a key (0 none, 1 a blow, 2 a roll, 3 the guard, 4 E, 5 eat, 6 gear on).
  step(move: number, key: number): PlayStep {
    this.decide(move, key);
    for (let f = 0; f < FRAMES_PER_DECISION; f++) this.advance(FRAME);
    return this.settle();
  }

  decide(move: number, key: number): void {
    const { model } = this;
    const { hero } = model;
    this.way = WAYS[move] ?? [0, 0];
    this.from = { x: hero.x, z: hero.z };
    model.raiseGuard(key === 3);
    if (key === 1) model.startAttack();
    else if (key === 2) {
      if (!model.foes.some((e) => e.state !== 'dead' && Math.hypot(e.x - hero.x, e.z - hero.z) < 6)) this.paid += PAY.wasted; // (no foe near: breath for nothing)
      model.roll(...this.way);
    } else if (key === 4) {
      if (this.prompt() === 'none') this.paid += PAY.wasted;
      this.pressE();
    }
    else if (key === 5) this.eat();
    else if (key === 6) this.putOn();
  }

  advance(dt: number): void {
    this.model.update(this.way[0], this.way[1], dt);
    this.t += dt;
    if (this.order?.served) {
      serveOrder(this.model, 'ale');
      this.order = null;
    }
  }

  settle(): PlayStep {
    const { model } = this;
    const { hero } = model;
    // (points spent at once, a stat at a time round: no window to spend them in)
    for (let i = 0; hero.statPoints > 0; i++, hero.statPoints--) hero.trained[STATS[(hero.level + i) % STATS.length]]++;
    this.walked();
    const xp = totalXp(hero.level, hero.xp);
    const now = { xp, quests: this.stats.quests, falls: this.stats.falls, found: this.found.size, patches: this.seen.size };
    const fell = now.falls - this.before.falls;
    let reward = this.paid + ((now.xp - this.before.xp) / xpToNext(hero.level)) * PAY.level + (now.quests - this.before.quests) * PAY.questDone + fell * PAY.fall + (now.found - this.before.found) * PAY.place + (now.patches - this.before.patches) * PAY.patch;
    // Hurt (not falling: that's paid for itself; the health back after, not counted either).
    if (!fell) reward += (Math.max(0, this.hp - hero.hp) / maxHpOf(hero)) * PAY.hurt;
    this.hp = hero.hp;
    // A step into a wall: going some way, and not moving (not sat, not mid-roll or blow).
    if ((this.way[0] || this.way[1]) && !model.seated && model.moves.rollProgress === null && model.attackProgress === null && Math.hypot(hero.x - this.from.x, hero.z - this.from.z) < 0.01) reward += PAY.wasted;
    reward += this.questSteps() + this.blows() + this.happenings();
    [this.before, this.paid] = [now, 0];
    const truncated = this.t >= EPISODE;
    const { taken, dealt, chests, cleared } = this.tally;
    return { observation: this.observe(), reward, done: false, truncated, info: { level: hero.level, xp, quests: now.quests, taken, falls: now.falls, found: now.found, patches: now.patches, dealt: Math.round(dealt * 10) / 10, chests, cleared, seconds: this.t } };
  }

  // Each quest's steps, paid once a life each: taken, every foe slain or thing gathered toward it, back at its board.
  private questSteps(): number {
    const { model, quests } = this;
    const { hero } = model;
    let pay = 0;
    for (const t of model.quests.taken) {
      const { key } = t.quest;
      if (!quests.taken.has(key)) {
        quests.taken.add(key);
        this.tally.taken++;
        pay += PAY.questTaken;
      }
      const progress = model.quests.progress(t);
      const best = quests.steps.get(key) ?? 0;
      if (progress > best) {
        quests.steps.set(key, progress);
        pay += (progress - best) * PAY.questStep;
      }
      if (!model.inside && model.quests.done(t) && !quests.back.has(key)) {
        const board = boardSpot(model, t.quest.board);
        if (board && Math.hypot(board.x - hero.x, board.z - hero.z) < 3) {
          quests.back.add(key);
          pay += PAY.questBack;
        }
      }
    }
    return pay;
  }

  // Blows landed on foes fighting them (chasing them, or a dungeon's): each one's health lost, in shares of its whole.
  private blows(): number {
    let pay = 0;
    const { model } = this;
    for (const e of model.foes) {
      if (e.state !== 'chase' && !model.dungeon) {
        this.foeHp.delete(e);
        continue;
      }
      const was = this.foeHp.get(e);
      const now = e.state === 'dead' ? 0 : Math.max(0, e.hp);
      if (was !== undefined && now < was) {
        pay += ((was - now) / e.maxHp) * PAY.dealt;
        this.tally.dealt += was - now;
      }
      if (e.state === 'dead') this.foeHp.delete(e);
      else this.foeHp.set(e, now);
    }
    return pay;
  }

  // What the game told of this decision: a camp cleared, a dungeon's boss slain; coin picked up (up to its cap).
  private happenings(): number {
    let pay = 0;
    for (const event of this.model.takeEvents()) {
      if (event.kind === 'cleared') [pay, this.tally.cleared] = [pay + PAY.cleared, this.tally.cleared + 1];
      else if (event.kind === 'coins') {
        const coin = Math.min(event.amount * PAY.coin, COIN_MOST - this.tally.coin);
        if (coin > 0) [pay, this.tally.coin] = [pay + coin, this.tally.coin + coin];
      }
    }
    return pay;
  }

  // Where they've been (outdoors), and what they've come near.
  private walked(): void {
    const { model } = this;
    if (model.inside) return;
    const { hero } = model;
    this.seen.add(Math.floor(hero.x / CELL) * 4096 + Math.floor(hero.z / CELL));
    const near = (p: { x: number; z: number }) => Math.abs(p.x - hero.x) < 10 && Math.abs(p.z - hero.z) < 10;
    for (const list of [model.villages, model.camps, model.crypts.map((c) => c.entrance), model.caves.map((c) => c.entrance)]) for (const p of list) if (near(p)) this.found.add(p);
  }

  // E, as the game has it (GameController): loot picked up, a chest opened, up from a seat, sat down, a word with the
  // barmaid from a stool (an ale ordered), a board read (what's done there handed in, else the next quest taken), a
  // coin in a well, a door upstairs, the stairs, a door.
  private pressE(): void {
    const { model } = this;
    if (model.pickUp()) return;
    const chest = chestInReach(model);
    if (chest) {
      chest.open();
      if (chest.what !== 'locked' && !chestInReach(model)) [this.paid, this.tally.chests] = [this.paid + PAY.chest, this.tally.chests + 1]; // (opened: no longer one to open)
      return;
    }
    if (this.prompt() === 'bar') return this.orderAle();
    if (model.sitOrStand()) return;
    const board = model.boardInReach;
    if (board !== null) return this.readBoard(board);
    if (model.wellInReach !== null) return void model.tossCoin();
    if (!useHallDoor(model) && !takeStairs(model)) model.useDoor();
  }

  private orderAle(): void {
    const { model } = this;
    const stool = model.inside?.seated?.seat.piece;
    const barmaid = barmaidHere(model);
    if (!stool || !barmaid || this.order || !callFor(model, 'ale').coming) return;
    const order = { served: false };
    this.order = order;
    placeOrder(model.inside!.entrance, { stool, by: null, drink: 'ale', served: () => void (order.served = true) });
    callBarkeep(barmaid);
  }

  private readBoard(board: number): void {
    const { quests } = this.model;
    const done = quests.taken.find((t) => t.quest.board === board && quests.done(t));
    if (done) {
      if (quests.handIn(done.quest.key)) this.stats.quests++;
      return;
    }
    const next = quests.offersAt(board).find((q) => !quests.isCompleted(q.key) && !quests.takenOf(q.key));
    if (next) quests.accept(next);
  }

  private eat(): void {
    const { hero } = this.model;
    const food = Object.keys(hero.bag).find((id) => isProvision(id) && !PROVISIONS[id].drink);
    const hurt = hero.hp < maxHpOf(hero) * 0.6;
    if (food && this.model.consume(food as never) && hurt) this.paid += PAY.meal; // (a meal when hurt: health on the way back)
  }

  // The newest piece of gear in the bag (as picked up last), put on, if they're of its level.
  private putOn(): void {
    const { hero } = this.model;
    const piece = [...hero.bagOrder].reverse().find((id) => !!id && isGear(id) && canWear(id, hero.level));
    if (!piece || !isGear(piece)) return;
    const worn = hero.equipment[slotOfGear(piece)];
    const gain = power(piece) - (worn ? power(worn) : 0);
    if (this.model.equipFromBag(piece) && gain > 0) this.paid += gain * PAY.gear; // (a better one: by how much; a worse one, nothing)
  }

  // What E would do now (the prompt on screen).
  private prompt(): (typeof PROMPTS)[number] {
    const { model } = this;
    const { hero, inside } = model;
    if (model.lootInReach) return 'loot';
    if (chestInReach(model)) return 'chest';
    if (model.seated) return model.seated.seat.piece.kind === 'barStool' && talkingTo(model.folk, inside, hero)?.role === 'barkeep' ? 'bar' : 'stand';
    if (model.seatInReach) return 'sit';
    if (talkingTo(model.folk, inside, hero)) return 'talk';
    if (!inside && travellerInReach(model.travellers.list, hero)) return 'traveller';
    if (model.boardInReach !== null) return 'board';
    if (model.wellInReach !== null) return 'well';
    if (inside && (stairsInReach(inside, hero) || (inside.below && doorAt(inside, hero)))) return 'stairs';
    return model.doorInReach ? 'door' : 'none';
  }

  observe(): number[] {
    const { model } = this;
    const { hero, inside, moves } = model;
    const out: number[] = [];
    // The ground round them, tile by tile (indoors: the room's floor).
    const foes = model.foes.filter((e) => e.state !== 'dead' && !e.buried && Math.abs(e.x - hero.x) <= VIEW + 1 && Math.abs(e.z - hero.z) <= VIEW + 1);
    const folk = model.folk.filter((n) => n.where === (inside?.entrance ?? null));
    const loot = [...model.groundHere.loot, ...model.groundHere.coins];
    const doors = inside ? [] : model.entrances.filter((e) => Math.abs(e.x - hero.x) <= VIEW + 1 && Math.abs(e.z - hero.z) <= VIEW + 1);
    const [cx, cz] = [Math.round(hero.x), Math.round(hero.z)];
    const at = (list: ReadonlyArray<{ x: number; z: number }>, x: number, z: number) => list.some((p) => Math.round(p.x) === x && Math.round(p.z) === z);
    for (let dx = -VIEW; dx <= VIEW; dx++) {
      for (let dz = -VIEW; dz <= VIEW; dz++) {
        const [x, z] = [cx + dx, cz + dz];
        const r = HERO_RADIUS * (inside ? INDOOR_SCALE : 1);
        const blocked = inside ? x < 0 || z < 0 || x >= inside.room.width || z >= inside.room.depth || bumpsFurniture(inside.furniture, x, z, r) || !!inside.walls?.(x, z, r) : model.isBlocked(x, z, HERO_RADIUS);
        const foe = foes.find((e) => Math.round(e.x) === x && Math.round(e.z) === z);
        out.push(
          blocked ? 1 : 0,
          !inside && model.tiles.lake(x, z) ? 1 : 0,
          !inside && onPaving(model.tiles, x, z) ? 1 : 0,
          inside ? (x === inside.room.door && z === inside.room.depth - 1 ? 1 : 0) : at(doors, x, z) ? 1 : 0,
          foe ? Math.max(0.2, Math.min(1, 0.5 + (foe.level - hero.level) / 6)) : 0,
          at(folk, x, z) ? 1 : 0,
          at(loot, x, z) ? 1 : 0,
          foe ? foe.hp / foe.maxHp : 0,
          !inside && this.seen.has(Math.floor(x / CELL) * 4096 + Math.floor(z / CELL)) ? 1 : 0,
        );
      }
    }
    // How they stand.
    const minutes = model.minutes % (24 * 60);
    out.push(hero.hp / maxHpOf(hero), hero.energy / maxEnergyOf(hero), moves.breath / moves.most, moves.guard === null ? 0 : 1, moves.rollProgress ?? 0, hero.level / 20, hero.xp / xpToNext(hero.level), Math.log1p(hero.money) / 10, inside ? 1 : 0, Math.sin((minutes / 1440) * Math.PI * 2), Math.cos((minutes / 1440) * Math.PI * 2));
    const prompt = this.prompt();
    for (const p of PROMPTS) out.push(p === prompt ? 1 : 0);
    // The quests taken, as the tracker shows them: how far along, done, and which way to go (the nearest marked foe,
    // or where they gather; done: the board), how far.
    for (let i = 0; i < TRACKED; i++) {
      const t = model.quests.taken[i];
      if (!t) {
        out.push(0, 0, 0, 0, 0);
        continue;
      }
      const done = model.quests.done(t);
      const goal = inside ? null : done ? (boardSpot(model, t.quest.board) ?? t.quest) : (model.enemies.find((e) => e.quest === t.quest.key && e.state !== 'dead') ?? t.quest);
      const [gx, gz] = goal ? [goal.x - hero.x, goal.z - hero.z] : [0, 0];
      const d = Math.hypot(gx, gz) || 1;
      out.push(model.quests.progress(t) / t.quest.count, done ? 1 : 0, gx / d, gz / d, Math.min(d, 200) / 200);
    }
    return out;
  }
}

// What a piece of gear's worth, to weigh one against another: its armour and stats together.
function power(key: GearKey): number {
  const { armor, stats } = gearSpecs(key);
  return armor + Object.values(stats).reduce((a, b) => a + b, 0);
}

// Experience earned in all, from level 1: each level's to the next, and what's toward the next.
function totalXp(level: number, xp: number): number {
  let total = xp;
  for (let l = 1; l < level; l++) total += xpToNext(l);
  return total;
}


// The player's feet and hands (player/player.ts decides; this does): the game played by its keys and windows only (no
// cheats), a step at a time: what's done at once whatever's going on (chores: points spent, better gear worn, food
// when hurt; a foe at their heels fought off), and the steps of every goal (stepsFor: to the bar for an ale, to a bed,
// a quest, a board, the shops, a bench, a well, the inn's upper floor; crypts and caves, bandit camps, pedlars and
// travellers, herbalists, a shift: ventures.ts); and it says whenever the game doesn't do what it should (checks.ts,
// and what it sees itself: a foe that won't die, a barmaid who never serves, a quest that can't be done…).
import type { GameModel } from '../../src/model/GameModel';
import { bagRoom, fitBag } from '../../src/model/hero/bagSlots';
import { isBagItem, roomOf } from '../../src/model/loot/bags';
import type { Entrance } from '../../src/model/interiors/interiors';
import type { Enemy } from '../../src/model/types';
import { ATTACK_REACH, ENEMY_STATS } from '../../src/model/constants';
import { maxEnergyOf, maxHpOf } from '../../src/model/hero/attributes';
import { spendPoints } from '../../src/model/hero/training';
import { STATS } from '../../src/model/hero/statKinds';
import { isProvision, PROVISIONS } from '../../src/model/loot/provisions';
import { isPotion } from '../../src/model/loot/potions';
import { setAction, useAction } from '../../src/model/hero/actionBar';
import { dungeonAt } from '../../src/model/dungeons/dungeons';
import { campLevel } from '../../src/model/camps/camps';
import { callBarkeep, placeOrder } from '../../src/model/inn/barOrders';
import { boardSpot } from '../../src/model/quests/noticeBoards';
import { squareBenches } from '../../src/model/worldgen/benches';
import { doorAt, stairsInReach, stairsOf, takeStairs, useHallDoor } from '../../src/model/interiors/upstairs';
import { barmaidHere, callFor, serveOrder, type BarMenuItem } from '../../src/controller/trade/barOrder';
import { PICKUP_RANGE } from '../../src/model/loot/loot';
import { boardFor, heroState, nearestDoor, openNear } from './nav';
import { Errands, better, isGear, type Status } from './errands';
import { type Report, type Step } from './botSteps';
import { BotVentures } from './ventures';

export type { BotStats } from './botSteps';

const HEAL_WALK = 250; // tiles, at most, it goes for an ale when hurt

// How things stand as a plan's made (context()).
export interface PlanContext {
  hurt: boolean;
  tired: boolean;
  done?: string; // a quest done, to hand in (its key)
  going?: string; // one under way
  loot?: { x: number; z: number }; // near, to pick up
  foe: Enemy | null; // one to fight
}

export abstract class Bot extends BotVentures {
  private steps: Step[] = [];
  private defense: Step | null = null; // fighting off a foe that's set on the hero, whatever else was going on
  private readonly dry = new Map<Entrance, number>(); // inns with none of what it wanted: till when (game seconds) it doesn't go back
  private plans: Array<{ at: number; x: number; z: number }> = []; // when (game seconds) and where it last planned, to catch it going round in circles
  protected readonly errands: Errands;

  constructor(
    model: GameModel,
    report: Report,
    rng: () => number,
    protected readonly log: (what: string) => void = () => {}, // what it's up to, as it goes (the playthrough's own telling)
  ) {
    super(model, report, rng);
    this.errands = new Errands(model, report, this.stats, rng, this.balance);
  }

  // One frame: on with what it's doing (or something new), the keys pressed as it says.
  tick(dt: number): void {
    const { hero } = this.model;
    this.chores();
    if (this.steps.length === 0 || this.urgent()) this.plan();
    this.defend();
    this.move = [0, 0];
    const status = this.steps[0]?.(dt) ?? 'ok';
    if (status === 'ok') this.steps.shift();
    else if (status === 'fail') this.steps = [];
    const before = { level: hero.level, xp: hero.xp, money: hero.money, hp: hero.hp, x: hero.x, z: hero.z };
    const working = !!this.model.work.shift; // (its pay comes as it ends, in the update: told apart from coins found)
    // (the foes about, should it fall this frame: only worth a look once it's hurt)
    const about = hero.hp < maxHpOf(hero) * 0.5 ? this.model.foes.filter((e) => e.state !== 'dead' && Math.abs(e.x - hero.x) < 6 && Math.abs(e.z - hero.z) < 6).map((e) => `${e.kind} ${e.level}`) : []; // (foes: underground, a dungeon's own; the surface's list said 'no one near' of every fall below)
    this.model.update(this.move[0], this.move[1], dt);
    this.afterFrame(); // (a roll under way: watched)
    this.balance.xp('kills', before); // (all a frame brings: blows land in it)
    // Fallen (health gone, in this frame): woken at an inn, healed, some coin gone; whatever it was doing, over.
    const fell = hero.hp > before.hp && hero.hp >= maxHpOf(hero) && hero.level === before.level && (this.model.inside !== null || Math.hypot(hero.x - before.x, hero.z - before.z) > 3) && !hero.drinking; // (a level up heals them whole too: not a fall)
    if (hero.money !== before.money) this.balance.coin(fell ? 'lost on falling' : working && !this.model.work.shift ? 'shifts' : 'coins found', hero.money - before.money);
    if (fell) {
      this.balance.fell(about);
      this.fresh('fell');
    }
    for (const e of this.model.takeEvents()) if (e.kind === 'hit' && e.on !== 'hero' && !(e.amount > 0)) this.report('blow for nothing', `${e.on}: ${e.amount}`);
  }

  // A foe at the hero's heels (chasing, close), or one of a herd it's hemmed in by: fought off first, to the end.
  private defend(): void {
    if ((this.model.inside && !this.model.dungeon) || (this.defense && this.steps[0] === this.defense)) return; // (underground too: its foes)
    const { hero } = this.model;
    const near = (e: Enemy) => Math.hypot(e.x - hero.x, e.z - hero.z);
    const foe =
      this.model.foes.find((e) => e.state === 'chase' && near(e) < 1.8 && (!this.shunned.has(e) || near(e) < 1)) ?? // (one let be, but on the hero now: fought)
      (this.nav.stillFor > 2 ? this.model.foes.find((e) => e.state !== 'dead' && near(e) < ATTACK_REACH + ENEMY_STATS[e.kind].radius) : undefined); // (hemmed in by a herd: through them)
    if (foe) this.shunned.delete(foe);
    if (!foe) return;
    this.defense = this.fight(foe, true);
    this.steps.unshift(this.defense);
  }

  private fresh(why: string): void {
    if (why === 'fell') {
      this.stats.deaths++;
      this.log('fell, and woke at an inn');
    }
    this.steps = [];
    this.nav.reset();
  }

  // What's done at once, whatever else is going on: points spent, better gear worn, food eaten when hurt.
  private chores(): void {
    const { hero } = this.model;
    if (hero.statPoints > 0) {
      const plan = { [STATS[Math.floor(this.rng() * STATS.length)]]: 1 };
      if (!spendPoints(hero, plan)) this.report('points not spent', `${hero.statPoints} to spend: ${JSON.stringify(plan)}`);
      else this.stats.levels++;
    }
    for (const id of Object.keys(hero.bag)) {
      // A pack carried, a socket free: fitted, and the bag the roomier for it.
      if (isBagItem(id) && hero.bags.includes(null)) {
        const room = bagRoom(hero);
        if (!fitBag(hero, id)) this.report('pack not fitted', id);
        else if (bagRoom(hero) !== room + roomOf(id)) this.report('pack fitted, room wrong', `${id}: ${room} before, ${bagRoom(hero)} after, its ${roomOf(id)}`);
        else this.stats.packs++;
        continue;
      }
      if (!isGear(id) || !better(id, hero)) continue; // (gear of any level and rarity: bought, or dropped by foes; worn once they're of its level)
      if (!this.model.equipFromBag(id)) this.report('gear not worn', id);
    }
    if (hero.hp < maxHpOf(hero) * 0.5 && !hero.drinking) {
      const food = (Object.keys(hero.bag) as string[]).find((id) => isProvision(id) && !PROVISIONS[id].drink);
      if (food && this.rng() < 0.5) this.fromBar(0, food, true); // (half the time off the action bar, as a player might)
      else if (food && this.model.consume(food as never)) this.stats.meals++;
    }
    const potion = hero.hp < maxHpOf(hero) * 0.35 ? (Object.keys(hero.bag) as string[]).find(isPotion) : undefined;
    if (potion) this.fromBar(1, potion, false); // (a potion, badly hurt: its wait may not be over)
  }

  // `item` put in action bar slot `i` and used: one of it had from the bag (`surely`: nothing should stop it).
  private fromBar(i: number, item: string, surely: boolean): void {
    const { hero } = this.model;
    const had = hero.bag[item as keyof typeof hero.bag] ?? 0;
    if (!setAction(hero, i, item)) return this.report('action bar would not take it', item);
    if (!useAction(hero, i)) {
      if (surely && !hero.eating) this.report('action bar did nothing', `${item}: ${had} carried`);
      return;
    }
    if ((hero.bag[item as keyof typeof hero.bag] ?? 0) !== had - 1) this.report('action bar took none from the bag', `${item}: ${had} before, ${hero.bag[item as keyof typeof hero.bag] ?? 0} after`);
    this.stats.actions++;
    if (isProvision(item)) this.stats.meals++;
  }

  // Whether three or more foes are close by (a pack, a camp's crew): more than it should pick a fight with.
  protected outnumbered(): boolean {
    const { hero } = this.model;
    return this.model.foes.filter((e) => e.state !== 'dead' && Math.hypot(e.x - hero.x, e.z - hero.z) < 6).length >= 3;
  }

  // Whether what's going on should give way (badly hurt, away from a bar, one with ale in reach).
  protected urgent(): boolean {
    const { hero } = this.model;
    return !this.model.work.shift && hero.hp < maxHpOf(hero) * 0.3 && this.goal !== 'heal' && this.goal !== 'sleep' && !hero.drinking && this.alehouse() !== null; // (at work: on with it, the inn's door shut till it's over)
  }

  // The nearest inn with ale to be had (as far as it knows), a walk away at most: none, and it makes do (no trek
  // across the map to one, hurt as it is: there's no health back but by drink and food).
  protected alehouse(): Entrance | null {
    if (this.model.inside?.entrance.type === 'inn' && !this.isDry(this.model.inside.entrance)) return this.model.inside.entrance;
    return nearestDoor(this.model, 'inn', (e) => this.isDry(e), HEAL_WALK);
  }

  private isDry(e: Entrance): boolean {
    return (this.dry.get(e) ?? -1) > this.model.minutes; // (no ale to be had there, a while)
  }

  // How things stand, for what to do next: hurt, tired, a quest done or under way, loot near, a foe to fight.
  protected context(): PlanContext {
    const { hero, quests } = this.model;
    const done = quests.taken.find((t) => quests.done(t));
    const going = quests.taken.find((t) => !quests.done(t));
    return {
      hurt: hero.hp < maxHpOf(hero) * 0.4,
      tired: hero.energy < maxEnergyOf(hero) * 0.3,
      done: done?.quest.key,
      going: going?.quest.key,
      loot: this.model.loot.find((l) => !this.skipped.has(l) && Math.hypot(l.x - hero.x, l.z - hero.z) < 8),
      foe: this.outnumbered() ? null : this.nearestFoe(12), // (a pack about: no fight picked with it, only those that come at them)
    };
  }

  // Planning afresh over and over (nothing it picks gets going): said so, once a while.
  protected circling(): void {
    const { x, z } = this.model.hero;
    this.plans = [...this.plans.filter((p) => this.model.minutes - p.at < 5), { at: this.model.minutes, x, z }];
    const stayed = this.plans.every((p) => Math.hypot(p.x - x, p.z - z) < 1.5); // (getting nowhere, not just quick errands)
    if (this.plans.length > 50 && stayed) this.plans = (this.report('bot going round in circles', `${this.plans.length} plans in 5 s, last ${this.goal}${heroState(this.model)}`), []);
  }

  // What to do next: the player's own (player/player.ts).
  protected abstract plan(): void;

  // What's to be done, set (a player's own activity: player/player.ts).
  protected set todo(steps: Step[]) {
    this.steps = steps;
  }

  // The steps of a goal (`foe`, `loot`, `done`, `going`: what it's about, as context() found them).
  protected stepsFor(goal: string, { foe, loot, done, going }: Pick<PlanContext, 'foe' | 'loot' | 'done' | 'going'>): Step[] {
    const { hero, quests } = this.model;
    const dry = (e: Entrance) => this.isDry(e);
    const inn = () => (goal === 'heal' ? this.alehouse() : nearestDoor(this.model, 'inn'));
    switch (goal) {
      case 'leave':
        return this.leave();
      case 'heal': {
        const here = this.model.inside;
        const atInn = here?.entrance.type === 'inn' && !dry(here.entrance);
        const getThere = atInn ? (here.below ? this.leave().slice(0, 1) : []) : [...this.leave(), ...this.enter(inn())]; // (upstairs: down first)
        return [...getThere, ...this.atTheBar('ale'), ...this.leave()];
      }
      case 'pie':
        return [...this.enter(inn()), ...this.atTheBar('pie'), ...this.leave()];
      case 'nap':
      case 'sleep':
        return [...this.enter(nearestDoor(this.model, 'house')), this.sitOn((k) => k === 'bed' || k === 'doubleBed'), this.until(() => hero.energy >= maxEnergyOf(hero) * 0.95 && hero.hp >= maxHpOf(hero) * 0.95, 120, 'slept in bed, not rested and mended'), () => ((this.stats.sleeps++, this.model.sitOrStand()), 'ok'), ...this.leave()];
      case 'loot':
      {
        const go = this.walk(() => loot!, PICKUP_RANGE * 0.8);
        return [(dt) => (go(dt) === 'run' ? 'run' : this.pickUp(loot!))];
      }
      case 'fight':
        return foe ? [this.fight(foe)] : [];
      case 'hunt': {
        const prey = this.outnumbered() ? null : this.nearestFoe(60);
        return prey ? [this.walk(() => prey, 8), this.fight(prey)] : [];
      }
      case 'quest': {
        const taken = quests.takenOf(going!)!;
        const at = { x: taken.quest.x, z: taken.quest.z };
        const go = this.walk(() => at, 3);
        const there: Step = (dt) => {
          const status = go(dt);
          if (status === 'fail' && this.nav.unreachable) {
            this.report('quest spot out of reach', `${going}: ${taken.quest.kind} ${taken.quest.foe} at ${at.x},${at.z}, from ${hero.x.toFixed(0)},${hero.z.toFixed(0)}`);
            quests.abandon(going!);
            this.balance.questEnded(going!, 'out of reach');
          }
          return status;
        };
        return [there, this.questFight(going!, at)];
      }
      case 'board':
      case 'hand in': {
        const board = done ? quests.takenOf(done)!.quest.board : boardFor(this.model);
        const spot = boardSpot(this.model, board);
        if (!spot) return []; // (a streamed world's, its village not made just now: another time)
        const front = { x: spot.x + spot.front.dx * 0.6, z: spot.z + spot.front.dz * 0.6 };
        return [this.walk(() => front, 0.15), () => (done ? this.errands.handIn(done) : this.errands.takeQuests(board))];
      }
      case 'barmaid':
        return [...this.enter(inn()), this.talkTo('barkeep'), () => (this.errands.tradeAtInn(), 'ok'), ...this.leave()];
      case 'smith':
        return [...this.enter(nearestDoor(this.model, 'smithy')), this.talkTo('smith'), () => (this.errands.tradeAtSmith(), 'ok'), ...this.leave()];
      case 'bench': {
        const seat = squareBenches(this.model).flatMap((b) => b.seats).sort((a, b) => Math.hypot(a.x - hero.x, a.z - hero.z) - Math.hypot(b.x - hero.x, b.z - hero.z))[0];
        const sit = (): Status => {
          if (this.model.sitOrStand()) return (this.stats.benches++, 'ok');
          if (!this.model.npcs.some((n) => n.seat?.piece === seat.piece)) this.report('bench seat out of reach beside it', `seat at ${seat.x.toFixed(2)},${seat.z.toFixed(2)}, hero at ${hero.x.toFixed(2)},${hero.z.toFixed(2)}`);
          return 'fail';
        };
        return seat ? [this.walk(() => seat, 0.6), sit, this.wait(4), () => (this.model.sitOrStand(), 'ok')] : [];
      }
      case 'well': {
        const v = [...this.model.villages].sort((a, b) => Math.hypot(a.x - hero.x, a.z - hero.z) - Math.hypot(b.x - hero.x, b.z - hero.z))[0];
        const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => this.model.isOpenTile(v.x + dx, v.z + dz));
        return side ? [this.walk(() => ({ x: v.x + side[0] * 0.7, z: v.z + side[1] * 0.7 }), 0.2), () => this.errands.wish()] : [];
      }
      case 'upstairs':
        return [...this.enter(inn()), ...this.upstairs(), ...this.leave()];
      case 'dungeon': {
        // The nearest way down not far beyond them (a crypt's, a cave's), a day's walk at most.
        const door = this.nearest(this.model.entrances.filter((e) => (e.type === 'crypt' || e.type === 'cave') && (dungeonAt(e)?.level ?? Infinity) <= hero.level), 250); // (none above them: its boss is more)
        return door ? this.dungeonTrip(door) : [];
      }
      case 'camp': {
        const camp = this.nearest(this.model.camps.filter((c) => campLevel(c, this.model.size) < hero.level && !this.model.campLife.status(c.way)?.chestOpened), 250); // (a level under them: a camp's several at once, and its chief)
        return camp && hero.hp > maxHpOf(hero) * 0.7 ? this.campRaid(camp) : [];
      }
      case 'pedlar':
      case 'traveller': {
        const t = this.nearest(this.model.travellers.list.filter((t) => (t.role === 'pedlar') === (goal === 'pedlar')), 60);
        return t ? this.meet(t) : [];
      }
      case 'work': {
        const shift = this.model.work.shift;
        if (shift) return this.workShift(shift.inn, true, shift.job);
        const inn = nearestDoor(this.model, 'inn', undefined, 250);
        return inn ? [...this.workShift(inn, false, this.rng() < 0.5 ? 'innBarkeep' : 'innServer'), ...this.leave()] : []; // (either job, as it falls)
      }
      case 'herbalist': {
        const herbalist = this.nearest(this.model.npcs.filter((n) => n.role === 'herbalist' && n.where === n.home), 250, (n) => n.home); // (at home: by their door)
        return herbalist ? this.herbalistVisit(herbalist) : [];
      }
      case 'respec':
        return [() => this.errands.respec()];
      case 'give up':
        return [() => this.errands.giveUp()];
      default: {
        // Explore: somewhere open a way off (a village now and then).
        const within = this.model.villages.filter((v) => Math.hypot(v.x - hero.x, v.z - hero.z) < 250 && this.model.isMade(v.x, v.z)); // (a day's walk, not across the whole map; on ground made just now)
        const far = this.rng() < 0.3 ? (within[Math.floor(this.rng() * within.length)] ?? null) : null;
        const to = far ?? openNear(this.model, this.rng, hero.x + (this.rng() - 0.5) * 60, hero.z + (this.rng() - 0.5) * 60);
        return to ? [this.walk(() => to, 1.5)] : [];
      }
    }
  }

  // The nearest of `places` to the hero, within `within` tiles and on ground made just now (each where `at` says: its
  // own place, else its door's).
  private nearest<T>(places: readonly T[], within: number, at: (p: T) => { x: number; z: number } = (p) => p as { x: number; z: number }): T | null {
    const { hero } = this.model;
    const far = (p: T) => Math.hypot(at(p).x - hero.x, at(p).z - hero.z);
    return places.filter((p) => far(p) < within && this.model.isMade(at(p).x, at(p).z)).sort((a, b) => far(a) - far(b))[0] ?? null;
  }

  // Steps.

  // Sits on a seat of a kind `wanted` says (a bed, a bar stool), walking to the nearest free one.
  private sitOn(wanted: (kind: string) => boolean): Step {
    return (dt) => {
      const { inside, hero } = this.model;
      if (!inside) return 'fail';
      const sat = this.model.seated?.seat.piece.kind;
      if (sat && wanted(sat)) return 'ok'; // (sat on one already)
      if (sat) this.model.sitOrStand(); // (up off another, first)
      const reach = this.model.seatInReach;
      if (reach && wanted(reach.piece.kind)) return this.model.sitOrStand() ? 'ok' : 'fail';
      const taken = (p: unknown) => this.model.npcs.some((n) => n.seat?.piece === p);
      const seat = inside.furniture
        .filter((f) => wanted(f.kind) && !taken(f))
        .sort((a, b) => Math.hypot(a.x - hero.x, a.z - hero.z) - Math.hypot(b.x - hero.x, b.z - hero.z))[0];
      if (!seat) return 'fail';
      return this.walk(() => ({ x: seat.x + (seat.w - 1) / 2, z: seat.z + (seat.d - 1) / 2 }), 0.3)(dt) === 'fail' ? 'fail' : 'run';
    };
  }

  // At the inn's bar: a stool, the order called and queued, the barmaid bringing it, had there.
  private atTheBar(what: BarMenuItem): Step[] {
    let served = false;
    let waited = 0;
    const stool = this.sitOn((k) => k === 'barStool');
    const elsewhere = (why: string): Status => {
      this.log(why);
      this.dry.set(this.model.inside!.entrance, this.model.minutes + 180); // (another inn, a while)
      return 'fail';
    };
    return [
      (dt) => {
        const sat = stool(dt);
        return sat === 'fail' && this.model.inside ? elsewhere('no stool to be had at the bar') : sat;
      },
      () => {
        const barmaid = barmaidHere(this.model);
        const stool = this.model.inside?.seated?.seat.piece;
        if (!barmaid || !stool) return 'fail';
        const call = callFor(this.model, what);
        if (!call.coming) return elsewhere(`at the bar, for ${what}: "${call.said}"`); // (sold out, or too poor)
        placeOrder(this.model.inside!.entrance, { stool, by: null, drink: what, served: () => (served = true) });
        callBarkeep(barmaid);
        return 'ok';
      },
      (dt) => {
        if (served) return 'ok';
        if ((waited += dt) < 90) return 'run';
        this.report('barmaid never served', `${what}, waited ${waited.toFixed(0)} s`);
        return 'fail';
      },
      () => {
        const money = this.model.hero.money;
        const { drank, said } = serveOrder(this.model, what);
        this.balance.coin(what === 'ale' ? 'ales' : 'pies', this.model.hero.money - money);
        if (!drank) return 'fail';
        if (!said) this.report('barmaid silent', what);
        what === 'ale' ? this.stats.ales++ : this.stats.pies++;
        return 'ok';
      },
      this.until(() => !this.model.hero.drinking, 30, `${what} never finished`),
      () => (this.model.sitOrStand(), 'ok'),
    ];
  }

  // Up the inn's stairs, a room's door opened, a lie on its bed, and down again.
  private upstairs(): Step[] {
    return [
      (dt) => {
        const { inside, hero } = this.model;
        if (!inside) return 'fail';
        if (inside.below) return 'ok';
        const stairs = stairsOf(inside);
        if (!stairs) return 'fail';
        if (stairsInReach(inside, hero)) {
          if (!takeStairs(this.model)) return 'fail';
          this.stats.upstairs++;
          return 'ok';
        }
        return this.walk(() => ({ x: stairs.x + stairs.w / 2 - 0.5, z: stairs.z + stairs.d }), 0.4)(dt) === 'fail' ? 'fail' : 'run';
      },
      (dt) => {
        const { inside, hero } = this.model;
        if (!inside?.below) return 'fail';
        const door = inside.furniture.find((f) => f.kind === 'hallDoor' && !f.open);
        if (!door) return 'ok';
        if (doorAt(inside, hero) === door) return useHallDoor(this.model) ? 'ok' : 'fail';
        // (its middle, in its wall: as near as can be got, from the hall)
        const middle = door.wall === 'left' ? { x: door.x - 0.4, z: door.z - 0.5 + door.d / 2 } : { x: door.x - 0.5 + door.w / 2, z: door.z - 0.4 };
        const step = this.walk(() => middle, 0.5)(dt);
        if (step === 'fail') this.report('hall door out of reach', `${door.wall} door at ${door.x},${door.z}, hero at ${hero.x.toFixed(2)},${hero.z.toFixed(2)}`);
        return step === 'fail' ? 'ok' : 'run';
      },
      this.sitOn((k) => k === 'roomBed' || k === 'doubleBed'),
      this.wait(3),
      () => (this.model.sitOrStand(), 'ok'),
    ];
  }

}

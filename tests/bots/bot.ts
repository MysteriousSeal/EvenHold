// A bot playing the game as a player would, by its keys and windows only
// (no cheats): it picks what to do from how it is (hurt: to the bar for an
// ale, or eats; tired: to a bed; points to spend, gear to wear) and what's
// about (foes, loot, quests on the boards, shops, benches, wells, an inn's
// upper floor), does it one step at a time, and says whenever the game
// doesn't do what it should (checks.ts, and what it sees itself: a foe
// that won't die, a barmaid who never serves, a quest that can't be done…).
import type { GameModel } from '../../src/model/GameModel';
import { ENTER_RANGE, type Entrance } from '../../src/model/interiors/interiors';
import type { Enemy } from '../../src/model/types';
import { ATTACK_REACH, ENEMY_STATS } from '../../src/model/constants';
import { maxEnergyOf, maxHpOf } from '../../src/model/hero/attributes';
import { spendPoints } from '../../src/model/hero/training';
import { STATS } from '../../src/model/hero/statKinds';
import { ITEMS, type ItemId } from '../../src/model/human/equipment';
import { isProvision, PROVISIONS } from '../../src/model/loot/provisions';
import { callBarkeep, placeOrder } from '../../src/model/inn/barOrders';
import { talkingTo } from '../../src/model/npcs/talk';
import { noticeBoards } from '../../src/model/quests/noticeBoards';
import { squareBenches } from '../../src/model/worldgen/benches';
import { doorAt, stairsInReach, stairsOf, takeStairs, useHallDoor } from '../../src/model/interiors/upstairs';
import { barmaidHere, callFor, serveOrder, type BarMenuItem } from '../../src/controller/trade/barOrder';
import { PICKUP_RANGE } from '../../src/model/loot/loot';
import { heroState, nearestBoard, nearestDoor, openNear } from './nav';
import { Errands, power, type Status } from './errands';
import { BotSteps, type Report, type Step } from './botSteps';

export type { BotStats } from './botSteps';

export class Bot extends BotSteps {
  private steps: Step[] = [];
  private rng: () => number;
  private defense: Step | null = null; // fighting off a foe that's set on the hero, whatever else was going on
  private readonly dry = new Map<Entrance, number>(); // inns with none of what it wanted: till when (game seconds) it doesn't go back
  private plans: Array<{ at: number; x: number; z: number }> = []; // when (game seconds) and where it last planned, to catch it going round in circles
  private readonly errands: Errands;

  constructor(
    model: GameModel,
    report: Report,
    rng: () => number,
    private readonly log: (what: string) => void = () => {}, // what it's up to, as it goes (npm run bots:verbose)
  ) {
    super(model, report);
    this.errands = new Errands(model, report, this.stats, rng, this.balance);
    this.rng = rng;
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
    const about = this.model.enemies.filter((e) => e.state !== 'dead' && Math.hypot(e.x - hero.x, e.z - hero.z) < 6).map((e) => `${e.kind} ${e.level}`);
    this.model.update(this.move[0], this.move[1], dt);
    this.balance.xp('kills', before); // (all a frame brings: blows land in it)
    // Fallen (health gone, in this frame): woken at an inn, healed, some coin gone; whatever it was doing, over.
    const fell = hero.hp > before.hp && hero.hp >= maxHpOf(hero) && (this.model.inside !== null || Math.hypot(hero.x - before.x, hero.z - before.z) > 3) && !hero.drinking;
    if (hero.money !== before.money) this.balance.coin(fell ? 'lost on falling' : 'coins found', hero.money - before.money);
    if (fell) {
      this.balance.fell(about);
      this.fresh('fell');
    }
    for (const e of this.model.takeEvents()) if (e.kind === 'hit' && e.on !== 'hero' && !(e.amount > 0)) this.report('blow for nothing', `${e.on}: ${e.amount}`);
  }

  // A foe at the hero's heels (chasing, close), or one of a herd it's hemmed in by: fought off first, to the end.
  private defend(): void {
    if (this.model.inside || (this.defense && this.steps[0] === this.defense)) return;
    const { hero } = this.model;
    const near = (e: Enemy) => Math.hypot(e.x - hero.x, e.z - hero.z);
    const foe =
      this.model.enemies.find((e) => e.state === 'chase' && near(e) < 1.8 && (!this.shunned.has(e) || near(e) < 1)) ?? // (one let be, but on the hero now: fought)
      (this.nav.stillFor > 2 ? this.model.enemies.find((e) => e.state !== 'dead' && near(e) < ATTACK_REACH + ENEMY_STATS[e.kind].radius) : undefined); // (hemmed in by a herd: through them)
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
    for (const id of Object.keys(hero.bag) as ItemId[]) {
      if (!(id in ITEMS)) continue;
      const worn = hero.equipment[ITEMS[id].slot];
      if ((!worn || power(id) > power(worn)) && !this.model.equipFromBag(id)) this.report('gear not worn', id);
    }
    if (hero.hp < maxHpOf(hero) * 0.5 && !hero.drinking) {
      const food = (Object.keys(hero.bag) as string[]).find((id) => isProvision(id) && !PROVISIONS[id].drink);
      if (food && this.model.consume(food as never)) this.stats.meals++;
    }
  }

  // Whether what's going on should give way (badly hurt, away from a bar).
  private urgent(): boolean {
    const { hero } = this.model;
    return hero.hp < maxHpOf(hero) * 0.3 && this.goal !== 'heal' && this.goal !== 'sleep' && !hero.drinking;
  }

  // What to do next.
  private plan(): void {
    const { hero, quests } = this.model;
    this.nav.reset();
    // Planning afresh over and over (nothing it picks gets going): say so, once a while.
    const { x, z } = hero;
    this.plans = [...this.plans.filter((p) => this.model.minutes - p.at < 5), { at: this.model.minutes, x, z }];
    const stayed = this.plans.every((p) => Math.hypot(p.x - x, p.z - z) < 1.5); // (getting nowhere, not just quick errands)
    if (this.plans.length > 50 && stayed) this.plans = (this.report('bot going round in circles', `${this.plans.length} plans in 5 s, last ${this.goal}${heroState(this.model)}`), []);
    const hurt = hero.hp < maxHpOf(hero) * 0.4;
    const tired = hero.energy < maxEnergyOf(hero) * 0.3;
    const done = quests.taken.find((t) => quests.done(t));
    const going = quests.taken.find((t) => !quests.done(t));
    const loot = this.model.loot.find((l) => !this.skipped.has(l) && Math.hypot(l.x - hero.x, l.z - hero.z) < 8);
    const foe = this.nearestFoe(12);
    const pick = (): string => {
      if (hurt) return 'heal'; // (in an inn already: at its bar)
      if (this.model.inside) return 'leave';
      if (tired) return 'sleep';
      if (done) return 'hand in';
      if (loot) return 'loot';
      if (foe && hero.hp > maxHpOf(hero) * 0.6) return 'fight';
      if (going && this.rng() < 0.6) return 'quest';
      const choices = ['board', 'board', 'explore', 'explore', 'explore', 'barmaid', 'smith', 'bench', 'well', 'upstairs', 'pie', 'hunt', 'nap', 'respec', 'give up'];
      return choices[Math.floor(this.rng() * choices.length)];
    };
    this.goal = pick();
    this.log(`off to ${this.goal}`);
    this.stats.goals[this.goal] = (this.stats.goals[this.goal] ?? 0) + 1;
    this.steps = this.stepsFor(this.goal, { foe, loot, done: done?.quest.key, going: going?.quest.key });
  }

  private stepsFor(goal: string, { foe, loot, done, going }: { foe: Enemy | null; loot?: { x: number; z: number }; done?: string; going?: string }): Step[] {
    const { hero, quests } = this.model;
    const dry = (e: Entrance) => (this.dry.get(e) ?? -1) > this.model.minutes; // (no ale to be had there, a while)
    const inn = () => nearestDoor(this.model, 'inn', goal === 'heal' ? dry : undefined);
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
        return [...this.enter(nearestDoor(this.model, 'house')), this.sitOn((k) => k === 'bed' || k === 'doubleBed'), this.until(() => hero.energy >= maxEnergyOf(hero) * 0.95, 120, 'slept in bed, energy not back'), () => ((this.stats.sleeps++, this.model.sitOrStand()), 'ok'), ...this.leave()];
      case 'loot':
      {
        const go = this.walk(() => loot!, PICKUP_RANGE * 0.8);
        return [(dt) => (go(dt) === 'run' ? 'run' : this.pickUp(loot!))];
      }
      case 'fight':
        return foe ? [this.fight(foe)] : [];
      case 'hunt': {
        const prey = this.nearestFoe(60);
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
        const board = done ? quests.takenOf(done)!.quest.board : nearestBoard(this.model);
        const spot = noticeBoards(this.model)[board];
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
      case 'respec':
        return [() => this.errands.respec()];
      case 'give up':
        return [() => this.errands.giveUp()];
      default: {
        // Explore: somewhere open a way off (a village now and then).
        const within = this.model.villages.filter((v) => Math.hypot(v.x - hero.x, v.z - hero.z) < 250); // (a day's walk, not across the whole map)
        const far = this.rng() < 0.3 ? (within[Math.floor(this.rng() * within.length)] ?? null) : null;
        const to = far ?? openNear(this.model, this.rng, hero.x + (this.rng() - 0.5) * 60, hero.z + (this.rng() - 0.5) * 60);
        return to ? [this.walk(() => to, 1.5)] : [];
      }
    }
  }

  // Steps.

  private enter(door: Entrance | null): Step[] {
    if (!door) return [() => 'fail'];
    return [
      this.walk(() => door, ENTER_RANGE * 0.9),
      () => {
        if (!this.model.useDoor()) {
          this.report('door not used', `at the ${door.type}'s door, ${this.model.hero.x.toFixed(2)},${this.model.hero.z.toFixed(2)}`);
          return 'fail';
        }
        this.stats.buildings++;
        return 'ok';
      },
    ];
  }

  // Out of the building (down the stairs first, if up them).
  private leave(): Step[] {
    return [
      (dt) => {
        const { inside, hero } = this.model;
        if (!inside?.below) return 'ok';
        const stairs = stairsOf(inside)!;
        if (stairsInReach(inside, hero)) return takeStairs(this.model) ? 'run' : 'fail';
        return this.walk(() => ({ x: stairs.x + stairs.w / 2 - 0.5, z: stairs.z + stairs.d }), 0.5)(dt) === 'fail' ? 'fail' : 'run';
      },
      (dt) => {
        const { inside } = this.model;
        if (!inside) return 'ok';
        if (this.model.seated) this.model.sitOrStand();
        if (this.model.doorInReach) return this.model.useDoor() ? 'ok' : 'fail';
        return this.walk(() => ({ x: inside.room.door, z: inside.room.depth - 1 }), 0.25)(dt) === 'fail' ? 'fail' : 'run';
      },
    ];
  }

  // Sits on a seat of a kind `wanted` says (a bed, a bar stool), walking to the nearest free one.
  private sitOn(wanted: (kind: string) => boolean): Step {
    return (dt) => {
      const { inside, hero } = this.model;
      if (!inside) return 'fail';
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

  private talkTo(role: 'barkeep' | 'smith'): Step {
    return (dt) => {
      const { inside, hero, npcs } = this.model;
      if (talkingTo(npcs, inside, hero)?.role === role) return 'ok';
      const keeper = npcs.find((n) => n.role === role && n.where === inside?.entrance);
      if (!keeper) return 'fail';
      return this.walk(() => keeper, 1.2)(dt) === 'run' ? 'run' : talkingTo(npcs, inside, hero)?.role === role ? 'ok' : 'fail';
    };
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

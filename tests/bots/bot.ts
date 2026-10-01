// A bot playing the game as a player would, by its keys and windows only
// (no cheats): it picks what to do from how it is (hurt: to the bar for an
// ale, or eats; tired: to a bed; points to spend, gear to wear) and what's
// about (foes, loot, quests on the boards, shops, benches, wells, an inn's
// upper floor), does it one step at a time, and says whenever the game
// doesn't do what it should (checks.ts, and what it sees itself: a foe
// that won't die, a barmaid who never serves, a quest that can't be done…).
import type { GameModel } from '../../src/model/GameModel';
import type { Entrance } from '../../src/model/interiors/interiors';
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
import { Nav, nearestBoard, nearestDoor, openNear } from './nav';
import { Errands, power, type Status } from './errands';

type Step = (dt: number) => Status;
type Report = (kind: string, detail: string) => void;

export interface BotStats {
  kills: number;
  deaths: number;
  levels: number;
  questsTaken: number;
  questsDone: number;
  ales: number;
  pies: number;
  meals: number;
  sleeps: number;
  trades: number;
  buildings: number;
  upstairs: number;
  benches: number;
  wishes: number;
  goals: Record<string, number>;
}


export class Bot {
  readonly stats: BotStats = { kills: 0, deaths: 0, levels: 0, questsTaken: 0, questsDone: 0, ales: 0, pies: 0, meals: 0, sleeps: 0, trades: 0, buildings: 0, upstairs: 0, benches: 0, wishes: 0, goals: {} };
  private readonly nav: Nav;
  private steps: Step[] = [];
  private goal = 'none';
  private move: [number, number] = [0, 0];
  private rng: () => number;
  private lastHp: number;
  private readonly shunned = new Set<Enemy>(); // foes found out of reach (across water, say): let be
  private defense: Step | null = null;
  private readonly errands: Errands; // fighting off a foe that's set on the hero, whatever else was going on

  constructor(
    private readonly model: GameModel,
    private readonly report: Report,
    rng: () => number,
    private readonly log: (what: string) => void = () => {}, // what it's up to, as it goes (npm run bots:verbose)
  ) {
    this.nav = new Nav(model);
    this.errands = new Errands(model, report, this.stats, rng);
    this.rng = rng;
    this.lastHp = model.hero.hp;
  }

  // One frame: on with what it's doing (or something new), the keys pressed as it says.
  tick(dt: number): void {
    const { hero } = this.model;
    // Fallen (health gone): woken elsewhere, healed; whatever it was doing, over.
    if (hero.hp > this.lastHp + maxHpOf(hero) * 0.5 && this.lastHp < maxHpOf(hero) * 0.3 && !hero.drinking) this.fresh('fell');
    this.lastHp = hero.hp;
    this.chores();
    if (this.steps.length === 0 || this.urgent()) this.plan();
    this.defend();
    this.move = [0, 0];
    const status = this.steps[0]?.(dt) ?? 'ok';
    if (status === 'ok') this.steps.shift();
    else if (status === 'fail') this.steps = [];
    this.model.update(this.move[0], this.move[1], dt);
    for (const e of this.model.takeEvents()) if (e.kind === 'hit' && e.on !== 'hero' && !(e.amount > 0)) this.report('blow for nothing', `${e.on}: ${e.amount}`);
  }

  // A foe at the hero's heels (chasing, close): fought off first, to the end.
  private defend(): void {
    if (this.model.inside || (this.defense && this.steps[0] === this.defense)) return;
    const { hero } = this.model;
    const foe = this.model.enemies.find((e) => e.state === 'chase' && !this.shunned.has(e) && Math.hypot(e.x - hero.x, e.z - hero.z) < 1.8);
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
    const hurt = hero.hp < maxHpOf(hero) * 0.4;
    const tired = hero.energy < maxEnergyOf(hero) * 0.3;
    const done = quests.taken.find((t) => quests.done(t));
    const going = quests.taken.find((t) => !quests.done(t));
    const loot = this.model.loot.find((l) => Math.hypot(l.x - hero.x, l.z - hero.z) < 8);
    const foe = this.nearestFoe(12);
    const pick = (): string => {
      if (this.model.inside) return 'leave';
      if (hurt) return 'heal';
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
    const inn = () => nearestDoor(this.model, 'inn');
    switch (goal) {
      case 'leave':
        return this.leave();
      case 'heal':
        return [...this.enter(inn()), ...this.atTheBar('ale'), ...this.leave()];
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
        const far = this.rng() < 0.3 ? this.model.villages[Math.floor(this.rng() * this.model.villages.length)] : null;
        const to = far ?? openNear(this.model, this.rng, hero.x + (this.rng() - 0.5) * 60, hero.z + (this.rng() - 0.5) * 60);
        return to ? [this.walk(() => to, 1.5)] : [];
      }
    }
  }

  // Steps.

  private walk(to: () => { x: number; z: number }, near: number): Step {
    return (dt) => {
      const target = to();
      const { dx, dz, state } = this.nav.toward(target, near, dt);
      this.move = [dx, dz];
      if (state === 'there') return 'ok';
      if (state === 'stuck') {
        const { hero, inside } = this.model;
        if (Math.hypot(target.x - hero.x, target.z - hero.z) < 1.5) return 'fail'; // (the last bit: up to what asked for it)
        const hemmed = this.heroState().includes('against');
        this.report(hemmed ? 'hero hemmed in by villagers' : 'hero stuck', `${this.goal}: at ${hero.x.toFixed(2)},${hero.z.toFixed(2)} ${inside ? `in the ${inside.entrance.type}${inside.below ? ' upstairs' : ''}` : 'outdoors'}, going to ${target.x.toFixed(2)},${target.z.toFixed(2)}${this.heroState()}`);
        return 'fail';
      }
      return state === 'no way' ? 'fail' : 'run';
    };
  }

  private wait(seconds: number): Step {
    let t = 0;
    return (dt) => ((t += dt) >= seconds ? 'ok' : 'run');
  }

  // Waits for `done`, at most `seconds`; past it, `problem` (a report) if given.
  private until(done: () => boolean, seconds: number, problem?: string): Step {
    let t = 0;
    return (dt) => {
      if (done()) return 'ok';
      if ((t += dt) < seconds) return 'run';
      if (problem) this.report(problem, `${this.goal} after ${seconds} s`);
      return 'fail';
    };
  }

  private enter(door: Entrance | null): Step[] {
    if (!door) return [() => 'fail'];
    return [
      this.walk(() => door, 0.3),
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
    return [
      this.sitOn((k) => k === 'barStool'),
      () => {
        const barmaid = barmaidHere(this.model);
        const stool = this.model.inside?.seated?.seat.piece;
        if (!barmaid || !stool) return 'fail';
        const call = callFor(this.model, what);
        if (!call.coming) return 'fail'; // (sold out, or too poor: she says so)
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
        const { drank, said } = serveOrder(this.model, what);
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

  private fight(foe: Enemy, toTheEnd = false): Step {
    let inReach = 0;
    let away = 0; // seconds after it, out of reach, since last landing a blow
    let hpThen = foe.hp;
    return (dt) => {
      const { hero } = this.model;
      if (foe.state === 'dead' || !this.model.enemies.includes(foe)) {
        if (foe.state === 'dead') this.stats.kills++;
        return 'ok';
      }
      if (!toTheEnd && hero.hp < maxHpOf(hero) * 0.3) return 'fail'; // off to heal
      const d = Math.hypot(foe.x - hero.x, foe.z - hero.z);
      if (d > ATTACK_REACH + ENEMY_STATS[foe.kind].radius - 0.15) {
        if ((away += dt) > 30) return (this.shunned.add(foe), 'fail'); // (out of reach: across water, say; let be)
        const step = this.walk(() => foe, ATTACK_REACH * 0.7)(dt);
        if (step === 'fail') this.shunned.add(foe); // (no way there)
        return step === 'fail' ? 'fail' : 'run';
      }
      this.model.focus(foe.id);
      this.model.startAttack();
      if (foe.hp < hpThen) [hpThen, inReach, away] = [foe.hp, 0, 0];
      else if ((inReach += dt) > 20) {
        this.report('foe takes no damage', `${foe.kind} #${foe.id} (level ${foe.level}), ${foe.hp}/${foe.maxHp} after ${inReach.toFixed(0)} s in reach`);
        return 'fail';
      }
      return 'run';
    };
  }

  // At a quest's place: its marked foes fought as they come, for a while.
  private questFight(key: string, at: { x: number; z: number }): Step {
    let t = 0;
    let seen = false;
    let current: { of: unknown; step: Step } | null = null;
    const skipped = new Set<unknown>(); // loot or foes that couldn't be got at
    return (dt) => {
      const { quests } = this.model;
      const taken = quests.takenOf(key);
      if (!taken || quests.done(taken)) return 'ok';
      if ((t += dt) > 240) {
        if (!seen) this.report('quest foes never came', `${key}: ${taken.quest.kind} ${taken.quest.count} ${taken.quest.foe}, at ${at.x},${at.z}`);
        return 'fail';
      }
      if (this.model.hero.hp < maxHpOf(this.model.hero) * 0.3) return 'fail';
      const loot = this.model.lootInReach;
      if (loot) this.model.pickUp();
      if (current) {
        const status = current.step(dt);
        if (status === 'run') return 'run';
        if (status === 'fail') skipped.add(current.of);
        this.nav.reset();
      }
      const marked = this.model.enemies.filter((e) => e.state !== 'dead' && !skipped.has(e) && (e.quest === key || e.kind === taken.quest.foe) && Math.hypot(e.x - at.x, e.z - at.z) < 25);
      const near = this.model.loot.find((l) => !skipped.has(l) && Math.hypot(l.x - this.model.hero.x, l.z - this.model.hero.z) < 6);
      if (near) current = { of: near, step: this.walk(() => near, PICKUP_RANGE * 0.8) };
      else if (marked.length > 0) {
        seen = true;
        current = { of: marked[0], step: this.fight(marked[0]) };
      } else current = null;
      return 'run';
    };
  }

  // Picks up what's by the hero; if they couldn't get near enough, says so (dropped somewhere out of reach).
  private pickUp(loot: { x: number; z: number }): Status {
    if (this.model.pickUp()) return 'ok';
    const { hero } = this.model;
    const d = Math.hypot(loot.x - hero.x, loot.z - hero.z);
    if (this.model.loot.includes(loot as never) && d > PICKUP_RANGE) this.report('loot out of reach', `at ${loot.x.toFixed(2)},${loot.z.toFixed(2)}, hero as near as ${d.toFixed(2)}${this.heroState()}`);
    return 'fail';
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

  // Helpers.

  // What the hero's doing, for a report (only what's out of the ordinary).
  private heroState(): string {
    const { hero } = this.model;
    const odd = [this.model.yard && 'in a yard', this.model.seated && 'seated', hero.drinking && 'drinking', hero.energy < 1 && `energy ${hero.energy.toFixed(1)}`, hero.hp < 1 && `health ${hero.hp.toFixed(1)}`];
    const npcs = this.model.npcs.filter((n) => n.where === (this.model.inside?.entrance ?? null) && Math.hypot(n.x - hero.x, n.z - hero.z) < 0.9).map((n) => `${n.name} the ${n.role}`);
    const foes = this.model.enemies.filter((e) => e.state !== 'dead' && Math.hypot(e.x - hero.x, e.z - hero.z) < 1.5).map((e) => `a ${e.kind} (${e.state})`);
    odd.push(...npcs.map((n) => `against ${n}`), ...foes.map((f) => `by ${f}`));
    return odd.filter(Boolean).length ? ` (${odd.filter(Boolean).join(', ')})` : '';
  }

  private nearestFoe(within: number): Enemy | null {
    const { hero } = this.model;
    let best: Enemy | null = null;
    let d = within;
    for (const e of this.model.enemies) {
      const de = Math.hypot(e.x - hero.x, e.z - hero.z);
      if (e.state !== 'dead' && de < d && !this.shunned.has(e)) [best, d] = [e, de];
    }
    return best;
  }
}

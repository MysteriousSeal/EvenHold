// A bot's steps (bot.ts decides which, and when): walking somewhere (nav.ts),
// waiting a while or for something, fighting a foe (and its fellows at a
// quest's spot), picking up what's dropped; each says how it's going, and
// reports what the game got wrong on the way.
import type { GameModel } from '../../src/model/GameModel';
import type { Enemy } from '../../src/model/types';
import { ATTACK_REACH, ENEMY_STATS } from '../../src/model/constants';
import { maxHpOf } from '../../src/model/hero/attributes';
import { PICKUP_RANGE } from '../../src/model/loot/loot';
import { Nav, heroState, standableNear } from './nav';
import type { Status } from './errands';
import { Balance } from './balance';

export type Step = (dt: number) => Status;
export type Report = (kind: string, detail: string) => void;

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


export class BotSteps {
  readonly stats: BotStats = { kills: 0, deaths: 0, levels: 0, questsTaken: 0, questsDone: 0, ales: 0, pies: 0, meals: 0, sleeps: 0, trades: 0, buildings: 0, upstairs: 0, benches: 0, wishes: 0, goals: {} };
  protected readonly nav: Nav;
  protected goal = 'none';
  protected move: [number, number] = [0, 0]; // the keys pressed this frame
  protected readonly shunned = new Set<Enemy>(); // foes found out of reach (across water, say): let be
  protected readonly skipped = new Set<unknown>(); // loot it couldn't get at: let be
  readonly balance: Balance; // what its game says about the balance

  constructor(
    protected readonly model: GameModel,
    protected readonly report: Report,
  ) {
    this.nav = new Nav(model);
    this.balance = new Balance(model);
  }

  protected walk(to: () => { x: number; z: number }, near: number): Step {
    return (dt) => {
      const target = to();
      const { dx, dz, state } = this.nav.toward(target, near, dt);
      this.move = [dx, dz];
      if (state === 'there') return 'ok';
      if (state === 'stuck') {
        const { hero, inside } = this.model;
        if (Math.hypot(target.x - hero.x, target.z - hero.z) < 1.5) return 'fail'; // (the last bit: up to what asked for it)
        const hemmed = heroState(this.model).includes('against');
        this.report(hemmed ? 'hero hemmed in by villagers' : 'hero stuck', `${this.goal}: at ${hero.x.toFixed(2)},${hero.z.toFixed(2)} ${inside ? `in the ${inside.entrance.type}${inside.below ? ' upstairs' : ''}` : 'outdoors'}, going to ${target.x.toFixed(2)},${target.z.toFixed(2)}${heroState(this.model)}`);
        return 'fail';
      }
      return state === 'no way' ? 'fail' : 'run';
    };
  }

  protected wait(seconds: number): Step {
    let t = 0;
    return (dt) => ((t += dt) >= seconds ? 'ok' : 'run');
  }

  // Waits for `done`, at most `seconds`; past it, `problem` (a report) if given.
  protected until(done: () => boolean, seconds: number, problem?: string): Step {
    let t = 0;
    return (dt) => {
      if (done()) return 'ok';
      if ((t += dt) < seconds) return 'run';
      if (problem) this.report(problem, `${this.goal} after ${seconds} s`);
      return 'fail';
    };
  }

  protected fight(foe: Enemy, toTheEnd = false): Step {
    let inReach = 0;
    let away = 0; // seconds after it, out of reach, since last landing a blow
    let hpThen = foe.hp;
    let since: { at: number; health: number; lowest: number } | null = null; // since it first came in reach (for the balance)
    const ended = (won: boolean) => since && this.balance.fight({ kind: foe.kind, foeLevel: foe.level, seconds: this.model.minutes - since.at, hurt: Math.max(0, since.health - since.lowest), won });
    return (dt) => {
      const { hero } = this.model;
      if (since) since.lowest = Math.min(since.lowest, this.balance.health());
      if (foe.state === 'dead' || !this.model.enemies.includes(foe)) {
        if (foe.state === 'dead') this.stats.kills++;
        ended(foe.state === 'dead');
        return 'ok';
      }
      if (!toTheEnd && hero.hp < maxHpOf(hero) * 0.3) return (ended(false), 'fail'); // off to heal
      const d = Math.hypot(foe.x - hero.x, foe.z - hero.z);
      if (d > ATTACK_REACH + ENEMY_STATS[foe.kind].radius - 0.15) {
        if ((away += dt) > 30) return (this.shunned.add(foe), 'fail'); // (out of reach: across water, say; let be)
        const step = this.walk(() => foe, ATTACK_REACH * 0.7)(dt);
        if (step === 'fail') this.shunned.add(foe); // (no way there)
        return step === 'fail' ? 'fail' : 'run';
      }
      since ??= { at: this.model.minutes, health: this.balance.health(), lowest: this.balance.health() };
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
  protected questFight(key: string, at: { x: number; z: number }): Step {
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
  protected pickUp(loot: { x: number; z: number }): Status {
    if (this.model.pickUp()) return 'ok';
    const { hero } = this.model;
    const d = Math.hypot(loot.x - hero.x, loot.z - hero.z);
    // (Somewhere in reach of it the hero could stand: the bot's way there's the trouble, not the game's.)
    if (this.model.loot.includes(loot as never) && d > PICKUP_RANGE && !standableNear(this.model, loot, PICKUP_RANGE)) this.report('loot out of reach', `at ${loot.x.toFixed(2)},${loot.z.toFixed(2)}, hero as near as ${d.toFixed(2)}${heroState(this.model)}`);
    this.skipped.add(loot);
    return 'fail';
  }

  protected nearestFoe(within: number): Enemy | null {
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

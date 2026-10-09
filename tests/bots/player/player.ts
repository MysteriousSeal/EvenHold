// A player of their own mind (npm run bots:play: playthrough.ts), on the bots' feet (bot.ts: the keys, the windows,
// how each thing's done) but choosing for themself: who they are (persona.ts), what they want just now, what they've
// seen of the world (a village, a crypt, a camp come across: only those count, as for anyone new to it), what they
// did lately, and what each thing brought them before. Every choice written in their diary with its why; every
// activity's outcome kept (what it paid in experience and coin, what it cost in health and time) for the report
// (report.ts) and for what they learn from it. The activities: activities.ts.

import type { GameModel } from '../../../src/model/GameModel';
import type { Entrance } from '../../../src/model/interiors/interiors';
import type { Camp } from '../../../src/model/camps/camps';
import type { Enemy } from '../../../src/model/types';
import type { Npc } from '../../../src/model/npcs/npcs';
import type { Traveller } from '../../../src/model/travellers/travellers';
import { maxEnergyOf, maxHpOf } from '../../../src/model/hero/attributes';
import { dungeonAt } from '../../../src/model/dungeons/dungeons';
import { campName } from '../../../src/model/camps/campNames';
import { villageName } from '../../../src/model/villages/villageNames';
import { SKILL_IDS, skillOf } from '../../../src/model/skills/skills';
import { Bot, type PlanContext } from '../bot';
import type { BotStats, Report, Step } from '../botSteps';
import type { Status } from '../errands';
import { ACTIVITIES, type Activity, type Target } from './activities';
import { Memory, describe, draw, drawPersona, score, type Drive, type Persona } from './persona';

const SEEN = 45; // tiles: how far off a place is noticed (about what's on screen, and a little beyond)
const UNEXPLORED_WINDOW = 15; // minutes: with nothing new seen in so long, they've explored the country round
const BUDGET = 8 * 60; // game seconds an activity may take, at most (a shift, a dungeon: their own): past it, given up, said so

// What's been done, start to finish: for the diary and the report.
export interface Done {
  id: string;
  label: string;
  why: string;
  at: number; // game seconds begun
  seconds: number;
  outcome: 'ok' | 'fail' | 'fell' | 'cut short';
  xp: number;
  coin: number;
  hurt: number; // health lost, as a share of their most
  level: number; // at the start
}

export interface Found {
  at: number;
  what: string;
}

// What the activities may use of the player (activities.ts): the bots' own ways of doing things, lent out.
export interface Toolkit {
  readonly model: GameModel;
  readonly persona: Persona;
  readonly rng: () => number;
  readonly known: { villages: Set<number>; doors: Set<Entrance>; camps: Set<Camp> };
  readonly stats: BotStats;
  readonly skipped: Set<unknown>;
  context(): PlanContext;
  alehouse(): Entrance | null;
  unexplored(): boolean;
  nearestFoe(within: number): Enemy | null;
  enter(door: Entrance | null): Step[]; // (into a building by its door)
  leave(): Step[]; // (and out of it, down the stairs first if up them)
  go(goal: string, ctx?: Partial<PlanContext>): Step[]; // (a goal the bots know: its steps)
  walk(to: () => { x: number; z: number }, near: number): Step;
  until(done: () => boolean, seconds: number, problem?: string): Step;
  pickUp(loot: { x: number; z: number }): Status;
  dungeonTrip(door: Entrance): Step[];
  campRaid(camp: Camp): Step[];
  workShift(inn: Entrance, resume: boolean, job: 'innServer' | 'innBarkeep'): Step[];
  meet(traveller: Traveller): Step[];
  herbalistVisit(herbalist: Npc): Step[];
  report: Report;
  log(what: string): void;
}

export class Player extends Bot {
  readonly persona: Persona;
  readonly memory = new Memory();
  readonly known = { villages: new Set<number>(), doors: new Set<Entrance>(), camps: new Set<Camp>() };
  readonly diary: Done[] = [];
  readonly found: Found[] = [];
  readonly kit: Toolkit;
  idle = 0; // game seconds with nothing to do at all
  lowHealth = 0; // game seconds under 40% health (no way to mend: a finding)
  private current: { activity: Activity; target: Target; why: string; at: number; before: { earned: number; level: number; money: number; hp: number; deaths: number } } | null = null;
  private failed = false;
  private lastFound = 0;
  private dwell = 0; // seconds to pause before the next choice (after one that came to nothing at once)
  private readonly cooled = new Map<string, number>(); // activities that came to nothing: not again till then (game seconds)
  private seconds = 0;
  private seenLevel = 1;
  private readonly seenSkills: Record<string, number> = {};

  constructor(model: GameModel, report: Report, rng: () => number, log: (what: string) => void) {
    super(model, report, rng, log);
    this.persona = drawPersona(rng);
    this.kit = {
      model,
      persona: this.persona,
      rng,
      known: this.known,
      stats: this.stats,
      skipped: this.skipped,
      context: () => this.context(),
      alehouse: () => this.alehouse(),
      unexplored: () => this.unexplored(),
      nearestFoe: (within) => this.nearestFoe(within),
      enter: (door) => this.enter(door),
      leave: () => this.leave(),
      go: (goal, ctx = {}) => this.stepsFor(goal, { foe: null, ...ctx }),
      walk: (to, near) => this.walk(to, near),
      until: (done, seconds, problem) => this.until(done, seconds, problem),
      pickUp: (loot) => this.pickUp(loot),
      dungeonTrip: (door) => this.dungeonTrip(door),
      campRaid: (camp) => this.campRaid(camp),
      workShift: (inn, resume, job) => this.workShift(inn, resume, job),
      meet: (t) => this.meet(t),
      herbalistVisit: (h) => this.herbalistVisit(h),
      report,
      log,
    };
    this.log(`a new player: ${describe(this.persona)}`);
  }

  // The game they're playing (the report's).
  get game(): GameModel {
    return this.model;
  }

  // Once a game second (the runner's): the clock, what's come into view, a level or a skill risen.
  observe(t: number): void {
    this.seconds = t;
    this.notice();
    const { hero } = this.model;
    while (this.seenLevel < hero.level) this.log(`level ${++this.seenLevel}!`);
    for (const id of SKILL_IDS) {
      const level = skillOf(hero, id).level;
      if ((this.seenSkills[id] ?? 1) !== level) this.log(`${id} ${level}`);
      this.seenSkills[id] = level;
    }
    if (this.current === null && this.model.inside === null) this.idle++;
    if (hero.hp < maxHpOf(hero) * 0.4) this.lowHealth++;
  }

  // What's near enough to be seen, now known (said the first time: a village by name, a crypt, a camp).
  private notice(): void {
    const { hero } = this.model;
    const close = (p: { x: number; z: number }) => Math.abs(p.x - hero.x) < SEEN && Math.abs(p.z - hero.z) < SEEN;
    const found = (what: string) => [this.found.push({ at: this.seconds, what }), this.log(`found ${what}`), (this.lastFound = this.seconds)];
    this.model.villages.forEach((v, i) => {
      if (!this.known.villages.has(i) && close(v)) [this.known.villages.add(i), found(`the village of ${villageName(v, this.model.seed)}`)];
    });
    for (const e of this.model.entrances) {
      if (this.known.doors.has(e) || !close(e)) continue;
      this.known.doors.add(e);
      const place = dungeonAt(e);
      if (place) found(`${place.name} (a ${place.kind}, level ${place.level})`);
      else if (e.type === 'inn' || e.type === 'smithy') found(`${e.type === 'inn' ? 'an inn' : 'a smithy'}`);
    }
    for (const c of this.model.camps) if (!this.known.camps.has(c) && close(c)) [this.known.camps.add(c), found(`${campName(c, this.model.seed)} (a bandit camp)`)];
  }

  // Nothing cuts in on the player's own judgement: being hurt is a drive (safety), weighed with the rest, not an
  // override (the bot's: replanned every frame till it healed, and went round in circles when it couldn't afford to).
  protected urgent(): boolean {
    return false;
  }

  unexplored(): boolean {
    return this.seconds - this.lastFound < UNEXPLORED_WINDOW * 60;
  }

  // What they want just now, each 0..1: to be safe (hurt), to rest (tired), coin (poor, the greedier), to grow
  // (always, the bolder), to see (the curious, while there's new to see), company, to make, glory.
  drives(): Record<Drive, number> {
    const { hero } = this.model;
    const t = this.persona.traits;
    const hp = hero.hp / maxHpOf(hero);
    const energy = hero.energy / maxEnergyOf(hero);
    const poor = 1 / (1 + hero.money / 300);
    return {
      safety: Math.max(0, 1 - hp * 1.3) * (0.7 + t.cautious * 0.6),
      rest: Math.max(0, 1 - energy * 1.2) * (0.7 + t.cautious * 0.4),
      coin: (0.25 + poor * 0.6) * (0.6 + t.greedy * 0.8),
      growth: 0.45 + t.bold * 0.35,
      curiosity: (this.unexplored() ? 0.8 : 0.35) * (0.5 + t.curious * 0.9),
      company: 0.3 * (0.4 + t.social * 1.2),
      craft: 0.35 * (0.4 + t.industrious * 1.2),
      glory: 0.4 * (0.4 + t.bold * 1.2),
    };
  }

  // What to do next: the last thing done written up, every activity possible scored, one drawn, said why.
  protected plan(): void {
    this.finish();
    this.nav.reset();
    this.circling();
    if (this.dwell > 0) return void [(this.todo = [this.wait(this.dwell)]), (this.dwell = 0)];
    if (this.model.seated) this.model.sitOrStand(); // (up, whatever they were sat on: afresh)
    const drives = this.drives();
    const from = this.model.inside?.entrance ?? this.model.hero; // (indoors: as far as its door is)
    const options = ACTIVITIES.filter((a) => (this.cooled.get(a.id) ?? 0) <= this.seconds).flatMap((activity) => activity.options(this.kit).map((target) => ({ id: activity.id, serves: activity.serves, traits: activity.traits, distance: target.at ? Math.hypot(target.at.x - from.x, target.at.z - from.z) : 0, activity, target })));
    if (options.length === 0) return void (this.todo = [this.wait(3)]);
    const scored = score(options, drives, this.persona, this.memory, this.seconds);
    const pick = draw(scored, this.persona.temperature, this.rng);
    const { activity, target } = pick.option;
    // Out of a building first (an activity of the outdoors, planned from inside, comes to nothing): its own steps
    // worked out once outside, and taken up then.
    const outdoors = !!this.model.inside && !activity.indoors;
    const steps = outdoors ? [...this.stepsFor('leave', { foe: null }), (): Status => {
      const own = activity.steps(this.kit, target);
      if (own.length === 0) return 'fail';
      this.todo = this.budgeted(activity, target, own);
      return 'ok';
    }] : activity.steps(this.kit, target);
    if (steps.length === 0) {
      // Nothing to be done about it after all (its steps found no way): let be a while, a moment's pause, then afresh.
      this.cooled.set(activity.id, this.seconds + 60);
      this.log(`thought of ${target.label}, but nothing came of it`);
      return void (this.todo = [this.wait(2)]);
    }
    const mood = (Object.entries(drives) as Array<[Drive, number]>).sort((a, b) => b[1] - a[1])[0][0];
    const why = pick.why || mood;
    const far = target.at ? ` (${Math.round(pick.option.distance)} tiles off)` : '';
    this.log(`→ ${target.label}${far}: ${why}${pick.score < Math.max(...scored.map((s) => s.score)) * 0.8 ? ' (a whim)' : ''}`);
    this.goal = activity.id;
    this.stats.goals[activity.id] = (this.stats.goals[activity.id] ?? 0) + 1;
    this.memory.began(activity.id, this.seconds);
    const { hero } = this.model;
    this.current = { activity, target, why, at: this.seconds, before: { earned: this.balance.earned, level: hero.level, money: hero.money, hp: hero.hp, deaths: this.stats.deaths } };
    this.failed = false;
    this.todo = this.budgeted(activity, target, steps);
  }

  // Steps watched: a failure noted (the outcome's), and the activity's time budget kept (past it, given up on, said:
  // stuck somewhere the steps don't see, a finding as much as a bug).
  private budgeted(activity: Activity, target: Target, steps: Step[]): Step[] {
    const budget = activity.budget ?? BUDGET;
    return steps.map((step) => (dt) => {
      if (this.seconds - this.current!.at > budget) {
        // Taking far too long (stuck somewhere the steps don't see): given up on, and said: a finding as much as a bug.
        this.report('player stuck in an activity', `${activity.id}: ${target.label}, ${Math.round(this.seconds - this.current!.at)} s${this.model.inside ? ` in the ${this.model.inside.entrance.type}` : ''}${this.model.seated ? ', seated' : ''}`);
        this.cooled.set(activity.id, this.seconds + 300);
        return 'fail';
      }
      const status = step(dt);
      if (status === 'fail') this.failed = true;
      return status;
    });
  }

  // The activity under way written up (the game over: the last thing done, too).
  close(): void {
    this.finish();
  }

  // The activity under way written up: what it brought and cost, how it ended; and learnt from.
  private finish(): void {
    const c = this.current;
    if (!c) return;
    this.current = null;
    const { hero } = this.model;
    const fell = this.stats.deaths > c.before.deaths;
    const seconds = this.seconds - c.at;
    const xp = this.balance.earned - c.before.earned;
    const coin = hero.money - c.before.money;
    const hurt = fell ? 1 : Math.max(0, c.before.hp - hero.hp) / maxHpOf(hero);
    const outcome: Done['outcome'] = fell ? 'fell' : this.failed ? 'fail' : seconds < 2 ? 'cut short' : 'ok';
    const done: Done = { id: c.activity.id, label: c.target.label, why: c.why, at: c.at, seconds, outcome, xp, coin, hurt, level: c.before.level };
    this.diary.push(done);
    if ((outcome === 'fail' || outcome === 'cut short') && seconds < 5) [this.cooled.set(c.activity.id, this.seconds + 30), (this.dwell = 4)]; // (came to nothing at once: not again just yet, and a moment's pause: no one decides twice a second)
    // Its reward: experience and coin for, health and time (and a fall) against, about ±1. A fall in its first
    // moments is the last thing's doing (the fight they came hurt from), not this one's.
    const soon = fell && seconds < 6 && this.diary.length >= 2;
    const reward = xp / 60 + coin / 40 - (soon ? 0 : hurt * 1.5 + (fell ? 3 : 0)) - seconds / 240 - (outcome === 'fail' ? 0.3 : 0);
    this.memory.reward(c.activity.id, Math.max(-3, Math.min(3, reward)));
    if (soon) this.memory.reward(this.diary[this.diary.length - 2].id, -3);
    const gains = [xp > 0 && `+${xp} xp`, coin !== 0 && `${coin > 0 ? '+' : ''}${coin} copper`, hurt > 0.05 && `−${Math.round(hurt * 100)}% health`].filter(Boolean).join(', ');
    this.log(`${outcome === 'ok' ? 'done' : outcome}: ${c.target.label} in ${Math.round(seconds)} s${gains ? ` (${gains})` : ''}`);
  }


}

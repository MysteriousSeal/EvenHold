// The lumberjack bots' playtest (npm run bots:lumber): LUMBER_BOTS bots (each its own fresh world, or LUMBER_SEEDS),
// each a woodcutter for LUMBER_MINUTES of game time (model/skills/lumber.ts): a hatchet in hand, to the nearest tree
// its skill will fell, chopping it down (on its own, a chop at a time), the logs picked up, on to the next; from
// birches up to pines and oaks as the skill rises. Checked as it goes, and said if not as it should be:
// - no axe in hand, E by a tree refused; E by one it can fell, chopping begun;
// - each chop on time, a log of the tree's kind on the ground beside it, some of the hero's own experience, the skill
//   up only as the tree's difficulty allows (never past the most there is), never a tree above the skill chopped;
// - felled at exactly its chops: chopping over, out of the way, not to be chopped again, told;
// - the logs into the bag when picked up; walking off stops a chop; a save and its reload keep what's cut;
// - a chop that never lands, a tree it can't get to.
// Then a report (tests/bots/reports/lumber-…md) of what went wrong (by kind, where, the seed to play again on) and
// what was done (trees by kind, chops, logs, the skill, time a tree); it fails if anything went wrong.

import { mkdirSync, writeFileSync } from 'node:fs';
import { GameModel } from '../../src/model/GameModel';
import { STREAMED_SIZE } from '../../src/model/worldgen/regions';
import { generateRandomSeed, mulberry32 } from '../../src/util/random';
import { REACH, WOOD, chopsIn, difficulty, treeKey } from '../../src/model/skills/lumber';
import { SKILL_MAX, skillOf } from '../../src/model/skills/skills';
import { PICKUP_RANGE } from '../../src/model/loot/loot';
import { parseSave, restore, snapshot } from '../../src/model/save';
import type { Tree, TreeKind } from '../../src/model/types';
import { BotSteps, type Step } from './botSteps';

const FRAME = 1 / 30;
const given = process.env.LUMBER_SEEDS?.split(',').map(Number);
const BOTS = given?.length ?? Number(process.env.LUMBER_BOTS ?? 6);
const MINUTES = Number(process.env.LUMBER_MINUTES ?? 15);
const SEEDS = given ?? Array.from({ length: BOTS }, () => generateRandomSeed());
const LOOK = 45; // tiles round the hero a tree's looked for in
const LOG_LOOK = 6; // and logs to pick up

interface Problem { kind: string; detail: string; seed: number; at: number }
interface Tally {
  seed: number;
  felled: Record<TreeKind, number>;
  chops: number;
  logsDropped: number;
  logsPicked: number;
  skill: [number, number];
  treeSeconds: number[]; // from the first swing to the fall, each tree
  unreachable: number;
  bagFull: number;
}

class LumberBot extends BotSteps {
  readonly tally: Tally;
  private readonly tried = new Set<string>(); // trees found out of reach: let be
  private steps: Step[] = [];
  private stopTried = false; // walking off a chop: tried once

  constructor(model: GameModel, report: (kind: string, detail: string) => void, rng: () => number, seed: number) {
    super(model, report, rng);
    this.goal = 'lumber';
    const level = skillOf(model.hero, 'lumberjacking').level;
    this.tally = { seed, felled: { birch: 0, pine: 0, oak: 0 }, chops: 0, logsDropped: 0, logsPicked: 0, skill: [level, level], treeSeconds: [], unreachable: 0, bagFull: 0 };
  }

  // A frame: the next step, the keys it pressed fed to the game.
  tick(): void {
    if (this.steps.length === 0) this.steps = this.plan();
    this.move = [0, 0];
    const step = this.steps[0];
    const status = step ? step(FRAME) : 'ok';
    if (status !== 'run') this.steps.shift();
    if (status === 'fail') this.steps = [];
    this.model.update(this.move[0], this.move[1], FRAME);
    const level = skillOf(this.model.hero, 'lumberjacking').level;
    if (level > SKILL_MAX) this.report('skill past the most there is', `${level}`);
    this.tally.skill[1] = level;
  }

  // What next: logs lying near, picked up; else to the nearest tree it can fell, and fell it; else wait a moment.
  private plan(): Step[] {
    const log = this.nearestLog();
    if (log) return [this.walk(() => log, PICKUP_RANGE * 0.7), this.takeLog(log)];
    const tree = this.nextTree();
    if (!tree) return [this.wait(2)];
    const walk = this.walk(() => tree, REACH - 0.3);
    const there: Step = (dt) => {
      const status = walk(dt);
      if (status === 'fail') [this.tried.add(treeKey(tree)), this.tally.unreachable++]; // (hemmed in, by its fellows say: let be for good)
      return status;
    };
    return [there, this.fell(tree)];
  }

  private nearestLog() {
    const { hero } = this.model;
    return this.model.loot.filter((l) => l.item in LOGS && Math.hypot(l.x - hero.x, l.z - hero.z) < LOG_LOOK && !this.skipped.has(l)).sort((a, b) => Math.hypot(a.x - hero.x, a.z - hero.z) - Math.hypot(b.x - hero.x, b.z - hero.z))[0];
  }

  private takeLog(log: (typeof this.model.loot)[number]): Step {
    return () => {
      const before = this.model.hero.bag[log.item] ?? 0;
      const taken = this.model.pickUp();
      if (!taken) {
        this.skipped.add(log);
        if (Math.hypot(log.x - this.model.hero.x, log.z - this.model.hero.z) <= PICKUP_RANGE) this.tally.bagFull++; // (in reach, not taken: the bag's full)
        return 'fail';
      }
      this.tally.logsPicked++;
      if (taken === log.item && (this.model.hero.bag[log.item] ?? 0) <= before) this.report('log picked up, not in the bag', `${log.item}: ${before} before, ${this.model.hero.bag[log.item] ?? 0} after`);
      return 'ok';
    };
  }

  // The nearest standing tree it's skilled enough for (none found out of reach before).
  private nextTree(): Tree | null {
    const { hero } = this.model;
    const level = skillOf(hero, 'lumberjacking').level;
    let best: Tree | null = null;
    let near = LOOK;
    for (const tree of this.model.trees) {
      if (Math.abs(tree.x - hero.x) > near || Math.abs(tree.z - hero.z) > near) continue;
      if (WOOD[tree.kind].needs > level || this.tried.has(treeKey(tree)) || this.model.lumber.felled(tree)) continue;
      const d = Math.hypot(tree.x - hero.x, tree.z - hero.z);
      if (d < near) [best, near] = [tree, d];
    }
    return best;
  }

  // At the tree: E, then chop after chop till it's down, each checked; out of reach to begin with: let be.
  private fell(tree: Tree): Step {
    const { model } = this;
    const lumber = model.lumber;
    let begun = false;
    let since = 0; // seconds since the last chop (or the first swing)
    let due = lumber.chopSeconds; // what this chop's due to take, as it began (a tier risen at its end: the next one quicker)
    let took = 0;
    let cut = lumber.cut.get(treeKey(tree)) ?? 0;
    const chops = chopsIn(tree, model.seed);
    return (dt) => {
      const { hero } = model;
      if (!begun) {
        if (lumber.treeInReach !== tree) {
          this.tried.add(treeKey(tree)); // (let be from now on, either way: never round again for it)
          const other = lumber.treeInReach;
          if (Math.hypot(tree.x - hero.x, tree.z - hero.z) > REACH) this.tally.unreachable++;
          else if (other && WOOD[other.kind].needs > skillOf(hero, 'lumberjacking').level) this.report('tree in reach one it cannot fell, before one it can', `a ${other.kind} before the ${tree.kind} at ${tree.x},${tree.z}`);
          return 'fail'; // (another nearer it can fell too, or out of reach: on to the next)
        }
        if (lumber.action?.kind !== 'chop') return this.report('tree it can fell refused', `${tree.kind} at ${tree.x},${tree.z}: ${JSON.stringify(lumber.action)}`), 'fail';
        if (!lumber.use() || !lumber.chopping) return this.report('chopping not begun', `${tree.kind} at ${tree.x},${tree.z}`), 'fail';
        if (WOOD[tree.kind].needs > skillOf(hero, 'lumberjacking').level) this.report('tree above the skill chopped', `${tree.kind} at level ${skillOf(hero, 'lumberjacking').level}`);
        begun = true;
        return 'run';
      }
      took += dt;
      since += dt;
      // Once a session: a step off mid-chop stops it (then on again).
      if (!this.stopTried && cut >= 1) {
        this.stopTried = true;
        model.update(1, 0, FRAME);
        if (lumber.chopping) this.report('walking off went on chopping', `${tree.kind} at ${tree.x},${tree.z}`);
        return 'fail'; // (planned afresh: back to it)
      }
      const now = lumber.cut.get(treeKey(tree)) ?? 0;
      if (now > cut) this.chopped(tree, now, cut, since, due), [cut, since, due] = [now, 0, lumber.chopSeconds];
      if (lumber.felled(tree)) return this.felled(tree, chops, took);
      if (!lumber.chopping) {
        // Stopped, not felled: why, as far as can be told (a blow's knock carrying them off, a foe on them).
        const foe = model.foes.filter((e) => e.state !== 'dead').sort((a, b) => Math.hypot(a.x - hero.x, a.z - hero.z) - Math.hypot(b.x - hero.x, b.z - hero.z))[0];
        const why = `${Math.hypot(tree.x - hero.x, tree.z - hero.z).toFixed(2)} tiles from it${hero.hurtFor > 0 ? ', just hit' : ''}${foe ? `, a ${foe.kind} ${Math.hypot(foe.x - hero.x, foe.z - hero.z).toFixed(1)} tiles off` : ''}`;
        if (hero.hurtFor > 0 || Math.hypot(tree.x - hero.x, tree.z - hero.z) > REACH) return 'fail'; // (knocked off it by a foe: as it should be)
        return this.report('chopping stopped by itself', `${tree.kind} at ${tree.x},${tree.z}, ${cut} of ${chops} chops: ${why}`), 'fail';
      }
      if (since > lumber.chopSeconds * 3) return this.report('chop never landed', `${tree.kind} at ${tree.x},${tree.z}: ${since.toFixed(1)} s, a chop every ${lumber.chopSeconds.toFixed(1)}`), 'fail';
      return 'run';
    };
  }

  // A chop landed: on time, one cut, a log of its kind beside it, experience, the skill up only as its difficulty allows.
  private before = { logs: 0, xp: 0, level: 0 };
  private chopped(tree: Tree, now: number, was: number, since: number, due: number): void {
    const { model } = this;
    this.tally.chops++;
    if (now !== was + 1) this.report('chop cut more than once', `${tree.kind}: ${was} → ${now}`);
    if (Math.abs(since - due) > 0.2 && was > 0) this.report('chop off time', `${since.toFixed(2)} s, ${due.toFixed(2)} s due`);
    const logs = model.loot.filter((l) => l.item === WOOD[tree.kind].log && Math.hypot(l.x - tree.x, l.z - tree.z) < 1.2);
    if (logs.length === 0) this.report('no log by the tree', `${tree.kind} at ${tree.x},${tree.z}`);
    else this.tally.logsDropped++;
    const wrong = model.loot.filter((l) => l.item in LOGS && l.item !== WOOD[tree.kind].log && Math.hypot(l.x - tree.x, l.z - tree.z) < 0.9);
    if (wrong.length > 0) this.report('wrong log for the tree', `${wrong[0].item} by a ${tree.kind}`);
    const { hero } = model;
    if (hero.xp <= this.before.xp && hero.level === this.before.level) this.report('chop gave no experience', `${tree.kind}`);
    const level = skillOf(hero, 'lumberjacking').level;
    if (level > this.tally.skill[1] && difficulty(tree.kind, this.tally.skill[1]).chance === 0) this.report('skill up off a grey tree', `${tree.kind} at ${this.tally.skill[1]}`);
    this.before = { logs: logs.length, xp: hero.xp, level: hero.level };
  }

  // Down at exactly its chops: chopping over, out of the way, not to be chopped again.
  private felled(tree: Tree, chops: number, took: number): 'ok' {
    const { model } = this;
    const at = `${tree.kind} at ${tree.x},${tree.z}`;
    if ((model.lumber.cut.get(treeKey(tree)) ?? 0) !== chops) this.report('felled at the wrong chop', `${at}: ${model.lumber.cut.get(treeKey(tree))} of ${chops}`);
    if (model.lumber.chopping) this.report('chopping on, the tree down', at);
    if (model.isBlocked(tree.x, tree.z, 0.1)) this.report('felled tree still in the way', at);
    if (model.lumber.treeInReach === tree) this.report('felled tree still to be chopped', at);
    if (!model.takeEvents().some((e) => e.kind === 'felled' && e.x === tree.x && e.z === tree.z)) this.report('felled tree not told', at);
    this.tally.felled[tree.kind]++;
    this.tally.treeSeconds.push(took);
    return 'ok';
  }
}

const LOGS = Object.fromEntries(Object.values(WOOD).map((w) => [w.log, true]));

// A session: one bot, one world.
function play(seed: number, problems: Problem[]): Tally {
  const model = new GameModel(seed, STREAMED_SIZE);
  // (stuck on the way, a foe on them: a woodcutter doesn't fight, the main bots see to that; not a lumberjacking matter)
  const foeOn = () => model.foes.some((e) => e.state !== 'dead' && Math.hypot(e.x - model.hero.x, e.z - model.hero.z) < 4);
  const report = (kind: string, detail: string) => {
    if (kind === 'hero stuck' && foeOn()) return;
    problems.push({ kind, detail, seed, at: Math.round(model.minutes) });
  };
  // No axe in hand: E by a tree refused.
  const first = model.trees.find((t) => t.kind === 'birch' && Math.hypot(t.x - model.hero.x, t.z - model.hero.z) < 30);
  if (first) {
    const from = { x: model.hero.x, z: model.hero.z };
    Object.assign(model.hero, { x: first.x + 0.7, z: first.z });
    if (model.lumber.action?.kind !== 'cannot' || model.lumber.use()) report('chopped with no axe', `at ${first.x},${first.z}`);
    Object.assign(model.hero, from);
  }
  model.hero.equipment.mainHand = 'hatchet';
  const bot = new LumberBot(model, report, mulberry32(seed), seed);
  for (let t = 0; t < MINUTES * 60; t += FRAME) bot.tick();
  // A save and its reload: what's cut kept, the felled out of the way.
  const again = new GameModel(seed, STREAMED_SIZE);
  restore(again, parseSave(JSON.stringify(snapshot(model)), seed)!);
  if (JSON.stringify(again.lumber.saved()) !== JSON.stringify(model.lumber.saved())) report('cuts not kept by the save', `${Object.keys(model.lumber.saved()).length} saved, ${Object.keys(again.lumber.saved()).length} read back`);
  for (const key of Object.keys(model.lumber.saved())) {
    const [x, z] = key.split(',').map(Number);
    const tree = again.trees.find((t) => t.x === x && t.z === z) ?? model.trees.find((t) => t.x === x && t.z === z);
    if (tree && model.lumber.felled(tree) && again.world.has(x, z) && again.isBlocked(x, z, 0.1)) report('felled tree in the way after a reload', `${tree.kind} at ${key}`);
  }
  return bot.tally;
}

// Every session, then the report.
const problems: Problem[] = [];
const tallies: Tally[] = [];
const started = Date.now();
for (const [i, seed] of SEEDS.entries()) {
  const t0 = Date.now();
  const tally = play(seed, problems);
  tallies.push(tally);
  const down = Object.values(tally.felled).reduce((a, b) => a + b, 0);
  console.log(`  bot ${i + 1}/${SEEDS.length}, seed ${seed}: ${down} felled (${tally.felled.birch} birch, ${tally.felled.pine} pine, ${tally.felled.oak} oak), ${tally.chops} chops, skill ${tally.skill[0]} → ${tally.skill[1]}, ${Math.round((Date.now() - t0) / 1000)} s`);
}

const sum = (f: (t: Tally) => number) => tallies.reduce((a, t) => a + f(t), 0);
const times = tallies.flatMap((t) => t.treeSeconds).sort((a, b) => a - b);
const byKind = new Map<string, Problem[]>();
for (const p of problems) byKind.set(p.kind, [...(byKind.get(p.kind) ?? []), p]);
const lines = [
  `# Lumberjack bots: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
  '',
  `${SEEDS.length} bots, ${MINUTES} game minutes each (seeds ${SEEDS.join(', ')}), ${Math.round((Date.now() - started) / 1000)} s.`,
  '',
  '## Problems',
  '',
  ...(byKind.size === 0 ? ['None.'] : [...byKind].sort((a, b) => b[1].length - a[1].length).flatMap(([kind, list]) => [`- **${kind}**: ${list.length} times, in ${new Set(list.map((p) => p.seed)).size} games. E.g. seed ${list[0].seed} at ${list[0].at} s: ${list[0].detail}`])),
  '',
  '## What was done',
  '',
  '| seed | birch | pine | oak | chops | logs dropped | logs picked | skill | unreachable | bag full |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...tallies.map((t) => `| ${t.seed} | ${t.felled.birch} | ${t.felled.pine} | ${t.felled.oak} | ${t.chops} | ${t.logsDropped} | ${t.logsPicked} | ${t.skill[0]} → ${t.skill[1]} | ${t.unreachable} | ${t.bagFull} |`),
  '',
  `In all: ${sum((t) => t.felled.birch + t.felled.pine + t.felled.oak)} trees felled, ${sum((t) => t.chops)} chops, ${sum((t) => t.logsPicked)} logs picked up. A tree took ${times.length ? `${times[Math.floor(times.length / 2)].toFixed(1)} s (median), ${times[0].toFixed(1)}–${times.at(-1)!.toFixed(1)} s` : 'n/a'} from the first swing to its fall. Skill after ${MINUTES} minutes: ${tallies.map((t) => t.skill[1]).sort((a, b) => a - b).join(', ')}.`,
  '',
  `To play one again: LUMBER_SEEDS=${problems[0]?.seed ?? SEEDS[0]} npm run bots:lumber`,
];
mkdirSync('tests/bots/reports', { recursive: true });
const file = `tests/bots/reports/lumber-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.md`;
writeFileSync(file, `${lines.join('\n')}\n`);
console.log('');
console.log(byKind.size === 0 ? 'No problems.' : [...byKind].map(([kind, list]) => `${kind}: ${list.length} times — e.g. seed ${list[0].seed} at ${list[0].at} s: ${list[0].detail}`).join('\n'));
console.log(`\nReport: ${file}`);
process.exit(byKind.size === 0 ? 0 : 1);

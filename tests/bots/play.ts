// One worker's share of the bots (npm run bots starts several): each seed
// in BOT_SEEDS gets its own world and a bot playing it for BOT_MINUTES of
// game time, checked once a game second; a line of JSON per bot, when done.
import { GameModel } from '../../src/model/GameModel';
import { mulberry32 } from '../../src/util/random';
import { Bot } from './bot';
import { Checks, type Problem } from './checks';

const SIZE = { width: 512, depth: 512 };
const DT = 1 / 30; // a frame at 30 fps
const MAX_PER_KIND = 5; // problems of one kind kept per bot (the rest just counted)

// The clock (shops restock by it) goes by game time, from a fixed start, and chance comes
// from the seed: each seed plays the same every time (to play a problem again).
const EPOCH = Date.UTC(2026, 0, 1);
let clock = EPOCH;
Date.now = () => clock;

function play(seed: number, minutes: number) {
  const started = performance.now();
  const problems: Problem[] = [];
  const counts: Record<string, number> = {};
  let t = 0;
  const report = (kind: string, detail: string) => {
    counts[kind] = (counts[kind] ?? 0) + 1;
    if (counts[kind] <= MAX_PER_KIND) problems.push({ kind, seed, t: Math.round(t), detail });
  };
  Math.random = mulberry32(seed * 7919 + 1); // (and chance rolled from the seed too)
  const model = new GameModel(seed, SIZE);
  const bot = new Bot(model, report, mulberry32(seed ^ 0x5eed));
  const checks = new Checks(model, report);
  let second = 0;
  let crashes = 0;
  for (; t < minutes * 60; t += DT) {
    clock = EPOCH + Math.round(t * 1000);
    try {
      bot.tick(DT);
      if ((second += DT) >= 1) {
        checks.run(second);
        second = 0;
      }
    } catch (error) {
      report('crash', (error as Error).stack?.split('\n').slice(0, 4).join(' | ') ?? String(error));
      if (++crashes > 50) break; // (broken for good: on to the next)
    }
  }
  const { hero } = model;
  return { seed, problems, counts, stats: bot.stats, level: hero.level, money: hero.money, seconds: Math.round((performance.now() - started) / 100) / 10 };
}

const seeds = (process.env.BOT_SEEDS ?? '1').split(',').map(Number);
const minutes = Number(process.env.BOT_MINUTES ?? 60);
for (const seed of seeds) console.log(`BOT ${JSON.stringify(play(seed, minutes))}`);

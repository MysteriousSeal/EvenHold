// How well each way of fighting does in the arena (arena.ts), fight by fight on the same set (the same seeds): flailing
// at random, the bots' way (straight at the nearest foe, a blow whenever it can), and the trained fighter's
// (models/fighter.json, if there's one): won, fell, out of time, health lost, seconds taken; by fight and in all.
//   npm run ai:eval            a set of named fights, 40 seeds each
//   AI_FIGHTS=200 npm run ai:eval   that many fights at random besides
import { existsSync } from 'node:fs';
import { Arena, NAMED_FIGHTS, type Scenario, type Step } from './arena';
import { Fighter } from './fighter';

type Policy = (observation: number[]) => [number, number];

// The bots' way: toward the nearest foe (its place among what's seen), a blow once it's close.
const scripted: Policy = (o) => {
  const [dx, dz, , close] = o.slice(17 + 1, 17 + 5); // (the nearest foe: present, dx, dz, distance, close)
  if (o[17] === 0) return [0, 0];
  const angle = Math.atan2(dx, dz);
  const way = 1 + (Math.round(angle / (Math.PI / 4)) + 8) % 8;
  return [close ? 0 : way, close ? 1 : 0];
};
const random: Policy = () => [Math.floor(Math.random() * 9), Math.floor(Math.random() * 4)];

const SEEDS = 40;

function play(policy: Policy, scenario: Scenario | undefined, seed: number): Step['info'] {
  const arena = new Arena();
  let observation = arena.reset(seed, scenario);
  for (;;) {
    const step = arena.step(...policy(observation));
    if (step.done || step.truncated) return step.info;
    observation = step.observation;
  }
}

function tally(fights: Array<Step['info']>): string {
  const share = (f: (i: Step['info']) => boolean) => `${Math.round((fights.filter(f).length / fights.length) * 100)}%`.padStart(4);
  const mean = (f: (i: Step['info']) => number) => (fights.reduce((n, i) => n + f(i), 0) / fights.length).toFixed(1).padStart(5);
  return `won ${share((i) => i.won)} · fell ${share((i) => i.fell)} · out of time ${share((i) => !i.won && !i.fell)} · health lost ${mean((i) => i.taken)} · ${mean((i) => i.seconds)} s`;
}

const policies: Array<[string, Policy]> = [['random', random], ['bots', scripted]];
if (existsSync('tests/ai/models/fighter.json')) {
  const fighter = new Fighter();
  policies.push(['trained', (o) => fighter.act(o)]);
} else console.log('(no trained fighter yet: npm run ai:train)\n');

const extra = Number(process.env.AI_FIGHTS ?? 0);
for (const scenario of [...NAMED_FIGHTS, ...(extra > 0 ? [undefined] : [])]) {
  console.log(scenario ? scenario.name : `${extra} fights at random`);
  const seeds = Array.from({ length: scenario ? SEEDS : extra }, (_, i) => 1 + i);
  for (const [name, policy] of policies) console.log(`  ${name.padEnd(8)} ${tally(seeds.map((seed) => play(policy, scenario, seed)))}`);
}

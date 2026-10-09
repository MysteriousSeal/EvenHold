// The trained player plays a life (models/player.json; none trained yet: one pressing keys at random, to see the
// report's shape), told as it goes, and writes up what the life says about the game: where its time went, what it
// did and never did (what the game let it skip), what paid, the game's own faults (bots/checks.ts). The report lands
// in tests/ai/reports/ai-<date>-<seed>.md.
//   npm run ai:play                       a life of AI_MINUTES (30) game minutes in a new world
//   AI_SEED=7 AI_MINUTES=60 npm run ai:play   that world, longer
//   AI_GREEDY=1 npm run ai:play           the likeliest key each time, not drawn by its odds
//   AI_LATEST=1 npm run ai:play           the latest player saved, not the best
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateRandomSeed, mulberry32 } from '../../src/util/random';
import { Checks, type Problem } from '../bots/checks';
import { ACTIONS, EPISODE_MINUTES, MOVES, OBSERVATION_SIZE, Player } from './player';
import { PAY_SOURCES } from './tally';
import { Policy, random, type PolicyWeights } from './policy';
import { KEYS } from './keys';
import type { Tally } from './tally';

const seed = Number(process.env.AI_SEED ?? generateRandomSeed());
const realNow = Date.now();
const EPOCH = Date.UTC(2026, 0, 1);
let clock = EPOCH;
Date.now = () => clock;
const rng = mulberry32(seed * 7919 + 1);
// The best player saved, unless told the latest (AI_LATEST=1); none: keys at random.
const weightsPath = [process.env.AI_LATEST ? 'models/player.json' : 'models/best.json', 'models/player.json'].map((p) => resolve(__dirname, p)).find((p) => existsSync(p));
const saved: PolicyWeights | null = weightsPath ? JSON.parse(readFileSync(weightsPath, 'utf8')) : null;
const stale = !!saved && !new Policy(saved).fits(OBSERVATION_SIZE); // (trained before what it sees changed)
if (stale) console.log('The player saved was trained on what it saw before (it sees more now): playing keys at random. Train again: npm run ai:train -- --fresh');
const weights = stale ? null : saved;
const policy = weights ? new Policy(weights) : null;
const choose = policy ? (o: readonly number[]) => policy.act(o, process.env.AI_GREEDY ? undefined : rng) : random(MOVES, ACTIONS, rng);

const player = new Player();
const problems: Problem[] = [];
const counts: Record<string, number> = {};
const report = (kind: string, detail: string) => {
  counts[kind] = (counts[kind] ?? 0) + 1;
  if (counts[kind] <= 5) problems.push({ kind, seed, t: player.seconds, detail });
};
const stamp = () => `${String(Math.floor(player.seconds / 60)).padStart(2)}:${String(Math.floor(player.seconds % 60)).padStart(2, '0')}`;
console.log(`Seed ${seed}: a new world, ${weights ? `the ${weightsPath!.endsWith('best.json') ? 'best' : 'latest'} player (trained ${(weights.steps ?? 0).toLocaleString()} decisions${weights.score != null ? `, scored ${weights.score.toFixed(2)}` : ''})` : 'an untrained player (keys at random)'}, ${EPISODE_MINUTES} game minutes.\n`);

let observation = player.reset(seed);
const checks = new Checks(player.model, report);
type Minute = { t: number; level: number; xp: number; money: number; kills: number; falls: number; quests: number };
const minutes: Minute[] = [];
let [lastSecond, lastMinute, reward] = [0, -1, 0];
for (;;) {
  const [move, key] = choose(observation);
  const step = player.step(move, key);
  [observation, reward] = [step.observation, reward + step.reward];
  clock = EPOCH + Math.round(player.seconds * 1000);
  if (player.seconds - lastSecond >= 1) [checks.run(player.seconds - lastSecond), (lastSecond = player.seconds)];
  const minute = Math.floor(player.seconds / 60);
  if (minute > lastMinute) {
    lastMinute = minute;
    const { tally } = player;
    minutes.push({ t: minute, level: tally.level, xp: tally.xp, money: tally.money, kills: tally.kills, falls: tally.falls, quests: tally.quests.done });
    const { hero } = player.model;
    console.log(`${stamp()}  — level ${hero.level} · health ${Math.round(hero.hp)} · ${hero.money} copper · ${tally.quests.done}/${tally.quests.taken} quests · ${player.window ? `the ${player.window.kind} window` : player.model.inside ? `in the ${player.model.inside.entrance.type}` : 'outdoors'} · reward so far ${reward.toFixed(2)}`);
  }
  if (step.truncated || step.done) break;
}
const text = playReport(player.tally, seed, reward, weights, minutes, problems);
mkdirSync(resolve(__dirname, 'reports'), { recursive: true });
const path = resolve(__dirname, `reports/ai-${new Date(realNow).toISOString().slice(0, 19).replace(/[T:]/g, '-')}-${seed}.md`);
writeFileSync(path, text);
console.log(`\n${text.split('\n').slice(0, 12).join('\n')}\n…\nThe report: ${path}`);

// The life written up.
function playReport(tally: Tally, seed: number, reward: number, weights: PolicyWeights | null, minutes: Minute[], problems: Problem[]): string {
  const lines: string[] = [];
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const whole = tally.seconds || 1;
  lines.push(`# An AI's life: seed ${seed}, ${Math.round(tally.seconds / 60)} game minutes`, '');
  lines.push(`**The player:** ${weights ? `trained ${(weights.steps ?? 0).toLocaleString()} decisions` : 'untrained: keys at random'}; paid ${reward.toFixed(2)} in all (a level's experience 1, a quest 1, 500 copper 1, a fall −1; helpers: a new patch of ground 0.01, up to 1.5 a life, a foe's whole health in blows 0.3).`, '');
  lines.push(`**Paid, by what for:** ${PAY_SOURCES.map((k) => `${k} ${tally.pay[k].toFixed(2)}`).join(', ')}. The game's own (xp, coin, quests, falls) came to ${(tally.pay.xp + tally.pay.coin + tally.pay.quest + tally.pay.fall).toFixed(2)}; the helpers (new ground, blows) to ${(tally.pay.explore + tally.pay.blows).toFixed(2)}.`, '');
  lines.push(`**At the end:** level ${tally.level}, ${tally.xp} xp, ${tally.money} copper (${tally.earned} earned, ${tally.spent} spent), ${tally.quests.done}/${tally.quests.taken} quests done (${tally.quests.abandoned} given up), ${tally.kills} slain, ${tally.falls} falls, ${tally.hurt.toFixed(1)} health bars lost.`, '');
  // What it skipped: the part to read.
  const did: Array<[string, number]> = [['went into a house', tally.doors.house ?? 0], ['went into an inn', tally.doors.inn ?? 0], ['went into a smithy', tally.doors.smithy ?? 0], ["went into the herbalist's", tally.doors.herbalist ?? 0], ['went down a crypt', tally.doors.crypt ?? 0], ['went into a cave', tally.doors.cave ?? 0], ['took a quest', tally.quests.taken], ['handed a quest in', tally.quests.done], ['bought', tally.bought], ['sold', tally.sold], ['crafted', tally.crafted], ['broke down gear', tally.salvaged], ['felled a tree', tally.chopped], ['worked a shift', tally.shifts], ['drank an ale', tally.ales], ['ate a pie', tally.pies], ['rented a room', tally.rooms], ['tossed a coin', tally.wishes], ['opened a chest', tally.chests], ['cleared a camp', tally.camps], ['slew a boss', tally.dungeons], ['put gear on', tally.equipped], ['ate from the bag', tally.eaten], ['drank a potion', tally.potions], ['spent a point', tally.pointsSpent]];
  lines.push('## What this says about the game', '');
  const never = did.filter(([, n]) => n === 0).map(([w]) => w);
  const done = did.filter(([, n]) => n > 0);
  lines.push(`- Never once: ${never.join(', ') || 'nothing left untried'}. What a player paid for progress alone can skip.`);
  if (done.length) lines.push(`- Did: ${done.map(([w, n]) => `${w} ×${n}`).join(', ')}.`);
  const top = Object.entries(tally.places).sort((a, b) => b[1] - a[1])[0];
  lines.push(`- ${pct(top[1] / whole)} of the time ${top[0] === 'outdoors' ? 'outdoors' : `in the ${top[0]}`}; moving ${pct(tally.moving / Math.max(1, Object.values(tally.keys).reduce((a, b) => a + b, 0)))} of decisions.`);
  if (tally.falls >= 3) lines.push(`- Fell ${tally.falls} times: the danger outruns it, or it never learnt to mend.`);
  if (tally.wasted > 100) lines.push(`- E pressed with nothing to do ${tally.wasted} times: the prompt's not read, or there's little to do where it goes.`);
  lines.push('', '## Where the time went', '', '| place | minutes | of the life |', '|---|---|---|');
  for (const [place, s] of Object.entries(tally.places).sort((a, b) => b[1] - a[1])) if (s > 0) lines.push(`| ${place} | ${(s / 60).toFixed(1)} | ${pct(s / whole)} |`);
  lines.push('', '## Keys pressed', '', '| key | times |', '|---|---|');
  for (const [k, n] of Object.entries(tally.keys).sort((a, b) => b[1] - a[1])) lines.push(`| ${k} | ${n} |`);
  lines.push(`\nNever pressed: ${KEYS.filter((k) => !tally.keys[k]).join(', ') || 'none'}.`, '');
  lines.push('## Windows opened', '', Object.entries(tally.windows).map(([k, n]) => `${k} ×${n}`).join(', ') || 'none', '');
  lines.push('## Minute by minute', '', '| min | level | xp | copper | kills | falls | quests |', '|---|---|---|---|---|---|---|');
  for (const m of minutes.filter((m) => m.t % 5 === 0 || m === minutes.at(-1))) lines.push(`| ${m.t} | ${m.level} | ${m.xp} | ${m.money} | ${m.kills} | ${m.falls} | ${m.quests} |`);
  lines.push('', '## Problems the game had', '');
  const kinds = new Map<string, Problem[]>();
  for (const p of problems) kinds.set(p.kind, [...(kinds.get(p.kind) ?? []), p]);
  if (kinds.size === 0) lines.push('None.');
  for (const [kind, list] of kinds) lines.push(`- **${kind}** × ${counts[kind]}: e.g. ${Math.floor(list[0].t / 60)}:${String(Math.floor(list[0].t % 60)).padStart(2, '0')}, ${list[0].detail}`);
  lines.push('');
  return lines.join('\n');
}

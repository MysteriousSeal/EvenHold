// A playthrough (npm run player): one player of their own mind (player.ts) in a fresh world (a seed at random each
// run, or PLAY_SEED to play one again), for PLAY_MINUTES of game time (an hour), told as it goes: who they are, each
// choice and why, what they find, what they did and what it brought, levels and skills risen, and how they stand each
// minute. Then a report (tests/bots/reports/play-….md: report.ts) to read the game by.
// PLAYERS=4 (up to four, one a core): as many at once, each its own world and report, their tellings side by side,
// each line tagged with its player's number and seed; PLAY_SEEDS=a,b,c: those games again, together.

import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GameModel } from '../../../src/model/GameModel';
import { STREAMED_SIZE } from '../../../src/model/worldgen/regions';
import { generateRandomSeed, mulberry32 } from '../../../src/util/random';
import { Checks, type Problem } from '../checks';
import { Player } from './player';
import { playReport } from './report';

const MOST = 4; // players at once, at most
const minutes = Number(process.env.PLAY_MINUTES ?? 60);
const several = process.env.PLAY_SEEDS?.split(',').map(Number);
const wanted = Math.max(1, Math.min(MOST, availableParallelism(), several?.length ?? Number(process.env.PLAYERS ?? 1)));

if (wanted > 1 && !process.env.PLAY_CHILD) await together(several ?? Array.from({ length: wanted }, () => generateRandomSeed()));
else play(Number(process.env.PLAY_SEED ?? generateRandomSeed()));

// Several at once: each its own process (a core each), its lines tagged; the reports listed at the end.
async function together(seeds: number[]): Promise<void> {
  console.log(`${seeds.length} players at once, ${minutes} game minutes each (seeds ${seeds.join(', ')}).\n`);
  const reports: string[] = [];
  await Promise.all(
    seeds.map(
      (seed, i) =>
        new Promise<void>((done) => {
          const child = spawn(process.execPath, [resolve('node_modules/vite-node/vite-node.mjs'), 'tests/bots/player/playthrough.ts'], {
            env: { ...process.env, PLAY_SEED: String(seed), PLAY_CHILD: '1', PLAYERS: '1', PLAY_SEEDS: '' },
            stdio: ['ignore', 'pipe', 'inherit'],
          });
          let buffered = '';
          child.stdout.on('data', (chunk: Buffer) => {
            buffered += chunk.toString();
            const lines = buffered.split('\n');
            buffered = lines.pop()!;
            for (const line of lines) {
              if (line.startsWith('Report: ')) reports[i] = line.slice(8);
              console.log(`[${i + 1} · ${seed}] ${line}`);
            }
          });
          child.on('close', (code) => [code !== 0 && console.log(`[${i + 1} · ${seed}] exited with ${code}`), done()]);
        }),
    ),
  );
  console.log(`\nReports:\n${seeds.map((seed, i) => `  [${i + 1} · ${seed}] ${reports[i] ?? '(none)'}`).join('\n')}`);
}

function play(seed: number): void {
const DT = 1 / 30;
const MAX_PER_KIND = 5;

// The clock (shops restock by it) goes by game time; chance comes from the seed.
const EPOCH = Date.UTC(2026, 0, 1);
let clock = EPOCH;
Date.now = () => clock;
Math.random = mulberry32(seed * 7919 + 1);

let t = 0;
const stamp = () => `${String(Math.floor(t / 60)).padStart(2)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const say = (what: string) => console.log(`${stamp()}  ${what}`);
const problems: Problem[] = [];
const counts: Record<string, number> = {};
const report = (kind: string, detail: string) => {
  counts[kind] = (counts[kind] ?? 0) + 1;
  if (counts[kind] <= MAX_PER_KIND) [problems.push({ kind, seed, t: Math.round(t), detail }), say(`⚠ ${kind}: ${detail}`)];
};

console.log(`Seed ${seed}: a new world, a new player, ${minutes} game minutes.\n`);
const started = performance.now();
const model = new GameModel(seed, STREAMED_SIZE);
const player = new Player(model, report, mulberry32(seed ^ 0x5eed), say);
const checks = new Checks(model, report);
let second = 0;
let before = { ...player.stats };
let crashes = 0;
for (; t < minutes * 60; t += DT) {
  clock = EPOCH + Math.round(t * 1000);
  try {
    player.tick(DT);
    if ((second += DT) >= 1) {
      second = 0;
      checks.run(1);
      player.balance.sample(t, player.stats);
      player.observe(t);
      // What changed this second, in the tally.
      const now = player.stats;
      const changed = (Object.keys(now) as Array<keyof typeof now>).filter((k) => k !== 'goals' && now[k] !== before[k]).map((k) => `${k} +${(now[k] as number) - (before[k] as number)}`);
      if (changed.length) say(`  ${changed.join(', ')}`);
      before = { ...now };
      if (Math.floor(t) % 60 === 0) {
        const { hero, inside } = model;
        say(`— level ${hero.level} · health ${Math.round(hero.hp)} · energy ${Math.round(hero.energy)} · ${hero.money} copper · ${model.quests.taken.length} quests · ${inside ? `in the ${inside.entrance.type}` : `out at ${Math.round(hero.x)},${Math.round(hero.z)}`}`);
      }
    }
  } catch (error) {
    report('crash', (error as Error).stack?.split('\n').slice(0, 4).join(' | ') ?? String(error));
    if (++crashes > 50) break;
  }
}
player.balance.sample(minutes * 60, player.stats);
(player as unknown as { plan(): void }).plan(); // (the last thing done, written up)

const text = playReport(player, seed, minutes, problems);
const dir = resolve('tests/bots/reports');
mkdirSync(dir, { recursive: true });
const file = resolve(dir, `play-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}-${seed}.md`); // (the seed in it: several at once never share one)
writeFileSync(file, text);
console.log(`\n${text.split('## Where the hour went')[0].split('\n').slice(2).join('\n')}`);
console.log(`Played in ${Math.round((performance.now() - started) / 1000)} s.`);
console.log(`Report: ${file.replace(`${process.cwd()}/`, '')}`);
console.log(`To play this game again: PLAY_SEED=${seed} npm run player`);
}

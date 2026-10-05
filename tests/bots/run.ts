// The bots' playtest (npm run bots; npm run bots:quick for a short one;
// npm run bots:verbose to watch what each is up to as it plays; npm run bots:small
// for 4 of them, an hour each, watched; npm run bots:long for 6, eight hours each,
// watched; what each does: "scripts-info" in package.json):
// BOTS bots, each on its own seed (fresh ones at random each run), playing BOT_MINUTES of game time as
// fast as it goes, shared out among workers (play.ts), one per core but
// one. Then a report of all that went wrong (by kind, with where and when,
// and the seed to play it again on), written to tests/bots/reports/ and
// summed up here; it fails if there was anything.
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Problem } from './checks';
import type { BotStats } from './bot';
import type { BalanceData } from './balance';
import { balanceReport } from './balanceReport';
import { generateRandomSeed } from '../../src/util/random';

interface Result {
  seed: number;
  problems: Problem[];
  counts: Record<string, number>;
  stats: BotStats;
  balance?: BalanceData;
  level: number;
  money: number;
  seconds: number;
}

const quick = process.env.BOT_QUICK === '1';
const verbose = process.env.BOT_VERBOSE === '1'; // each bot's doings, live (npm run bots:verbose)
// Seeds: BOT_SEEDS (a list: those games played again), else BOT_FIRST_SEED on (one after another), else fresh ones at random, each run.
const given = process.env.BOT_SEEDS?.split(',').map(Number);
const bots = given?.length ?? Number(process.env.BOTS ?? (quick ? 10 : 100));
const minutes = Number(process.env.BOT_MINUTES ?? (quick ? 10 : 60));
const workers = Math.max(1, Math.min(bots, availableParallelism() - 1));
const seeds = given ?? (process.env.BOT_FIRST_SEED ? Array.from({ length: bots }, (_, i) => Number(process.env.BOT_FIRST_SEED) + i) : randomSeeds(bots));
const seedList = seeds.length <= 12 ? seeds.join(', ') : `${seeds.slice(0, 12).join(', ')}…`;

function randomSeeds(count: number): number[] {
  const picked = new Set<number>();
  while (picked.size < count) picked.add(generateRandomSeed());
  return [...picked];
}

const results: Result[] = [];
const started = Date.now();
const progress = () => {
  const line = `${results.length}/${bots} bots done, ${Math.round((Date.now() - started) / 1000)} s`;
  if (verbose) console.log(`== ${line}`);
  else process.stdout.write(`\r  ${line}`);
};

function worker(share: number[]): Promise<void> {
  return new Promise((done) => {
    const child = spawn(process.execPath, [resolve('node_modules/vite-node/vite-node.mjs'), 'tests/bots/play.ts'], {
      env: { ...process.env, BOT_SEEDS: share.join(','), BOT_MINUTES: String(minutes) },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let buffered = '';
    child.stdout.on('data', (chunk: Buffer) => {
      buffered += chunk.toString();
      const lines = buffered.split('\n');
      buffered = lines.pop()!;
      for (const line of lines) {
        if (verbose && line.startsWith('LOG ')) {
          const [, seed, at, ...what] = line.split(' ');
          const n = String(seeds.indexOf(Number(seed)) + 1).padStart(String(bots).length); // (its number in this run)
          console.log(`[bot ${n} · seed ${seed.padStart(3)} ${at.padStart(5)}] ${what.join(' ')}`);
        }
        if (!line.startsWith('BOT ')) continue;
        results.push(JSON.parse(line.slice(4)) as Result);
        progress();
      }
    });
    child.on('close', (code) => {
      const missing = share.filter((seed) => !results.some((r) => r.seed === seed));
      for (const seed of missing) results.push({ seed, problems: [{ kind: 'worker died', seed, t: 0, detail: `exit code ${code}` }], counts: { 'worker died': 1 }, stats: null as never, level: 0, money: 0, seconds: 0 });
      done();
    });
  });
}

console.log(`${bots} bots, ${minutes} game minutes each, on ${workers} workers (seeds ${seedList})`);
await Promise.all(Array.from({ length: workers }, (_, w) => worker(seeds.filter((_, i) => i % workers === w))));
process.stdout.write('\n');
results.sort((a, b) => a.seed - b.seed);

// Sums.
const byKind = new Map<string, { count: number; bots: Set<number>; examples: Problem[] }>();
for (const r of results) {
  for (const [kind, count] of Object.entries(r.counts)) {
    const entry = byKind.get(kind) ?? { count: 0, bots: new Set(), examples: [] };
    entry.count += count;
    entry.bots.add(r.seed);
    byKind.set(kind, entry);
  }
  for (const p of r.problems) {
    const entry = byKind.get(p.kind)!;
    if (entry.examples.length < 12) entry.examples.push(p);
  }
}
const played = results.filter((r) => r.stats);
const total = (key: keyof Omit<BotStats, 'goals'>) => played.reduce((sum, r) => sum + r.stats[key], 0);
const doneOf = ['kills', 'deaths', 'levels', 'questsTaken', 'questsDone', 'ales', 'pies', 'meals', 'sleeps', 'trades', 'buildings', 'upstairs', 'benches', 'wishes', 'rolls', 'guards', 'dungeons', 'chests', 'camps', 'pedlars', 'herbalists', 'travellers', 'actions'] as const;
const kinds = [...byKind.entries()].sort((a, b) => b[1].bots.size - a[1].bots.size || b[1].count - a[1].count);

const lines: string[] = [];
lines.push(`# Bots' playtest, ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`, '');
lines.push(`${bots} bots × ${minutes} game minutes (seeds ${seeds.join(', ')}), in ${Math.round((Date.now() - started) / 1000)} s.`, '');
lines.push('## What they did', '', doneOf.map((k) => `${k}: ${total(k)}`).join(' · '), '');
lines.push(`Levels reached: ${played.map((r) => r.level).join(' ')}`, '');
lines.push('## Problems', '');
if (kinds.length === 0) lines.push('None.', '');
for (const [kind, { count, bots: seen, examples }] of kinds) {
  lines.push(`### ${kind}: ${count} times, in ${seen.size} of ${bots} games`, '');
  for (const p of examples) lines.push(`- seed ${p.seed}, ${Math.floor(p.t / 60)}:${String(p.t % 60).padStart(2, '0')} in: ${p.detail}`);
  lines.push('');
}
const dir = resolve('tests/bots/reports');
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
writeFileSync(resolve(dir, `bots-${stamp}.md`), lines.join('\n'));
writeFileSync(resolve(dir, `bots-${stamp}.json`), JSON.stringify(results));
const balanced = played.filter((r) => r.balance).map((r) => ({ seed: r.seed, balance: r.balance!, goals: r.stats.goals }));
if (balanced.length > 0) writeFileSync(resolve(dir, `balance-${stamp}.md`), balanceReport(balanced, minutes));

console.log(`\n${doneOf.map((k) => `${k} ${total(k)}`).join(', ')}`);
if (kinds.length === 0) console.log('\nNo problems.');
for (const [kind, { count, bots: seen, examples }] of kinds) console.log(`\n${kind}: ${count} times, in ${seen.size} games — e.g. seed ${examples[0]?.seed} at ${examples[0]?.t} s: ${examples[0]?.detail}`);
console.log(`\nReport: tests/bots/reports/bots-${stamp}.md (balance: balance-${stamp}.md)`);
if (kinds.length > 0) console.log(`To watch one of those games again: BOT_SEEDS=${kinds[0][1].examples[0]?.seed} npm run bots:verbose`);
process.exitCode = kinds.length > 0 ? 1 : 0;

// What a pleasure worker's clients say (model/jobs/roomLines.ts, roomTrouble.ts), counted over many shifts worked by a man and by a
// woman, every tone taken and every way with trouble tried: which lines are said most, which least, which never
// (printed: run with `npx vitest run tests/roomLines.test.ts`). Every line written can be said; none is said out of
// all proportion to the others of its kind; a man's are said by men alone, a woman's by women; and no two shifts
// bring the same people saying the same things.
import { describe, expect, it } from 'vitest';
import { comeIn, goUp, seeOut, startShift } from './support/roomWork';
import { fresh } from './support/testWorld'; // (first: the game's own order of loading)
import type { GameModel } from '../src/model/GameModel';
import { maxEnergyOf, maxHpOf } from '../src/model/hero/attributes';
import { FLAT, TEMPERS, TEMPER_IDS } from '../src/model/jobs/room/roomLines';
import { BOUNCER, GIVES_IN, TROUBLE } from '../src/model/jobs/room/roomTrouble';
import type { RoomShift } from '../src/model/jobs/room/roomShift';

const CLIENTS = 12_000; // seen to, in all (half by a man, half by a woman)
const A_SHIFT = 12; // clients a shift, before another's begun

// Every line written, by where it's said.
const POOLS = new Map<string, readonly string[]>([['after, not to their taste', FLAT], ['giving in', GIVES_IN], ['the bouncer called', BOUNCER]]);
const ONLY = new Map<string, 'male' | 'female'>(); // a line a man alone says, or a woman alone
for (const id of TEMPER_IDS) {
  for (const of of ['knocks', 'inside', 'after'] as const) {
    POOLS.set(`${id}, ${of}`, TEMPERS[id][of]);
    for (const sex of ['male', 'female'] as const) {
      POOLS.set(`${id}, ${of}, a ${sex === 'male' ? "man's" : "woman's"}`, TEMPERS[id][sex][of]);
      for (const line of TEMPERS[id][sex][of]) ONLY.set(line, sex);
    }
  }
}
for (const [kind, t] of Object.entries(TROUBLE)) for (const of of ['knocks', 'inside', 'after', 'holds'] as const) POOLS.set(`${kind}, ${of}`, t[of]);

// A shift begun at the first inn, the hero in the room, its door shut.
const begin = (model: GameModel): RoomShift => {
  const shift = startShift(model);
  goUp(model);
  return shift;
};

describe("a pleasure worker's clients", () => {
  it('say every line written, none out of all proportion; who says what counted', () => {
    const said = new Map<string, number>();
    const first: string[][] = []; // each shift's first few knocks, to tell shifts apart
    const hear = (line: string, build: 'male' | 'female') => {
      said.set(line, (said.get(line) ?? 0) + 1);
      const only = ONLY.get(line);
      if (only) expect(build, line).toBe(only); // (a man's by a man, a woman's by a woman)
    };
    const model = fresh();
    const { hero } = model;
    let seen = 0;
    for (const build of ['male', 'female'] as const) {
      hero.look.build = build; // (their clients: the other sex)
      const theirs = build === 'male' ? 'female' : 'male';
      while (seen < (CLIENTS / 2) * (build === 'male' ? 1 : 2)) {
        const shift = begin(model);
        const knocks: string[] = [];
        for (let n = 0; n < A_SHIFT; n++, seen++) {
          [hero.energy, hero.hp, shift.left] = [maxEnergyOf(hero), maxHpOf(hero), 100];
          for (let t = 0; t < 40 && !shift.client; t++) shift.update([], 1);
          const client = shift.client!;
          expect(client.look.build).toBe(theirs);
          const met = model.work.meet()!;
          hear(met.talk.lines[0], theirs);
          knocks.push(met.talk.lines[0]);
          const inside = comeIn(model, shift, seen % 3); // (warm, plain, teasing, in turn)
          hear(inside.lines[0], theirs);
          const after = inside.pace!.done(seen % 2 ? 0.9 : 0.2); // (their pace well kept, or hardly, in turn)
          for (const line of after.lines) hear(line, theirs);
          const answer = after.answers[Math.floor(seen / 3) % after.answers.length]; // (with trouble: insisted, the bouncer, let go, in turn)
          const last = answer.pick();
          if (last) for (const line of last.lines) hear(line, theirs);
          seeOut(shift);
        }
        first.push(knocks.slice(0, 4));
        model.work.end(true);
        model.inside = null;
        model.minutes += 7 * 60 + seen; // (another day, another hour)
      }
    }

    // The count, told: the most said, the least, and those never said.
    const all = [...POOLS].flatMap(([pool, lines]) => lines.map((line) => ({ pool, line, times: said.get(line) ?? 0 })));
    const byTimes = [...all].sort((a, b) => b.times - a.times);
    const show = (rows: typeof all) => rows.map((r) => `  ${String(r.times).padStart(5)}  [${r.pool}]  ${r.line}`).join('\n');
    const never = all.filter((r) => r.times === 0);
    console.log(
      [
        `${seen} clients seen to, ${all.length} lines written, ${[...said.values()].reduce((a, b) => a + b, 0)} lines said.`,
        `\nSaid the most:\n${show(byTimes.slice(0, 15))}`,
        `\nSaid the least:\n${show(byTimes.filter((r) => r.times > 0).slice(-15))}`,
        `\nNever said: ${never.length ? `\n${show(never)}` : 'none'}`,
        `\nBy where it's said (lines, times each is said: least, mean, most):\n${[...POOLS]
          .filter(([, lines]) => lines.length)
          .map(([pool, lines]) => {
            const times = lines.map((l) => said.get(l) ?? 0);
            return `  ${pool.padEnd(34)} ${String(lines.length).padStart(3)} lines  ${String(Math.min(...times)).padStart(5)} ${String(Math.round(times.reduce((a, b) => a + b, 0) / times.length)).padStart(5)} ${String(Math.max(...times)).padStart(5)}`;
          })
          .join('\n')}`,
      ].join('\n'),
    );

    expect(never.map((r) => r.line)).toEqual([]); // (every line written can be said)
    expect(new Set(all.map((r) => r.line)).size).toBe(all.length); // (none written twice)
    // Within a pool, each line has its fair share: none said three times as often as another (where there's enough said to tell).
    for (const [pool, lines] of POOLS) {
      const times = lines.map((l) => said.get(l) ?? 0);
      if (times.length < 2 || Math.min(...times) < 40) continue;
      expect(Math.max(...times) / Math.min(...times), pool).toBeLessThan(3);
    }
    // No two shifts alike: their first knocks differ from one to the next, nearly always.
    const openings = first.map((k) => k.join('|'));
    expect(new Set(openings).size).toBeGreaterThan(openings.length * 0.9);
  }, 120_000);
});

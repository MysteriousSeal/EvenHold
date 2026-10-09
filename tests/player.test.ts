// The player bot's mind (tests/bots/player/): a persona drawn from the dice, its drives answered by activities scored
// and drawn; what it learns; every activity honest about what it can do; and a short game played without a hitch.
import { describe, expect, it } from 'vitest';
import { fresh } from './support/testWorld'; // (first: the model loaded before the activities, which reach into it)
import { mulberry32 } from '../src/util/random';
import { ACTIVITIES } from './bots/player/activities';
import { DRIVES, Memory, TRAITS, describe as describePersona, draw, drawPersona, score, type Drive } from './bots/player/persona';
import { Player } from './bots/player/player';

const flat = Object.fromEntries(DRIVES.map((d) => [d, 0.5])) as Record<Drive, number>;

describe("a player's persona", () => {
  it('is drawn from the dice: every trait 0..1, one standing out, the same again from the same seed, told in words', () => {
    const a = drawPersona(mulberry32(7));
    const b = drawPersona(mulberry32(7));
    expect(a).toEqual(b);
    for (const t of TRAITS) expect(a.traits[t] >= 0 && a.traits[t] <= 1, t).toBe(true);
    expect(Math.max(...TRAITS.map((t) => a.traits[t]))).toBeGreaterThanOrEqual(0.5);
    expect(describePersona(a)).toMatch(/ and /);
    expect(drawPersona(mulberry32(8))).not.toEqual(a);
  });

  it('scores an activity by the drives it answers, nearer better, done lately worse; draws the best nearly always when set in its ways', () => {
    const persona = drawPersona(mulberry32(1));
    const memory = new Memory();
    const options = [
      { id: 'coin', serves: { coin: 1 }, distance: 0 },
      { id: 'nothing', serves: {}, distance: 0 },
      { id: 'coinFar', serves: { coin: 1 }, distance: 240 },
    ];
    const drives = { ...flat, coin: 1 };
    const scored = score(options, drives, persona, memory, 0);
    const of = (id: string) => scored.find((s) => s.option.id === id)!.score;
    expect(of('coin')).toBeGreaterThan(of('coinFar'));
    expect(of('coinFar')).toBeGreaterThan(of('nothing'));
    memory.began('coin', 0);
    memory.began('coin', 1);
    expect(score(options, drives, persona, memory, 2).find((s) => s.option.id === 'coin')!.score).toBeLessThan(of('coin'));
    const rng = mulberry32(3);
    const picks = Array.from({ length: 50 }, () => draw(scored, 0.02, rng).option.id);
    expect(picks.filter((id) => id === 'coin').length).toBeGreaterThan(45);
  });

  it('learns: a running mean of what each activity brought, the last few counting most', () => {
    const memory = new Memory();
    memory.reward('work', 2);
    expect(memory.learnt.get('work')).toEqual({ n: 1, mean: 2 });
    memory.reward('work', 0);
    expect(memory.learnt.get('work')!.mean).toBe(1);
    for (let i = 0; i < 20; i++) memory.reward('work', -1);
    expect(memory.learnt.get('work')!.mean).toBeLessThan(-0.8);
    expect(memory.lately('work', 0)).toBe(0);
  });
});

describe("a player's activities", () => {
  it('are each one of a kind, and honest about what they can do on a fresh world (a list, each target labelled and its steps a list)', () => {
    const ids = ACTIVITIES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    const model = fresh();
    const player = new Player(model, () => {}, mulberry32(5), () => {});
    for (const activity of ACTIVITIES) {
      const targets = activity.options(player.kit);
      expect(Array.isArray(targets), activity.id).toBe(true);
      for (const target of targets) {
        expect(typeof target.label === 'string' && target.label.length > 0, activity.id).toBe(true);
        expect(Array.isArray(activity.steps(player.kit, target)), activity.id).toBe(true);
      }
    }
  });
});

describe('a player at play', () => {
  it('plays two game minutes of a fresh world without a hitch, choosing, doing and writing it up', () => {
    const model = fresh();
    const problems: string[] = [];
    const said: string[] = [];
    const player = new Player(model, (kind, detail) => problems.push(`${kind}: ${detail}`), mulberry32(11), (what) => said.push(what));
    let second = 0;
    for (let t = 0; t < 120; t += 1 / 30) {
      player.tick(1 / 30);
      if ((second += 1 / 30) >= 1) [player.balance.sample(t, player.stats), player.observe(t), (second = 0)];
    }
    player.close();
    expect(problems.filter((p) => p.startsWith('crash'))).toEqual([]);
    expect(player.diary.length).toBeGreaterThan(0);
    expect(said[0]).toMatch(/^a new player: /);
    expect(said.some((s) => s.startsWith('→ '))).toBe(true);
    expect(player.memory.learnt.size).toBeGreaterThan(0);
  });
});

describe('a QA sweep', () => {
  it('pulls whatever is untried, keeps a coverage of every activity, and says what never once worked', () => {
    const model = fresh();
    const problems: string[] = [];
    const player = new Player(model, (kind, detail) => problems.push(`${kind}: ${detail}`), mulberry32(13), () => {}, { sweep: true });
    expect(player.sweep).toBe(true);
    let second = 0;
    for (let t = 0; t < 180; t += 1 / 30) {
      player.tick(1 / 30);
      if ((second += 1 / 30) >= 1) [player.balance.sample(t, player.stats), player.observe(t), (second = 0)];
    }
    player.close();
    const coverage = player.coverage();
    expect(coverage.map((c) => c.id)).toEqual(ACTIVITIES.map((a) => a.id));
    for (const c of coverage) expect(c.tried >= c.done && c.offered >= (c.tried > 0 ? 1 : 0), c.id).toBe(true);
    expect(new Set(player.diary.map((d) => d.id)).size).toBeGreaterThan(2); // (the sweep: not the same thing over and over)
    expect(problems.filter((p) => p.startsWith('crash'))).toEqual([]);
  });
});

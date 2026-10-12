// The game of keeping a client's pace (model/jobs/room/pace.ts): a marker crossing a track once a beat, pressed as
// it passes the middle; well kept, nearly, or missed; each temper its own pace; the tone to their taste the easier.
import { describe, expect, it } from 'vitest';
import { PACES, PaceRun, PaceSaid, paceOf, played, type PaceVoice } from '../src/model/jobs/room/pace';
import { HOUR, STREAK, goodOf, risingOf } from '../src/model/jobs/room/roomHour';

describe("keeping someone's pace", () => {
  it('scores each beat by how near its middle it was pressed: kept, nearly, missed', () => {
    const pace = paceOf('blunt');
    expect(played(pace, 0)).toBe(1); // (every beat on its middle)
    expect(played(pace, pace.band * 0.9)).toBe(1);
    expect(played(pace, pace.band * 1.5)).toBeCloseTo(0.5, 9); // (nearly, every time)
    expect(played(pace, pace.band * 2.5)).toBe(0);
    expect(played(pace, -pace.band * 1.5)).toBeCloseTo(0.5, 9); // (early as late)
  });

  it('counts one press a beat, and a beat left unpressed as missed', () => {
    const run = new PaceRun({ periods: [1, 1, 1, 1], band: 0.1 });
    run.update(0.5);
    expect(run.at).toBeCloseTo(0.5, 9);
    expect(run.press()).toBe(1);
    expect(run.press()).toBeNull(); // (once a beat)
    run.update(0.5); // (the first beat over)
    expect(run.beat).toBe(1);
    run.update(1); // (the second, unpressed)
    expect(run.marks).toEqual([1, 0]);
    run.update(0.05);
    expect(run.press()).toBe(0); // (far too early: missed, and that's this beat's press)
    run.update(0.95 + 0.62);
    expect(run.press()).toBe(0.5); // (nearly)
    run.update(5); // (well past the end, in one go)
    expect(run.done).toBe(true);
    expect(run.marks).toEqual([1, 0, 0, 0.5]);
    expect(run.score).toBeCloseTo(1.5 / 4, 9);
    expect(run.press()).toBeNull();
    expect(run.at).toBe(0);
  });

  it("gives each temper, and each kind of trouble, a pace of its own; a tone to their taste widens what's kept", () => {
    const length = (who: keyof typeof PACES) => PACES[who].reduce((a, b) => a + b, 0);
    for (const who of Object.keys(PACES) as Array<keyof typeof PACES>) {
      expect(PACES[who].length, who).toBeGreaterThanOrEqual(8);
      expect(length(who), who).toBeGreaterThan(8); // (seconds: long enough to be a game)
      expect(length(who), who).toBeLessThan(16); // (and not a chore)
      expect(Math.min(...PACES[who]), who).toBeGreaterThanOrEqual(0.55); // (no beat too quick to press)
    }
    expect(PACES.shy[0]).toBeGreaterThan(PACES.blunt[0]); // (slow, and quick)
    expect(new Set(PACES.bold).size).toBeGreaterThan(2); // (changing)
    expect(new Set(PACES.merry).size).toBe(2); // (lilting: short, long)
    expect(new Set(Object.values(PACES).map((p) => p.join())).size).toBe(Object.keys(PACES).length);
    const [liked, plain, disliked] = [paceOf('shy', 'liked'), paceOf('shy'), paceOf('shy', 'disliked')];
    expect(liked.band).toBeGreaterThan(plain.band);
    expect(disliked.band).toBeLessThan(plain.band);
    expect(liked.band * 2).toBeLessThan(0.5); // (never the whole beat: there's always a miss to be had)
    // The same hand, a little off the beat: kept for one who liked the tone, only nearly for one who didn't.
    const off = plain.band * 1.2;
    expect(played(liked, off)).toBe(1);
    expect(played(disliked, off)).toBeCloseTo(0.5, 9);
  });

  it('has them speak as it goes: the more pleased level by level, the pace lost now and then, a good run, a last word', () => {
    const voice: PaceVoice = { rising: (level) => `rising ${level}`, badly: () => 'badly', streak: () => 'streak', finish: (score) => `finish ${score >= 0.55 ? 'good' : 'poor'}` };
    // Every beat kept: each level said as it's passed (in order, none twice), a run between, then the good end.
    const pace = { periods: Array.from({ length: 10 }, () => 1), band: 0.1 };
    const run = new PaceRun(pace);
    const said = new PaceSaid(run, voice);
    const heard: string[] = [];
    const hear = () => {
      const line = said.next();
      if (line) heard.push(line);
    };
    expect(said.next()).toBeNull(); // (nothing yet)
    for (let beat = 0; beat < 10; beat++) {
      run.update(0.5);
      run.press();
      hear();
      hear(); // (asked again with nothing new: nothing said twice)
      run.update(0.5);
      hear();
    }
    expect(heard.filter((l) => l.startsWith('rising'))).toEqual(['rising 0', 'rising 1', 'rising 2', 'rising 3']);
    expect(heard.at(-1)).toBe('finish good');
    expect(heard.filter((l) => l.startsWith('finish'))).toHaveLength(1);
    expect(heard).not.toContain('badly');
    // Every beat missed: the pace lost said, but not on every beat; nothing of their pleasure; the poor end.
    const lost = new PaceRun(pace);
    const sorry = new PaceSaid(lost, voice);
    const moans: string[] = [];
    for (let beat = 0; beat < 10; beat++) {
      lost.update(1);
      const line = sorry.next();
      if (line) moans.push(line);
    }
    expect(moans.filter((l) => l === 'badly').length).toBeGreaterThanOrEqual(2);
    expect(moans.filter((l) => l === 'badly').length).toBeLessThanOrEqual(4);
    expect(moans.some((l) => l.startsWith('rising'))).toBe(false);
    expect(moans.at(-1)).toBe('finish poor');
    // Four kept running, the level not yet passed: a word of it.
    const long = new PaceRun({ periods: Array.from({ length: 40 }, () => 1), band: 0.1 });
    const pleased = new PaceSaid(long, voice);
    const words: string[] = [];
    for (let beat = 0; beat < 4; beat++) {
      long.update(0.5);
      long.press();
      const line = pleased.next();
      if (line) words.push(line);
      long.update(0.5);
    }
    expect(words).toEqual(['streak']);
  });

  it('has words for each temper and each trouble at every turn of it, a man\'s and a woman\'s kept apart', () => {
    const named = /\b(cock|balls|pussy|cunt|tits|wife|husband)\b/i;
    const lines: string[] = [...STREAK];
    for (const who of Object.keys(PACES) as Array<keyof typeof PACES>) {
      const said = HOUR[who];
      expect(said.rising).toHaveLength(4);
      for (const level of said.rising) expect(level.length, who).toBeGreaterThanOrEqual(2);
      for (const pool of [said.badly, said.good, said.poor]) expect(pool.length, who).toBeGreaterThanOrEqual(2);
      const either = [...said.rising.flat(), ...said.badly, ...said.good, ...said.poor];
      for (const line of either) expect(line, line).not.toMatch(named); // (what a man or a woman alike may say)
      lines.push(...either, ...Object.values(said.male.rising ?? {}).flatMap((l) => l ?? []), ...Object.values(said.female.rising ?? {}).flatMap((l) => l ?? []), ...(said.male.good ?? []), ...(said.female.good ?? []));
      for (const sex of ['male', 'female'] as const) for (let level = 0; level < 4; level++) expect(risingOf(who, sex, level).length).toBeGreaterThanOrEqual(2);
      expect(goodOf(who, 'male').length).toBeGreaterThanOrEqual(said.good.length);
    }
    expect(risingOf('bold', 'male', 2).length).toBeGreaterThan(HOUR.bold.rising[2].length); // (his own, with the rest)
    expect(risingOf('bold', 'female', 2)).not.toEqual(risingOf('bold', 'male', 2));
    expect(new Set(lines).size).toBe(lines.length); // (none twice)
    for (const line of lines) expect(line, line).toMatch(/^[A-Z].*[.!?]$/);
    expect(lines.length).toBeGreaterThan(120);
  });
});

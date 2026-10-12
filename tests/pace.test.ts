// The game of keeping a client's pace (model/jobs/room/pace.ts): a marker crossing a track once a beat, pressed as
// it passes the middle; well kept, nearly, or missed; each temper its own pace; the tone to their taste the easier.
import { describe, expect, it } from 'vitest';
import { PACES, PaceRun, paceOf, played } from '../src/model/jobs/room/pace';

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
});

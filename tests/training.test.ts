import { describe, expect, it } from 'vitest';
import { gainXp, xpToNext } from '../src/model/hero/heroStats';
import { POINTS_PER_LEVEL, refundPoints, spendPoints } from '../src/model/hero/training';
import { statsOf } from '../src/model/hero/attributes';
import { parseSave, restore, snapshot } from '../src/model/save';
import { fresh } from './support/testWorld';

describe('stat points', () => {
  it('come with each level gained, none at the start', () => {
    const model = fresh();
    expect(model.hero.statPoints).toBe(0);
    gainXp(model.hero, xpToNext(1) + xpToNext(2)); // two levels at once
    expect([model.hero.level, model.hero.statPoints]).toEqual([3, 2 * POINTS_PER_LEVEL]);
  });

  it('are spent as planned, all at once, never more than there are', () => {
    const { hero } = fresh();
    hero.statPoints = 3;
    expect(spendPoints(hero, { strength: 2, agility: 2 })).toBe(false); // 4 of 3
    expect(spendPoints(hero, { strength: -1, agility: 2 })).toBe(false);
    expect(spendPoints(hero, {})).toBe(false);
    expect(spendPoints(hero, { strength: 2, stamina: 1 })).toBe(true);
    expect(hero.statPoints).toBe(0);
    expect(statsOf(hero)).toEqual({ strength: 2, agility: 0, stamina: 1, endurance: 0 });
    refundPoints(hero); // (a cheat)
    expect([hero.statPoints, statsOf(hero).strength]).toEqual([3, 0]);
  });

  it('show on the floating text once, when the level is gained', () => {
    const model = fresh();
    model.takeEvents(); // (what the hero is at the start isn't news)
    gainXp(model.hero, xpToNext(1));
    expect(model.takeEvents().filter((e) => e.kind === 'levelUp')).toEqual([{ kind: 'levelUp', level: 2, points: POINTS_PER_LEVEL }]);
    expect(model.takeEvents().some((e) => e.kind === 'levelUp')).toBe(false);
  });

  it("are kept in a save; a save from before them gets all its levels' to spend", () => {
    const model = fresh();
    Object.assign(model.hero, { level: 9, statPoints: 2 });
    model.hero.trained.agility = 6; // 8 in all: level 9's
    const again = fresh();
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect([again.hero.statPoints, again.hero.trained.agility]).toEqual([2, 6]);
    // Older: no points in it at all.
    const data = JSON.parse(JSON.stringify(snapshot(model)));
    delete data.hero.statPoints;
    delete data.hero.trained;
    const old = fresh();
    restore(old, parseSave(JSON.stringify(data), model.seed)!);
    expect([old.hero.statPoints, old.hero.trained.agility]).toEqual([8 * POINTS_PER_LEVEL, 0]);
  });

  it("are never more on loading than the hero's levels have earned", () => {
    const load = (level: number, statPoints: number, agility: number) => {
      const model = fresh();
      Object.assign(model.hero, { level, statPoints });
      model.hero.trained.agility = agility;
      const again = fresh();
      restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
      return [again.hero.statPoints, again.hero.trained.agility];
    };
    const earned = 8 * POINTS_PER_LEVEL; // at level 9
    expect(load(9, 24, 0)).toEqual([earned, 0]); // (saved when levels gave 3 each)
    expect(load(9, 20, 2)).toEqual([earned - 2, 2]); // what's unspent, cut to fit
    expect(load(9, 0, 30)).toEqual([earned, 0]); // spent more than earned: all back to spend
    expect(load(9, 1, 2)).toEqual([1, 2]); // within: as saved
  });
});

import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { BLESSING_TIME, WELL_TOSS, blessAll, blowDamage, coinsFound, hitTaken, walkFactor } from '../src/model/hero/blessing';
import { parseSave, restore, snapshot } from '../src/model/save';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const fresh = () => new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
// The hero beside the first village's well (on an open tile next to it).
const atWell = (model: GameModel) => {
  const v = model.villages[0];
  const [dx, dz] = [[1, 0], [0, 1], [-1, 0], [0, -1]].find(([dx, dz]) => model.isOpenTile(v.x + dx, v.z + dz))!;
  model.teleport(v.x + dx, v.z + dz);
};

describe("a well's blessing", () => {
  it('is had for a silver coin, beside a well only', () => {
    const model = fresh();
    model.hero.money = WELL_TOSS * 2;
    expect(model.tossCoin(0)).toBeNull(); // no well near
    atWell(model);
    expect(model.wellInReach).toBe(0);
    expect(model.tossCoin(0)).toBe('swift');
    expect(model.hero.money).toBe(WELL_TOSS);
    expect(model.tossCoin(0.99)).toBe('lucky'); // tossing again rerolls it
    expect(model.hero.blessings).toEqual([{ kind: 'lucky', left: BLESSING_TIME }]); // the one
    expect(model.tossCoin(0.5)).toBeNull(); // no silver left
    expect(model.takeEvents().map((e) => e.kind)).toEqual(['poor', 'blessing', 'blessing', 'poor']);
  });

  it('does what it says, for half an hour of play', () => {
    const model = fresh();
    const { hero } = model;
    hero.blessings = [{ kind: 'swift', left: BLESSING_TIME }];
    expect(walkFactor(hero)).toBeGreaterThan(1);
    hero.blessings = [{ kind: 'strong', left: BLESSING_TIME }];
    expect(blowDamage(hero, 1)).toBe(2);
    hero.blessings = [{ kind: 'tough', left: BLESSING_TIME }];
    expect([hitTaken(hero, 3), hitTaken(hero, 1)]).toEqual([2, 1]); // never below one
    hero.blessings = [{ kind: 'lucky', left: 2 }];
    expect(coinsFound(hero, 10)).toBe(15);
    model.update(0, 0, 1);
    model.update(0, 0, 1.5);
    expect(hero.blessings).toEqual([]); // worn off
    expect(coinsFound(hero, 10)).toBe(10);
  });

  it('all at once, by a cheat, each doing its part; a toss at a well then leaves just the one', () => {
    const model = fresh();
    blessAll(model.hero);
    expect(model.hero.blessings).toHaveLength(4);
    expect([walkFactor(model.hero) > 1, blowDamage(model.hero, 1), hitTaken(model.hero, 3), coinsFound(model.hero, 10)]).toEqual([true, 2, 2, 15]);
    atWell(model);
    model.hero.money = WELL_TOSS;
    model.tossCoin(0);
    expect(model.hero.blessings).toEqual([{ kind: 'swift', left: BLESSING_TIME }]);
  });

  it('is kept in a save', () => {
    const model = fresh();
    model.hero.blessings = [{ kind: 'tough', left: 600 }, { kind: 'swift', left: 30 }];
    const again = fresh();
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(again.hero.blessings).toEqual([{ kind: 'tough', left: 600 }, { kind: 'swift', left: 30 }]);
  });
});

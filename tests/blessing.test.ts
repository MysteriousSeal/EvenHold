import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { ENEMY_STATS } from '../src/model/constants';
import { stepEnemy } from '../src/model/enemies/enemies';
import { maxHpAt } from '../src/model/hero/heroStats';
import { blessAll, BLESSING_TIME, blowDamage, coinsFound, dropFactor, healOnKill, hitTaken, noticeFactor, tickBlessing, tossCoin, walkFactor, WEARY_TIME, wearyAfterFall, WELL_TOSS, xpGained } from '../src/model/hero/blessing';
import { parseSave, restore, snapshot } from '../src/model/save';
import { fresh, eachSeed } from './support/testWorld';

// The hero beside the first village's well (on an open tile next to it).
const atWell = (model: GameModel) => {
  const v = model.villages[0];
  const [dx, dz] = [[1, 0], [0, 1], [-1, 0], [0, -1]].find(([dx, dz]) => model.isOpenTile(v.x + dx, v.z + dz))!;
  model.teleport(v.x + dx, v.z + dz);
};

describe("a well's blessing", () => {
  it('is had for a silver coin, beside a well only', () => {
    eachSeed((model) => {
      model.hero.money = WELL_TOSS * 2;
      expect(model.tossCoin(0)).toBeNull(); // no well near
      atWell(model);
      expect(model.wellInReach).toBe(0);
      expect(model.tossCoin(0)).toBe('swift');
      expect(model.hero.money).toBe(WELL_TOSS);
      expect(model.tossCoin(0.99)).toBe('keen'); // tossing again rerolls it
      expect(model.hero.blessings).toEqual([{ kind: 'keen', left: BLESSING_TIME }]); // the one
      expect(model.tossCoin(0.5)).toBeNull(); // no silver left
      expect(model.takeEvents().map((e) => e.kind)).toEqual(['poor', 'blessing', 'blessing', 'poor']);
    });
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
    expect(model.hero.blessings).toHaveLength(8);
    expect([walkFactor(model.hero) > 1, blowDamage(model.hero, 1), hitTaken(model.hero, 3), coinsFound(model.hero, 10)]).toEqual([true, 2, 2, 15]);
    atWell(model);
    model.hero.money = WELL_TOSS;
    model.tossCoin(0);
    expect(model.hero.blessings).toEqual([{ kind: 'swift', left: BLESSING_TIME }]);
  });

  it('the other four: more experience, unnoticed longer, health back from each kill, more drops', () => {
    const model = fresh();
    const { hero } = model;
    hero.blessings = [{ kind: 'wise', left: BLESSING_TIME }];
    expect(xpGained(hero, 20)).toBe(25);
    hero.blessings = [{ kind: 'quiet', left: BLESSING_TIME }];
    expect(noticeFactor(hero)).toBe(0.5);
    hero.blessings = [{ kind: 'second', left: BLESSING_TIME }];
    hero.hp = 3;
    healOnKill(hero);
    expect(hero.hp).toBe(4);
    hero.hp = maxHpAt(hero.level);
    healOnKill(hero);
    expect(hero.hp).toBe(maxHpAt(hero.level)); // never past the most
    hero.blessings = [{ kind: 'keen', left: BLESSING_TIME }];
    expect(dropFactor(hero)).toBe(1.5);
  });

  it('Quiet step: a wolf in plain sight lets the hero come closer before it notices', () => {
    const model = fresh();
    const wolf = model.enemies.find((e) => e.kind === 'wolf')!;
    const seenAt = ENEMY_STATS.wolf.sight * 0.8; // seen from here, normally
    const actions = { move: () => true, steer: (_e: unknown, to: { x: number; z: number }) => to, sees: () => true, strike: () => {} }; // in plain sight
    stepEnemy(wolf, { x: wolf.x + seenAt, z: wolf.z }, 0.05, actions);
    expect(wolf.state).toBe('chase');
    wolf.state = 'wander';
    stepEnemy(wolf, { x: wolf.x + seenAt, z: wolf.z, blessings: [{ kind: 'quiet', left: 60 }] }, 0.05, actions);
    expect(wolf.state).toBe('wander');
  });

  it('is kept in a save', () => {
    const model = fresh();
    model.hero.blessings = [{ kind: 'tough', left: 600 }, { kind: 'swift', left: 30 }];
    const again = fresh();
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(again.hero.blessings).toEqual([{ kind: 'tough', left: 600 }, { kind: 'swift', left: 30 }]);
  });
});

describe('a fall\'s Weary', () => {
  it('weakens the hero for a while: blows 1 less, hits on them 1 more (never under 1)', () => {
    const hero = fresh().hero;
    wearyAfterFall(hero);
    expect(hero.blessings).toEqual([{ kind: 'weary', left: WEARY_TIME }]);
    expect(blowDamage(hero, 3)).toBe(2);
    expect(blowDamage(hero, 1)).toBe(1);
    expect(hitTaken(hero, 2)).toBe(3);
    tickBlessing(hero, WEARY_TIME);
    expect(hero.blessings).toEqual([]);
    expect(blowDamage(hero, 3)).toBe(3);
  });

  it('is never a well\'s, and a well\'s blessing doesn\'t wash it away', () => {
    const hero = fresh().hero;
    wearyAfterFall(hero);
    for (let i = 0; i < 40; i++) {
      hero.money = WELL_TOSS;
      expect(tossCoin(hero, i / 40)).not.toBe('weary');
      expect(hero.blessings?.some((b) => b.kind === 'weary')).toBe(true);
      expect(hero.blessings?.length).toBe(2);
    }
  });
});

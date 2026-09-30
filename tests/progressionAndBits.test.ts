// The numbers of growing stronger (experience, health, levels of foes) at
// every level; and the small pieces of play: hopping up and down the ground,
// loot and coins lying about, what villagers say.
import { describe, expect, it } from 'vitest';
import { gainXp, maxHpAt, xpAgainst, xpToNext } from '../src/model/hero/heroStats';
import { enemyLevel, enemyPower } from '../src/model/enemies/enemyLevels';
import { ENEMY_STATS, HOP_DURATION, HOP_HEIGHT, TILE_HEIGHT } from '../src/model/constants';
import { POINTS_PER_LEVEL } from '../src/model/hero/training';
import { stepHop } from '../src/model/hero/hop';
import { Ground } from '../src/model/loot/ground';
import { PICKUP_RANGE } from '../src/model/loot/loot';
import { say, takeSpeech } from '../src/model/npcs/speech';
import type { EnemyKind } from '../src/model/types';
import { fresh } from './support/testWorld';

const LEVELS = Array.from({ length: 30 }, (_, i) => i + 1);
const KINDS: EnemyKind[] = ['wolf', 'bandit', 'boar'];

describe.each(LEVELS.map((l) => [l]))('level %i', (level) => {
  it('takes more experience to leave than the one before, and has more health, and a point to spend once reached', () => {
    if (level > 1) {
      expect(xpToNext(level)).toBeGreaterThan(xpToNext(level - 1));
      expect(maxHpAt(level)).toBeGreaterThan(maxHpAt(level - 1));
    }
    const { hero } = fresh();
    let needed = 0;
    for (let l = 1; l < level; l++) needed += xpToNext(l);
    gainXp(hero, needed);
    expect(hero.level).toBe(level);
    expect(hero.statPoints).toBe((level - 1) * POINTS_PER_LEVEL);
    expect(hero.hp).toBe(level > 1 ? maxHpAt(level) : hero.hp);
  });

  it.each(KINDS)('makes a %s tougher, harder hitting and worth more than a level lower', (kind) => {
    const now = enemyPower(kind, level);
    expect(now.maxHp).toBeGreaterThanOrEqual(ENEMY_STATS[kind].hp);
    expect(now.damage).toBeGreaterThanOrEqual(1);
    if (level > 1) {
      const before = enemyPower(kind, level - 1);
      expect(now.maxHp).toBeGreaterThanOrEqual(before.maxHp);
      expect(now.damage).toBeGreaterThanOrEqual(before.damage);
      expect(now.xp).toBeGreaterThan(before.xp);
    }
  });
});

describe('experience against foes', () => {
  it.each([
    [-5, 'a token 1, far below'],
    [-3, 'a token 1, three below'],
    [-2, 'less, below'],
    [0, 'in full, the same level'],
    [2, 'more, above'],
    [5, 'more still, far above'],
  ])('%i levels apart: %s', (gap) => {
    const got = xpAgainst(20, 10 + gap, 10);
    if (gap <= -3) expect(got).toBe(1);
    else if (gap < 0) expect(got).toBeLessThan(20);
    else if (gap === 0) expect(got).toBe(20);
    else expect(got).toBeGreaterThan(20);
  });

  it('never gives nothing', () => {
    for (let gap = -10; gap <= 10; gap++) expect(xpAgainst(1, 10 + gap, 10)).toBeGreaterThanOrEqual(1);
  });

  it('puts tougher foes further from spawn (never under level 1)', () => {
    const spawn = { x: 0, z: 0 };
    let near = 0;
    let far = 0;
    for (let id = 0; id < 50; id++) {
      near += enemyLevel(spawn, 5, 0, id);
      far += enemyLevel(spawn, 500, 0, id);
      expect(enemyLevel(spawn, 0, 0, id)).toBeGreaterThanOrEqual(1);
    }
    expect(far).toBeGreaterThan(near);
  });
});

describe('hopping up and down the ground', () => {
  it('stays put on level ground', () => {
    expect(stepHop(null, 0.3, 0.3, 0.1)).toEqual({ hop: null, y: 0.3 });
  });

  it('arcs up a step, higher than the step halfway, landing on it', () => {
    let { hop, y } = stepHop(null, 0, TILE_HEIGHT, HOP_DURATION / 2);
    expect(y).toBeGreaterThan(TILE_HEIGHT / 2 + HOP_HEIGHT * 0.5);
    ({ hop, y } = stepHop(hop, y, TILE_HEIGHT, HOP_DURATION));
    expect(hop).toBeNull();
    expect(y).toBeCloseTo(TILE_HEIGHT);
  });

  it('eases onto a small rise (paving), without an arc, in half the time', () => {
    const rise = TILE_HEIGHT * 0.5;
    const half = stepHop(null, 0, rise, HOP_DURATION / 4);
    expect(half.y).toBeCloseTo(rise / 2);
    expect(stepHop(half.hop, half.y, rise, HOP_DURATION / 4).hop).toBeNull();
  });

  it('turns mid-hop toward new ground, from where it is', () => {
    const first = stepHop(null, 0, TILE_HEIGHT, HOP_DURATION / 4);
    const turned = stepHop(first.hop, first.y, 0, 0);
    expect(turned.hop?.fromY).toBeCloseTo(first.y);
    expect(turned.hop?.toY).toBe(0);
  });
});

describe('the ground', () => {
  const ground = () => new Ground((x) => x / 10);

  it('lays loot and coins on the ground where they fall, each its own id', () => {
    const g = ground();
    g.drop('wolfFang', 3, 4);
    g.dropCoins(12, 5, 4);
    expect(g.loot[0]).toMatchObject({ item: 'wolfFang', x: 3, z: 4, y: 0.3 });
    expect(g.coins[0]).toMatchObject({ amount: 12, y: 0.5 });
    expect(g.loot[0].id).not.toBe(g.coins[0].id);
  });

  it('finds the nearest loot within reach, and none further', () => {
    const g = ground();
    g.drop('wolfFang', 0, 0);
    g.drop('boarTusk', 0.3, 0);
    expect(g.nearest(0.4, 0)?.item).toBe('boarTusk');
    expect(g.nearest(PICKUP_RANGE + 1, 0)).toBeNull();
  });

  it('takes loot off the ground', () => {
    const g = ground();
    g.drop('wolfFang', 0, 0);
    g.take(g.loot[0]);
    expect(g.loot).toEqual([]);
  });

  it('scoops up only the coins near, and all of them there', () => {
    const g = ground();
    g.dropCoins(5, 0, 0);
    g.dropCoins(7, 0.2, 0);
    g.dropCoins(100, 20, 0);
    expect(g.scoop(0, 0)).toBe(12);
    expect(g.coins.map((c) => c.amount)).toEqual([100]);
    expect(g.scoop(0, 0)).toBe(0);
  });
});

describe('what villagers say', () => {
  it('is heard once, where they are, in the order said', () => {
    takeSpeech();
    const [a, b] = fresh().npcs;
    say(a, 'Morning!');
    say(b, 'Lovely day.');
    expect(takeSpeech()).toEqual([
      { kind: 'say', speaker: a, where: a.where, text: 'Morning!' },
      { kind: 'say', speaker: b, where: b.where, text: 'Lovely day.' },
    ]);
    expect(takeSpeech()).toEqual([]);
  });
});

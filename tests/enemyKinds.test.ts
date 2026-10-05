// Every kind of foe, whole: its stats (model/constants.ts), something its
// family drops (model/loot: junk, ingredients), and how it's shown
// (view/meshes/enemy/enemyKinds.ts: its name, its size, its aura, how high a
// hit's number floats over it). A new kind missing any of them fails here.
import { describe, expect, it } from 'vitest';
import { ENEMY_STATS } from '../src/model/constants';
import { rollDrop } from '../src/model/loot/loot';
import { INGREDIENTS } from '../src/model/loot/ingredients';
import { KIND_LOOKS } from '../src/view/meshes/enemy/enemyKinds';
import type { EnemyKind } from '../src/model/types';

const kinds = Object.keys(ENEMY_STATS) as EnemyKind[];

describe('every kind of foe', () => {
  it('drops something of its family\'s (the wild beasts, cooking ingredients among it)', () => {
    for (const kind of kinds) {
      const family = ENEMY_STATS[kind].family;
      const drops = new Set(Array.from({ length: 200 }, (_, i) => rollDrop(family, i, 1)));
      expect(drops.has(null), kind).toBe(false);
    }
    for (const family of ['beast', 'boar', 'bear', 'lynx'] as const) {
      expect(Array.from({ length: 300 }, (_, i) => rollDrop(family, i, 1)).some((id) => id! in INGREDIENTS), family).toBe(true);
    }
  });

  it('is shown: a name, a size, an aura, a height for its hits\' numbers', () => {
    for (const kind of kinds) {
      const look = KIND_LOOKS[kind];
      expect(look.name.length, kind).toBeGreaterThan(2);
      expect(look.size, kind).toBeGreaterThan(0);
      expect(look.aura, kind).toBeGreaterThan(10);
      expect(look.textHeight, kind).toBeGreaterThan(0);
    }
    expect(Object.keys(KIND_LOOKS).sort()).toEqual([...kinds].sort());
  });
});

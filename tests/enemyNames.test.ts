// What foes are called (over their heads, in the target panel): one name for each kind, unless their own.

import { describe, expect, it } from 'vitest';
import { enemyName } from '../src/view/meshes/enemy/enemyParts';
import { ENEMY_STATS } from '../src/model/constants';
import type { EnemyKind } from '../src/model/types';

describe('foes\' names', () => {
  it('every kind has its own, a crypt lord\'s own name over it', () => {
    const kinds = Object.keys(ENEMY_STATS) as EnemyKind[];
    const names = kinds.map((kind) => enemyName({ kind }));
    expect(names.every((n) => n.length > 0)).toBe(true);
    expect(new Set(names).size).toBe(kinds.length);
    expect(enemyName({ kind: 'ghost' })).toBe('Ghost');
    expect(enemyName({ kind: 'cryptLord', name: 'Aldric the Pale' })).toBe('Aldric the Pale');
  });
});

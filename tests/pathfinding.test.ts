import { describe, expect, it } from 'vitest';
import { findPath } from '../src/model/pathfinding';
import { GameModel } from '../src/model/GameModel';
import { ENEMY_STATS } from '../src/model/constants';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

// A wall along x = 5 up to z = 9, with a gap at z = 7.
const wall = (x: number, z: number) => !(Math.abs(x - 5) < 0.5 && z <= 9.5 && Math.round(z) !== 7);

describe('findPath', () => {
  it('goes round a wall through its gap, one tile at a time, never cutting corners', () => {
    const path = findPath({ x: 2, z: 2 }, { x: 8, z: 2 }, 20, wall);
    expect(path[path.length - 1]).toEqual({ x: 8, z: 2 });
    expect(path.some((p) => p.x === 5 && p.z === 7)).toBe(true);
    let prev = { x: 2, z: 2 };
    for (const p of path) {
      expect(Math.max(Math.abs(p.x - prev.x), Math.abs(p.z - prev.z))).toBe(1);
      expect(wall(p.x, p.z)).toBe(true);
      prev = p;
    }
  });

  it('with no way through, ends as close as it can get; already there, stays', () => {
    const sealed = (x: number) => !(Math.abs(x - 5) < 0.5);
    const path = findPath({ x: 2, z: 2 }, { x: 8, z: 2 }, 10, sealed);
    expect(path[path.length - 1]).toEqual({ x: 4, z: 2 });
    expect(findPath({ x: 2, z: 2 }, { x: 2.2, z: 1.9 }, 10, sealed)).toEqual([]);
  });
});

describe('enemies chase around obstacles', () => {
  it('a bandit walks out of its camp gate to reach a hero behind the palisade', () => {
    let tried = 0;
    for (const seed of TEST_SEEDS) {
      const model = new GameModel(seed, TEST_MAP_SIZE);
      for (const camp of model.camps) {
        // The side opposite the gate (local -Z, turned like the camp), 3.5 tiles out.
        let [bx, bz] = [0, -3.5];
        for (let q = 0; q < camp.quarterTurns; q++) [bx, bz] = [bz, -bx];
        const hx = camp.x + bx;
        const hz = camp.z + bz;
        if (!model.isOpenTile(Math.round(hx), Math.round(hz))) continue;
        const bandit = model.enemies.find((e) => e.kind === 'bandit' && Math.hypot(e.x - camp.x, e.z - camp.z) <= 2.5);
        if (!bandit) continue;
        tried++;
        model.enemies.splice(0, model.enemies.length, bandit);
        model.teleport(Math.round(hx), Math.round(hz));
        model.godMode = true;
        bandit.state = 'chase';
        let reached = false;
        for (let t = 0; t < 20 && !reached; t += 1 / 30) {
          model.update(0, 0, 1 / 30);
          reached = Math.hypot(bandit.x - model.hero.x, bandit.z - model.hero.z) <= ENEMY_STATS.bandit.stop + 0.1;
        }
        expect(reached, `seed ${seed} camp ${camp.x},${camp.z}`).toBe(true);
        if (tried >= 2) return;
      }
    }
    expect(tried).toBeGreaterThan(0);
  });
});

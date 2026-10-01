// Ghosts: haunting the old ruins, bound to them; their touch cold.

import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { stepEnemy } from '../src/model/enemies/enemies';
import { foeStrikes } from '../src/model/hero/fighting';
import { ENEMY_STATS } from '../src/model/constants';
import { isBane } from '../src/model/hero/blessing';
import type { Enemy } from '../src/model/types';
import { FRAME } from './support/testWorld';

const MID = { width: 512, depth: 512 };
const inside = (g: Enemy, x = g.x, z = g.z) => x >= g.haunt!.x0 && x <= g.haunt!.x1 && z >= g.haunt!.z0 && z <= g.haunt!.z1;
const free = { move: (e: Enemy, dx: number, dz: number) => ((e.x += dx), (e.z += dz), true), steer: (_e: Enemy, to: { x: number; z: number }) => to, sees: () => true, strike: () => {} };

describe('ghosts', () => {
  it('haunt every old ruin, two to four of them, within its walls, on open ground', () => {
    for (const seed of [1, 2, 3, 4]) {
      const model = new GameModel(seed, MID);
      expect(model.ruins.length).toBeGreaterThan(0);
      for (const ruin of model.ruins) {
        const ghosts = model.enemies.filter((e) => e.kind === 'ghost' && e.haunt && Math.abs(e.homeX - (ruin.x + ruin.w / 2)) < 1 && Math.abs(e.homeZ - (ruin.z + ruin.d / 2)) < 1);
        expect(ghosts.length).toBeGreaterThanOrEqual(2);
        expect(ghosts.length).toBeLessThanOrEqual(4);
        for (const g of ghosts) {
          expect(inside(g)).toBe(true);
          expect(g.haunt!.x0).toBeGreaterThanOrEqual(ruin.x);
          expect(g.haunt!.x1).toBeLessThan(ruin.x + ruin.w);
          expect(model.isOpenTile(g.x, g.z)).toBe(true);
        }
      }
    }
  });

  it('never leave their ruin: wandering, nor chasing the hero out of it; once the hero is out, they give up', () => {
    const model = new GameModel(1, MID);
    const ghost = model.enemies.find((e) => e.kind === 'ghost')!;
    const out = { x: ghost.haunt!.x1 + 3, z: (ghost.haunt!.z0 + ghost.haunt!.z1) / 2 };
    for (let t = 0; t < 120; t += FRAME) {
      stepEnemy(ghost, { x: -999, z: -999 }, FRAME, free); // (wandering, the hero far off)
      expect(inside(ghost)).toBe(true);
    }
    // Set on the hero within, then the hero steps out: it stops at its bounds, and gives up.
    Object.assign(ghost, { x: ghost.haunt!.x1 - 0.5, swingFor: null, cooldown: 99 });
    stepEnemy(ghost, { x: ghost.x + 0.4, z: ghost.z }, FRAME, free);
    expect(ghost.state).toBe('chase');
    stepEnemy(ghost, out, FRAME, free);
    expect(ghost.state).toBe('wander');
    for (let t = 0; t < 5; t += FRAME) {
      stepEnemy(ghost, out, FRAME, free);
      expect(inside(ghost)).toBe(true);
      expect(ghost.state).toBe('wander'); // (never noticing them out there, however close)
    }
  });

  it('their touch chills the hero a moment', () => {
    const model = new GameModel(1, MID);
    const ghost = model.enemies.find((e) => e.kind === 'ghost')!;
    Object.assign(model, { random: () => 0.99 }); // (no dodging)
    Object.assign(model.hero, { x: ghost.x + ENEMY_STATS.ghost.stop, z: ghost.z, blessings: [] });
    const hp = model.hero.hp;
    foeStrikes(model, ghost);
    expect(model.hero.hp).toBeLessThan(hp);
    expect(model.hero.blessings?.some((b) => b.kind === 'chilled' && isBane(b.kind))).toBe(true);
  });
});

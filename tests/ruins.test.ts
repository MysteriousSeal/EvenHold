import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { nextRuin } from '../src/model/cheats';
import { spawnOf } from '../src/model/grid';
import { VILLAGE_OUTER_RADIUS } from '../src/model/constants';
import type { Ruin } from '../src/model/ruins/ruins';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const worlds = TEST_SEEDS.map((seed) => new GameModel(seed, TEST_MAP_SIZE));
const inside = (r: Ruin, x: number, z: number) => x >= r.x && x < r.x + r.w && z >= r.z && z < r.z + r.d;
const SOLID = new Set(['wall', 'wallBroken', 'arch', 'corner', 'tower', 'innerWall', 'altar']);

describe('ruins in every test world', () => {
  it('stand one to a world (the test worlds are smaller than a region), 10 to 15 tiles a side', () => {
    for (const model of worlds) {
      expect(model.ruins.length, `seed ${model.seed}`).toBeGreaterThanOrEqual(1);
      for (const r of model.ruins) {
        expect(r.w).toBeGreaterThanOrEqual(10);
        expect(r.w).toBeLessThanOrEqual(15);
        expect(r.d).toBeGreaterThanOrEqual(10);
        expect(r.d).toBeLessThanOrEqual(15);
      }
    }
  });

  it('stand in the wilds: clear of villages and the start, on wild ground, no trees or bushes on them', () => {
    for (const model of worlds) {
      const spawn = spawnOf(model.size);
      for (const r of model.ruins) {
        const [cx, cz] = [r.x + r.w / 2, r.z + r.d / 2];
        expect(Math.hypot(cx - spawn.x, cz - spawn.z)).toBeGreaterThan(10);
        for (const v of model.villages) expect(Math.hypot(v.x - cx, v.z - cz)).toBeGreaterThan(VILLAGE_OUTER_RADIUS + 10);
        for (let x = r.x; x < r.x + r.w; x++) for (let z = r.z; z < r.z + r.d; z++) {
          expect(model.surfaceMap[x][z]).toBe('natural');
          expect(model.lakeMap[x][z]).toBe(false);
        }
        expect(model.trees.some((t) => inside(r, Math.round(t.x), Math.round(t.z)))).toBe(false);
        expect(model.bushes.some((b) => inside(r, b.x, b.z))).toBe(false);
      }
    }
  });

  it('have their pieces within them, one to a tile; walls block, the floor is walked on', () => {
    for (const model of worlds) {
      for (const r of model.ruins) {
        const tiles = new Set<string>();
        for (const p of r.pieces) {
          expect(inside(r, p.x, p.z), `${p.kind} outside its ruin`).toBe(true);
          expect(tiles.has(`${p.x},${p.z}`), `two pieces at ${p.x},${p.z}`).toBe(false);
          tiles.add(`${p.x},${p.z}`);
          expect(p.variant).toBeGreaterThanOrEqual(0);
          expect(p.variant).toBeLessThan(4);
          if (SOLID.has(p.kind)) expect(model.isBlocked(p.x, p.z, 0.05), `${p.kind} lets through`).toBe(true);
          if (p.kind === 'floor') expect(model.isBlocked(p.x, p.z, 0.1), 'a floor blocks').toBe(false);
        }
        expect(r.pieces.some((p) => ['wall', 'wallBroken', 'arch'].includes(p.kind))).toBe(true);
        expect(r.pieces.some((p) => p.kind === 'tower' || p.kind === 'corner')).toBe(true);
        if (r.style === 'chapel') expect(r.pieces.filter((p) => p.kind === 'altar')).toHaveLength(1);
      }
    }
  });

  it('can be walked into by their way in', () => {
    for (const model of worlds) {
      for (const r of model.ruins) {
        expect(inside(r, r.way.x, r.way.z)).toBe(false); // just outside
        expect(model.isOpenTile(r.way.x, r.way.z)).toBe(true);
        // From there, round what blocks, to the middle's floor.
        const seen = new Set<string>();
        const todo: Array<[number, number]> = [[r.way.x, r.way.z]];
        let within = 0;
        while (todo.length > 0) {
          const [x, z] = todo.pop()!;
          if (seen.has(`${x},${z}`) || Math.abs(x - (r.x + r.w / 2)) > r.w || Math.abs(z - (r.z + r.d / 2)) > r.d || model.isBlocked(x, z, 0.2)) continue;
          seen.add(`${x},${z}`);
          if (inside(r, x, z) && x > r.x && x < r.x + r.w - 1 && z > r.z && z < r.z + r.d - 1) within++;
          todo.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
        }
        expect(within, `seed ${model.seed}: floor reached inside`).toBeGreaterThan(((r.w - 2) * (r.d - 2)) / 3);
      }
    }
  });

  it('are the same every time for a world, and not the same from one to the next', () => {
    const again = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    expect(again.ruins).toEqual(worlds[0].ruins);
    const looks = new Set(worlds.flatMap((m) => m.ruins.map((r) => JSON.stringify(r.pieces.map((p) => [p.kind, p.x - r.x, p.z - r.z, p.variant])))));
    expect(looks.size).toBe(worlds.reduce((n, m) => n + m.ruins.length, 0)); // no two alike
    expect(new Set(worlds.flatMap((m) => m.ruins.map((r) => r.style)))).toEqual(new Set(['keep', 'chapel']));
  });

  it('are toured by the cheat, nearest first, each once, landing just outside the way in', () => {
    const model = worlds[0];
    const seen = new Set<Ruin>();
    for (let i = 0; i < model.ruins.length; i++) {
      const at = nextRuin(model, model.hero, seen)!;
      expect(model.isOpenTile(at.x, at.z)).toBe(true);
      expect(model.ruins.some((r) => Math.hypot(r.way.x - at.x, r.way.z - at.z) <= 2)).toBe(true);
    }
    expect(seen.size).toBe(model.ruins.length);
  });
});

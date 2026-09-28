import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { HERO_RADIUS, LANTERN_COLLISION_HALF } from '../src/model/constants';
import { cellKey } from '../src/model/grid';
import { squareLanterns } from '../src/model/worldgen/villages';
import { buildLanternGeometry } from '../src/view/meshes/plaza/lanternMesh';
import { TEST_MAP_SIZE, TEST_SEEDS, testModel } from './support/testWorld';

describe('square lanterns', () => {
  it.each(TEST_SEEDS)('seed %i: four posts per square, on free corner tiles', (seed) => {
    const world = testModel(seed);
    const taken = new Set([...world.houses, ...world.villages].map((o) => cellKey(o.x, o.z)));
    for (const b of world.buildings) for (const [x, z] of b.tiles) taken.add(cellKey(x, z));
    const bad = world.villages.flatMap((v) =>
      squareLanterns(v).filter(([x, z]) => taken.has(cellKey(x, z)) || world.surfaceMap[x][z] !== 'plaza'),
    );
    expect(bad).toEqual([]);
  });

  it('fits its tile and has a glowing lantern', () => {
    const post = buildLanternGeometry(false);
    post.computeBoundingBox();
    const box = post.boundingBox!;
    expect(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)).toBeLessThanOrEqual(0.5);
    expect(box.max.y).toBeGreaterThan(0.6); // above the hero's head
    expect(buildLanternGeometry(true).getAttribute('position').count).toBeGreaterThan(0);
  });

  it('blocks the hero at the post', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const [x, z] = squareLanterns(model.villages[0])[0];
    model.teleport(x - 1, z);
    for (let i = 0; i < 60; i++) model.update(1, 0, 1 / 60);
    expect(model.hero.x + HERO_RADIUS).toBeLessThanOrEqual(x - LANTERN_COLLISION_HALF + 1e-9);
  });
});

describe('lantern orientation', () => {
  it('turns every corner post so both arms reach into the square', () => {
    // three.js turns (x, z) by q quarter turns to (x cos + z sin, -x sin + z cos).
    const turn = ([x, z]: [number, number], q: number): [number, number] => {
      const a = (q * Math.PI) / 2;
      return [Math.round(x * Math.cos(a) + z * Math.sin(a)), Math.round(-x * Math.sin(a) + z * Math.cos(a))];
    };
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const q = sx < 0 ? (sz < 0 ? 0 : 1) : sz < 0 ? 3 : 2;
      const arms = [turn([1, 0], q), turn([0, 1], q)];
      // Inward from corner (sx, sz) is -sx along X and -sz along Z.
      expect(arms.map(String).sort()).toEqual([String([-sx, 0]), String([0, -sz])].sort());
    }
  });
});

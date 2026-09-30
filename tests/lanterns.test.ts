import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { HERO_RADIUS, LANTERN_COLLISION_HALF } from '../src/model/constants';
import { cellKey } from '../src/model/map/grid';
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

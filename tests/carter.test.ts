// The carter and his wagon (model/wayside/carter.ts, scenery/scenery.ts): a broken-down wagon a few tiles from where
// the hero sets out, in every world, on level open ground, in the way as a boulder is; a man stood on the tile
// beside it, named, plainly dressed, walked round; the start itself left clear.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { carterOf } from '../src/model/wayside/carter';
import { carterTile, sceneryTiles } from '../src/model/scenery/scenery';
import { STREAMED_SIZE } from '../src/model/worldgen/regions';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';
import { HERO_RADIUS } from '../src/model/constants';

describe('the carter and his wagon', () => {
  it('stand by the start in every world: the wagon near, level and in the way, the man beside it', () => {
    const worlds = [...TEST_SEEDS.map((seed) => new GameModel(seed, TEST_MAP_SIZE)), new GameModel(7, STREAMED_SIZE)];
    for (const model of worlds) {
      const { hero } = model;
      const wagons = model.scenery.filter((s) => s.kind === 'wagon');
      expect(wagons.length, `seed ${model.seed}`).toBe(1);
      const wagon = wagons[0];
      const far = Math.hypot(wagon.x + 0.5 - hero.x, wagon.z - hero.z);
      expect(far).toBeGreaterThan(1.5);
      expect(far).toBeLessThan(9);
      const tiles = sceneryTiles(wagon);
      expect(new Set(tiles.map(([x, z]) => model.tiles.height(x, z))).size).toBe(1);
      for (const [x, z] of tiles) expect(model.isBlocked(x, z, HERO_RADIUS)).toBe(true);
      expect(model.isBlocked(hero.x, hero.z, HERO_RADIUS)).toBe(false); // (the start: clear)
      const carter = carterOf(model)!;
      expect(carter.name.length).toBeGreaterThan(2);
      expect([carter.x, carter.z]).toEqual([carterTile(wagon).x, carterTile(wagon).z]);
      expect(carter.look.build).toBe('male');
      expect(Object.keys(carter.equipment).length).toBeGreaterThanOrEqual(4);
      expect(model.isBlocked(carter.x, carter.z, HERO_RADIUS)).toBe(true); // (walked round, not through)
      expect(carterOf(model)).toBe(carter); // (the same man each time asked)
    }
  }, 60_000);
});

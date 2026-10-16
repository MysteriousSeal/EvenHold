// Small finds off the road (loot/wildFinds.ts): a cache under some cairns and standing stones, an offering at some
// ruins' altars, a rare herb of the country by some boulders, willows and dead trees; a few to a region, each the same
// for a seed, each to be reached and picked up once for good (a save keeps it taken).
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { PICKUP_RANGE } from '../src/model/loot/loot';
import { isHerb } from '../src/model/loot/herbs';
import { parseSave, restore, snapshot } from '../src/model/save';

const SIZE = { width: 1024, depth: 1024 }; // (four regions' worth)
const finds = (m: GameModel) => m.loot.filter((l) => l.find);

describe('finds off the road', () => {
  it('a few to a region (caches, offerings, rare herbs), the same every time, each to be reached', () => {
    for (const seed of [7, 42]) {
      const model = new GameModel(seed, SIZE);
      const all = finds(model);
      const herbs = all.filter((f) => isHerb(f.item)).length;
      console.log(`seed ${seed}: ${all.length} finds in 4 regions (${herbs} herbs, ${all.length - herbs} caches and offerings)`);
      expect(all.length / 4, `seed ${seed}`).toBeGreaterThanOrEqual(6);
      expect(all.length / 4, `seed ${seed}`).toBeLessThanOrEqual(25);
      expect(herbs, `seed ${seed}`).toBeGreaterThan(0);
      expect(all.length - herbs, `seed ${seed}`).toBeGreaterThan(0);
      expect(finds(new GameModel(seed, SIZE)).map((f) => [f.find, f.item])).toEqual(all.map((f) => [f.find, f.item]));
      for (const f of all) {
        const reached = Array.from({ length: 16 }, (_, i) => i).some((i) => !model.isBlocked(f.x + Math.cos(i * 0.39) * (PICKUP_RANGE - 0.05), f.z + Math.sin(i * 0.39) * (PICKUP_RANGE - 0.05), 0.14));
        expect(reached, `seed ${seed}, ${f.item} at ${f.x},${f.z}`).toBe(true);
      }
    }
  }, 120_000);

  it('picked up, are gone for good: not laid again, nor after a save', () => {
    const model = new GameModel(7, SIZE);
    const find = finds(model)[0];
    Object.assign(model.hero, { x: find.x + 0.5, z: find.z });
    expect(model.pickUp()).toBe(find.item);
    expect(model.loot).not.toContain(find);
    model.settle({ x0: 0, z0: 0, x1: SIZE.width, z1: SIZE.depth });
    expect(finds(model).some((f) => f.find === find.find)).toBe(false);
    const again = new GameModel(7, SIZE);
    restore(again, parseSave(JSON.stringify(snapshot(model)), 7)!);
    expect(finds(again).some((f) => f.find === find.find)).toBe(false);
    expect(finds(again).length).toBe(finds(model).length);
  }, 120_000);
});

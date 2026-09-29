import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { squareBenches } from '../src/model/worldgen/benches';
import { stepCat } from '../src/model/wildlife/cats';
import type { Wildlife } from '../src/model/wildlife/wildlife';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const fresh = (seed = TEST_SEEDS[0]) => new GameModel(seed, TEST_MAP_SIZE);
const catsOf = (model: GameModel) => model.wildlife.filter((w) => w.kind === 'cat');
const homeOf = (model: GameModel, cat: Wildlife) => model.villages.find((v) => v.x === cat.homeX && v.z === cat.homeZ)!;

describe('cats', () => {
  it('live one or two to a village, the same on the same seed', () => {
    const model = fresh();
    for (const village of model.villages) {
      const n = catsOf(model).filter((c) => c.homeX === village.x && c.homeZ === village.z).length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(2);
    }
    expect(catsOf(fresh()).map(({ x, z, variant }) => [x, z, variant])).toEqual(catsOf(model).map(({ x, z, variant }) => [x, z, variant]));
  });

  it('roam their village, sitting, grooming and napping, never far off', () => {
    const model = fresh();
    const cat = catsOf(model)[0];
    const village = homeOf(model, cat);
    model.teleport(village.x + 10, village.z + 10); // near enough for them to act, not near enough to draw them
    const poses = new Set<string>();
    let far = 0;
    for (let t = 0; t < 600; t += 0.1) {
      model.update(0, 0, 0.1);
      if (cat.pose) poses.add(cat.pose);
      far = Math.max(far, Math.hypot(cat.x - village.x, cat.z - village.z));
    }
    expect(poses.size).toBeGreaterThanOrEqual(2);
    expect(far).toBeLessThan(10);
  }, 60_000);

  it('bolt when rushed at, but not when walked past', () => {
    const model = fresh();
    const cat = catsOf(model)[0];
    const hero = { x: cat.x + 3, z: cat.z };
    stepCat(cat, model, hero, 0.1);
    hero.x = cat.x + 2.9; // strolling
    stepCat(cat, model, hero, 0.1);
    expect(cat.fleeing).toBe(false);
    hero.x = cat.x + 1; // then a dash straight at it
    stepCat(cat, model, hero, 0.1);
    expect(cat.fleeing).toBe(true);
  });

  it('get down off a bench as someone comes to sit', () => {
    const model = fresh();
    const cat = catsOf(model)[0];
    const bench = squareBenches(model)[0];
    const seat = bench.seats[0];
    Object.assign(cat, { perch: seat, pose: 'loaf', x: seat.x, z: seat.z, y: seat.y, restFor: 30, target: null });
    const hero = { x: cat.x + 5, z: cat.z + 5 };
    stepCat(cat, model, hero, 0.1);
    expect(cat.pose).toBe('loaf');
    model.npcs[0].seat = seat; // a villager sits
    stepCat(cat, model, hero, 0.1);
    expect(cat.perch).toBeNull();
    expect(cat.y).toBeCloseTo(model.getGroundY(cat.x, cat.z));
  });
});

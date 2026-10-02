// A hero never lost (their position never "not a number"), and a save
// never lost for it: a roll indoors (its very last step none at all), into
// a cauldron or a wall, every way; a step of nothing indoors; and a save
// holding a lost position (an older one's) still bringing the hero back,
// whole, somewhere sound.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { layoutOf, walkInside } from '../src/model/interiors/indoors';
import { visitHerbalist, enterNearest } from '../src/model/cheats';
import { parseSave, restore, snapshot } from '../src/model/save';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const sound = (m: GameModel) => Number.isFinite(m.hero.x) && Number.isFinite(m.hero.z) && Number.isFinite(m.hero.facing);

describe('a hero never lost', () => {
  it('rolling indoors every way, into the cauldron and the walls, at every frame rate', () => {
    for (const seed of TEST_SEEDS.slice(0, 3)) {
      const m = new GameModel(seed, TEST_MAP_SIZE);
      visitHerbalist(m, new Set());
      const pot = layoutOf(m.seed, m.inside!.entrance).furniture.find((f) => f.kind === 'cauldron')!;
      for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
        for (let a = 0; a < 8; a++) {
          const [dx, dz] = [Math.cos((a * Math.PI) / 4), Math.sin((a * Math.PI) / 4)];
          [m.hero.x, m.hero.z] = [pot.x - dx * 1.2, pot.z - dz * 1.2];
          m.moves.breath = 100;
          expect(m.roll(dx, dz)).toBe(true);
          for (let t = 0; t < 0.8; t += dt) m.update(0, 0, dt);
          expect(sound(m), `seed ${seed}, way ${a}, dt ${dt}`).toBe(true);
        }
      }
    }
  });

  it('rolling in a house, and out of doors', () => {
    const m = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    enterNearest(m, 'house', new Set());
    for (let a = 0; a < 4; a++) {
      m.moves.breath = 100;
      m.roll(a % 2 ? 1 : -1, a < 2 ? 1 : -1);
      for (let t = 0; t < 0.8; t += 1 / 60) m.update(0, 0, 1 / 60);
    }
    expect(sound(m)).toBe(true);
    m.useDoor();
    m.moves.breath = 100;
    m.roll(1, 0);
    for (let t = 0; t < 0.8; t += 1 / 60) m.update(0, 0, 1 / 60);
    expect(sound(m)).toBe(true);
  });

  it('a step of nothing indoors goes nowhere', () => {
    const m = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    enterNearest(m, 'house', new Set());
    const [x, z] = [m.hero.x, m.hero.z];
    walkInside(m.inside!, m.hero, 0, 0, 0.3);
    walkInside(m.inside!, m.hero, 1, 0, 0);
    expect([m.hero.x, m.hero.z]).toEqual([x, z]);
  });
});

describe('a save never lost for a lost position', () => {
  it('an older save holding one still brings the hero back, whole, somewhere sound (indoors: at the door; out: where they set out)', () => {
    for (const inside of [true, false]) {
      const m = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
      if (inside) visitHerbalist(m, new Set());
      Object.assign(m.hero, { name: 'Aleyn', level: 17, money: 4321 });
      const saved = snapshot(m);
      Object.assign(saved.hero, { x: Number.NaN, z: Number.NaN, facing: Number.NaN }); // (as JSON writes them: null)
      const data = parseSave(JSON.stringify(saved), m.seed);
      expect(data, 'kept').not.toBeNull();
      const again = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
      restore(again, data!);
      expect([again.hero.name, again.hero.level, again.hero.money]).toEqual(['Aleyn', 17, 4321]);
      expect(sound(again)).toBe(true);
      expect(!!again.inside).toBe(inside);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { enterNearest } from '../src/model/cheats';
import { parseSave, restore, snapshot } from '../src/model/save';
import { takeStairs, useHallDoor } from '../src/model/interiors/upstairs';
import { SMITH_WARES, buyGear, smithShopIn } from '../src/model/smithy/smithShop';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const FRAME = 1 / 30;
const reload = (model: GameModel) => {
  const again = new GameModel(model.seed, TEST_MAP_SIZE);
  restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
  return again;
};
const run = (model: GameModel, seconds: number) => {
  for (let t = 0; t < seconds; t += FRAME) model.update(0, 0, FRAME);
};
// A save, less what's wall-clock time (a shop's last restock).
const saved = (model: GameModel) => {
  const data = snapshot(model);
  return JSON.parse(JSON.stringify({ ...data, shops: data.shops?.map(({ restockedAt: _, ...shop }) => shop) }));
};

describe('saving, in every test world', () => {
  for (const seed of TEST_SEEDS) {
    it(`keeps a played game as it was (seed ${seed})`, () => {
      const model = new GameModel(seed, TEST_MAP_SIZE);
      // A little of everything: the day goes by, a foe falls, gear bought at
      // the smith's, up the inn's stairs, a door opened, the walls option on.
      run(model, 20);
      const foe = model.enemies.find((e) => e.state !== 'dead');
      if (foe) {
        foe.state = 'dead';
        model.slain.add(foe.id);
      }
      model.hero.energy = 42;
      model.hero.money = 5000;
      if (enterNearest(model, 'smithy', new Set())) {
        const shop = smithShopIn(model);
        const ware = SMITH_WARES.find((id) => (shop.stock[id] ?? 0) > 0);
        if (ware) expect(buyGear(shop, model.hero, ware)).toBe('bought');
      }
      model.fullWalls = true;
      enterNearest(model, 'inn', new Set());
      const stairs = model.inside!.furniture.find((f) => f.kind === 'stairs')!;
      Object.assign(model.hero, { x: stairs.x + stairs.w, z: stairs.z });
      expect(takeStairs(model)).toBe(true);
      const door = model.inside!.furniture.find((f) => f.kind === 'hallDoor' && f.wall === 'back')!;
      Object.assign(model.hero, { x: door.x - 0.5 + door.w / 2, z: door.z - 0.9 });
      expect(useHallDoor(model)).toBe(true); // (tried: locked)
      run(model, 5);

      const again = reload(model);
      expect(saved(again)).toEqual(saved(model)); // everything kept, nothing changed on the way
      expect(again.inside?.below).toBe(again.entrances[model.entrances.indexOf(model.inside!.below!)]); // upstairs still
      expect(again.inside?.furniture.find((f) => f.kind === 'hallDoor' && f.x === door.x && f.z === door.z)?.open).toBeFalsy(); // (locked: shut still)
      expect(again.fullWalls).toBe(true);
      expect(saved(reload(again))).toEqual(saved(model)); // and again
    });
  }
});

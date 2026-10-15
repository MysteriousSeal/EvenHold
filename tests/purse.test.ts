// Go back for your purse (model/hero/purse.ts): a fall drops half the hero's coin where they fell, theirs again once
// they walk back over it (outdoors, or down the dungeon they fell in: there only); fall again first and that purse is
// lost for good, the new fall's lying where they fell this time. Kept in a save; an older save's: none.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { PURSE_SHARE, readPurse } from '../src/model/hero/purse';
import { parseSave, restore, snapshot } from '../src/model/save';
import { spawnOf } from '../src/model/map/grid';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const fresh = () => {
  const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
  model.lastInn = null;
  return model;
};
// Somewhere open on the map, a way from the spawn.
const openSpot = (model: GameModel, away = 10) => {
  const spawn = spawnOf(model.size);
  for (let r = away; r < 40; r++) for (let a = 0; a < 16; a++) {
    const [x, z] = [Math.round(spawn.x + r * Math.cos(a)), Math.round(spawn.z + r * Math.sin(a))];
    if (model.isOpenTile(x, z)) return { x: x + 0.5, z: z + 0.5 };
  }
  throw new Error('no open ground');
};
const walkTo = (model: GameModel, at: { x: number; z: number }) => {
  model.teleport(at.x, at.z);
  model.update(0, 0, 1 / 60);
};

describe('a fall', () => {
  it('drops half their coin where they fell; walked back to, it is all theirs again', () => {
    const model = fresh();
    const spot = openSpot(model);
    model.teleport(spot.x, spot.z);
    model.hero.money = 301;
    model.fall();
    expect(model.hero.money).toBe(301 - Math.floor(301 * PURSE_SHARE));
    expect(model.purse).toEqual({ amount: 150, x: spot.x, z: spot.z, under: null });
    model.update(0, 0, 1 / 60); // (at the spawn: nowhere near it)
    expect(model.purse).not.toBeNull();
    model.takeEvents();
    walkTo(model, { x: spot.x + 0.5, z: spot.z });
    expect([model.hero.money, model.purse]).toEqual([301, null]);
    const events = model.takeEvents();
    expect(events).toContainEqual({ kind: 'coins', amount: 150 });
    expect(events.some((e) => e.kind === 'banner')).toBe(true);
  });

  it('again before it is found: the first purse lost for good, the new one where they fell this time', () => {
    const model = fresh();
    const [first, second] = [openSpot(model, 8), openSpot(model, 20)];
    model.teleport(first.x, first.z);
    model.hero.money = 400;
    model.fall();
    model.teleport(second.x, second.z);
    model.fall();
    expect(model.hero.money).toBe(100);
    expect(model.purse).toEqual({ amount: 100, x: second.x, z: second.z, under: null });
    walkTo(model, first);
    expect(model.hero.money).toBe(100); // (nothing there now)
    walkTo(model, second);
    expect(model.hero.money).toBe(200);
  });

  it('with no coin drops nothing (and the last purse is lost all the same)', () => {
    const model = fresh();
    model.hero.money = 50;
    model.fall();
    expect(model.purse?.amount).toBe(25);
    model.hero.money = 0;
    model.fall();
    expect([model.hero.money, model.purse]).toEqual([0, null]);
  });

  it('down a crypt: the purse lies on its floor, found there only', () => {
    const model = fresh();
    const crypt = model.crypts[0];
    model.teleport(crypt.entrance.x, crypt.entrance.z);
    model.enterRoom(crypt.entrance);
    const key = model.below!.key;
    const at = { x: model.hero.x, z: model.hero.z };
    model.hero.money = 90;
    model.fall();
    expect(model.dungeon).toBeNull();
    expect(model.purse).toEqual({ amount: 45, x: at.x, z: at.z, under: key });
    walkTo(model, at); // (the same numbers on the map: not the crypt's floor)
    expect(model.hero.money).toBe(45);
    model.teleport(crypt.entrance.x, crypt.entrance.z);
    model.enterRoom(crypt.entrance);
    Object.assign(model.hero, at);
    model.update(0, 0, 1 / 60);
    expect([model.hero.money, model.purse]).toEqual([90, null]);
  });

  it('is kept in a save; an older save has none; a damaged one, none', () => {
    const model = fresh();
    const spot = openSpot(model);
    model.teleport(spot.x, spot.z);
    model.hero.money = 80;
    model.fall();
    const data = JSON.parse(JSON.stringify(snapshot(model)));
    const again = new GameModel(model.seed, TEST_MAP_SIZE);
    restore(again, parseSave(JSON.stringify(data), model.seed)!);
    expect(again.purse).toEqual(model.purse);
    delete data.purse;
    const older = new GameModel(model.seed, TEST_MAP_SIZE);
    restore(older, parseSave(JSON.stringify(data), model.seed)!);
    expect(older.purse).toBeNull();
    for (const bad of [null, 5, 'x', [], { amount: -3, x: 1, z: 1, under: null }, { amount: 2.5, x: 1, z: 1, under: null }, { amount: 3, x: 'a', z: 1, under: null }, { amount: 3, x: 1, z: 1, under: 7 }]) expect(readPurse(bad)).toBeNull();
  });
});

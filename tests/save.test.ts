import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { parseSave, restore, snapshot } from '../src/model/save';
import { clockAt } from '../src/model/clock';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const fresh = () => new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
// Saved, stored as text and read back into a new game of the same world.
const reload = (model: GameModel) => {
  const again = fresh();
  restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
  return again;
};

describe('saving', () => {
  it('keeps the hero and the world as they were changed', () => {
    const model = fresh();
    const { hero } = model;
    Object.assign(hero, { name: 'Oswith', level: 4, xp: 12, hp: 7, money: 1234 });
    hero.look = { ...hero.look, build: 'female', hairStyle: 'braid', beard: false };
    hero.equipment.head = 'leatherCap';
    hero.bag.gambeson = 2;
    hero.bagOrder = [null, 'gambeson'];
    model.teleport(hero.x + 1, hero.z);
    const foe = model.enemies[0];
    foe.state = 'dead';
    model.slain.add(foe.id);
    model.dropLoot('gambeson', 10, 10);
    model.dropCoins(42, 11, 11);

    const again = reload(model);
    expect(again.hero).toMatchObject({ name: 'Oswith', level: 4, xp: 12, hp: 7, money: 1234, x: hero.x, z: hero.z });
    expect(again.hero.look).toEqual(hero.look);
    expect(again.hero.equipment).toEqual({ head: 'leatherCap' });
    expect(again.hero.bag).toEqual({ gambeson: 2 });
    expect(again.hero.bagOrder).toEqual([null, 'gambeson']);
    expect(again.enemies.some((e) => e.id === foe.id)).toBe(false); // slain stays slain
    expect(again.loot.map(({ item, x, z }) => ({ item, x, z }))).toEqual([{ item: 'gambeson', x: 10, z: 10 }]);
    expect(again.coins.map(({ amount, x, z }) => ({ amount, x, z }))).toEqual([{ amount: 42, x: 11, z: 11 }]);
    // And again: the slain are still remembered, to stay gone.
    expect(reload(again).enemies.some((e) => e.id === foe.id)).toBe(false);
  });

  it('keeps the hero indoors, and each villager where they were in their day', () => {
    const model = fresh();
    const door = model.entrances.find((e) => e.type === 'house')!;
    model.teleport(door.x, door.z);
    model.useDoor();
    model.hero.x += 0.5;
    const npc = model.npcs[0];
    Object.assign(npc, { where: null, x: 5.5, z: 6.5, stop: 3 });

    const again = reload(model);
    expect(again.inside?.entrance).toBe(again.entrances[model.entrances.indexOf(door)]);
    expect(again.hero.x).toBeCloseTo(model.hero.x);
    expect(again.npcs[0]).toMatchObject({ where: null, x: 5.5, z: 6.5, stop: 3 });
  });

  it("refuses what isn't a save of this world", () => {
    const model = fresh();
    const good = JSON.stringify(snapshot(model));
    expect(parseSave(good, model.seed)).not.toBeNull();
    expect(parseSave(good, model.seed + 1)).toBeNull(); // another world's
    expect(parseSave('{broken', model.seed)).toBeNull();
    expect(parseSave(null, model.seed)).toBeNull();
    expect(parseSave(JSON.stringify({ ...JSON.parse(good), version: 99 }), model.seed)).toBeNull();
    expect(parseSave(JSON.stringify({ ...JSON.parse(good), hero: { name: 1 } }), model.seed)).toBeNull();
  });

  it('drops what the game no longer knows from an old save, and keeps the rest', () => {
    const model = fresh();
    model.hero.bag = { gambeson: 1 };
    model.hero.equipment = { head: 'leatherCap' };
    const data = JSON.parse(JSON.stringify(snapshot(model)));
    data.hero.bag.goldenGoose = 3; // renamed or removed since
    data.hero.equipment.torso = 'leatherCap'; // not a torso piece
    data.loot.push({ item: 'goldenGoose', x: 5, z: 5 });
    const again = fresh();
    restore(again, parseSave(JSON.stringify(data), model.seed)!);
    expect(again.hero.bag).toEqual({ gambeson: 1 });
    expect(again.hero.equipment).toEqual({ head: 'leatherCap' });
    expect(again.loot).toHaveLength(0);
  });

  it('keeps the game clock, and tells the day and time from it', () => {
    const model = fresh();
    expect(clockAt(model.minutes)).toEqual({ day: 1, time: '08:00' }); // a new game: the first morning
    model.update(0, 0, 90); // a minute and a half played: an hour and a half on the clock
    expect(clockAt(model.minutes).time).toBe('09:30');
    model.minutes = 2 * 24 * 60 + 14 * 60 + 5;
    expect(clockAt(model.minutes)).toEqual({ day: 3, time: '14:05' });
    expect(reload(model).minutes).toBe(model.minutes);
  });
});

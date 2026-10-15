// The hero's strongbox (model/hero/stash.ts): one store at every inn, STASH_SLOTS slots, materials by the fifty, junk
// by the twenty; quest items kept in the bag; in and out as far as there's room; all the junk or materials at once;
// kept in a save (an older save's: empty). Every inn of the test worlds has its strongbox, stood before from free floor,
// and E there opens it; the let room's chest upstairs opens the same.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { enterNearest } from '../src/model/cheats';
import { goesUnder } from '../src/model/dungeons/dungeonTypes';
import { interactionOf } from '../src/model/hero/interaction';
import { STASH_SLOTS, STASH_STACK, readStash, retrieve, stashSlots, stashUsed, store, storeAll, strongboxInReach } from '../src/model/hero/stash';
import { JUNK_STACK, slotsUsed } from '../src/model/hero/bagStacks';
import { bagRoom } from '../src/model/hero/bagSlots';
import { wearGone } from '../src/model/hero/wear';
import { letDoor, rentRoom, letRoomTiles } from '../src/model/inn/roomLetting';
import { takeStairs } from '../src/model/interiors/upstairs';
import { barmaidHere } from '../src/controller/trade/barOrder';
import { parseSave, restore, snapshot } from '../src/model/save';
import type { BagItem } from '../src/model/hero/bag';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const hero = (bag: Partial<Record<BagItem, number>> = {}) => ({ bag: { ...bag }, bags: [null, null, null, null], stash: {} as Partial<Record<BagItem, number>> });

describe('the strongbox', () => {
  it('takes materials fifty to a slot and junk twenty, up to its slots, never a quest item', () => {
    const h = hero({ honeycomb: 120, woodenBowl: 45, wolfPelt: 2 });
    expect(store(h, 'honeycomb')).toBe(120);
    expect(store(h, 'woodenBowl')).toBe(45);
    expect(store(h, 'wolfPelt')).toBe(0); // (a quest's: on the hero)
    expect(h.bag).toEqual({ wolfPelt: 2 });
    expect(stashUsed(h.stash)).toBe(3 + 3);
    expect(stashSlots(h.stash).map((s) => s.count)).toEqual([STASH_STACK, STASH_STACK, 20, JUNK_STACK, JUNK_STACK, 5]);
    // Filled to its last slot: only what tops up a stack goes in after.
    const full = hero({ rawBoarMeat: STASH_SLOTS * STASH_STACK + 30, honeycomb: 5 });
    expect(store(full, 'rawBoarMeat', STASH_SLOTS * STASH_STACK - 10)).toBe(STASH_SLOTS * STASH_STACK - 10);
    expect(store(full, 'honeycomb')).toBe(0); // (every slot taken)
    expect(store(full, 'rawBoarMeat')).toBe(10); // (its last stack topped up)
    expect(stashUsed(full.stash)).toBe(STASH_SLOTS);
  });

  it('gives back as far as the bag has room', () => {
    const h = hero();
    for (let i = 0; i < bagRoom(h) - 1; i++) h.bag[`woodenBowl` as BagItem] = (h.bag.woodenBowl ?? 0) + JUNK_STACK; // (every slot but one full of bowls)
    h.stash = { honeycomb: 7, oakCask: 30 };
    expect(slotsUsed(h.bag)).toBe(bagRoom(h) - 1);
    expect(retrieve(h, 'oakCask')).toBe(JUNK_STACK); // (the last slot, a stack of twenty)
    expect(retrieve(h, 'honeycomb')).toBe(0); // (no slot left for it)
    expect(h.stash).toEqual({ honeycomb: 7, oakCask: 10 });
  });

  it('takes all the junk, or all the materials, at once', () => {
    const h = hero({ woodenBowl: 3, doll: 1, honeycomb: 4, rawWolfMeat: 2, bread: 2, wolfPelt: 1 });
    expect(storeAll(h, 'junk')).toEqual({ stored: 4, left: false });
    expect(storeAll(h, 'ingredient')).toEqual({ stored: 6, left: false });
    expect(h.bag).toEqual({ bread: 2, wolfPelt: 1 });
    expect(h.stash).toEqual({ woodenBowl: 3, doll: 1, honeycomb: 4, rawWolfMeat: 2 });
  });

  it('keeps a stashed piece\'s wear when the last one carried is sold', () => {
    const h = { ...hero(), equipment: {}, wear: { leatherCap: 40 } as Record<string, number> };
    h.stash = { leatherCap: 1 };
    wearGone(h, 'leatherCap');
    expect(h.wear.leatherCap).toBe(40);
  });

  it('is kept in a save; an older save has nothing in it; a damaged one, only what is sound', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    model.hero.stash = { honeycomb: 60, leatherCap: 1 };
    const data = JSON.parse(JSON.stringify(snapshot(model)));
    const again = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    restore(again, parseSave(JSON.stringify(data), model.seed)!);
    expect(again.hero.stash).toEqual({ honeycomb: 60, leatherCap: 1 });
    delete data.hero.stash;
    const older = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    restore(older, parseSave(JSON.stringify(data), model.seed)!);
    expect(older.hero.stash).toEqual({});
    expect(readStash({ honeycomb: 2.5, nothing: 3, wolfPelt: 1, apple: -1, bread: 4, cheese: 1e12 })).toEqual({ bread: 4 });
    expect(readStash([1, 2])).toEqual({});
  });
});

describe('every inn', () => {
  it('has its strongbox against the right-hand wall, free floor before it, E there opening it', () => {
    let inns = 0;
    for (const seed of TEST_SEEDS) {
      const model = new GameModel(seed, TEST_MAP_SIZE);
      for (const door of model.entrances.filter((e) => e.type === 'inn' && !goesUnder(e))) {
        model.inside = null;
        model.teleport(door.x, door.z);
        model.enterRoom(door);
        const { furniture, room } = model.inside!;
        const box = furniture.find((f) => f.kind === 'strongbox');
        expect(box, `seed ${seed}, inn at ${door.x},${door.z}`).toBeTruthy();
        expect([box!.x, box!.facing]).toEqual([room.width - 1, [-1, 0]]);
        expect(furniture.some((f) => f.solid && f !== box && box!.x - 1 >= f.x && box!.x - 1 < f.x + f.w && box!.z >= f.z && box!.z < f.z + f.d)).toBe(false);
        Object.assign(model.hero, { x: box!.x - 0.75, z: box!.z });
        expect(strongboxInReach(model)).toBe(box);
        expect(interactionOf(model)?.kind).toBe('strongbox');
        Object.assign(model.hero, { x: box!.x - 2, z: box!.z });
        expect(strongboxInReach(model)).toBeNull();
        inns++;
      }
    }
    expect(inns).toBeGreaterThan(5);
  });

  it('opens the same strongbox at the let room\'s chest upstairs', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    enterNearest(model, 'inn', new Set());
    model.minutes = 3 * 24 * 60 + 20 * 60;
    model.hero.money = 500;
    expect(rentRoom(model, barmaidHere(model)!)).toBe('let');
    const stairs = model.inside!.furniture.find((f) => f.kind === 'stairs')!;
    Object.assign(model.hero, { x: stairs.x + stairs.w, z: stairs.z });
    expect(takeStairs(model)).toBe(true);
    const chest = model.inside!.furniture.find((f) => f.kind === 'chest')!;
    expect(letRoomTiles(model.inside!).some(([x, z]) => x === chest.x && z === chest.z)).toBe(true);
    expect(letDoor(model.inside!.furniture)!.locked).toBe(false);
    Object.assign(model.hero, { x: chest.x + 0.8, z: chest.z });
    expect(strongboxInReach(model)).toBe(chest);
  });
});

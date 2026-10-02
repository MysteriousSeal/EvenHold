// The bag's room (hero/bagSlots.ts): 24 slots, and four sockets, each bag fitted six more; a full bag refuses what's
// new (picked up, bought, taken off), not more of what it holds; bags fitted and taken off; kept in the save.

import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { BAG_ROOM, BAG_SOCKETS, ROOM_PER_BAG, bagRoom, canCarry, fitBag, kindsCarried, unfitBag } from '../src/model/hero/bagSlots';
import { BAG_IDS } from '../src/model/loot/bags';
import { LOOT_IDS } from '../src/model/loot/loot';
import { isBagItem } from '../src/model/loot/bags';
import { addToBag, type BagItem } from '../src/model/hero/bag';
import { buyFrom, type Shop } from '../src/model/shops/shopStock';
import { parseSave, restore, snapshot } from '../src/model/save';
import { PEDLAR_WARES, pedlarBuys } from '../src/model/travellers/pedlarShop';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const fresh = () => new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
const KINDS = LOOT_IDS.filter((id) => !isBagItem(id)) as BagItem[];
// The hero's bag filled with `n` kinds of thing, one of each.
const fill = (model: GameModel, n: number) => {
  model.hero.bag = {};
  for (const id of KINDS.slice(0, n)) addToBag(model.hero.bag, id);
};

describe('the bag\'s room', () => {
  it('is 24 slots, six more for each bag fitted, four at most: 48', () => {
    const { hero } = fresh();
    expect(hero.bags).toEqual([null, null, null, null]);
    expect(bagRoom(hero)).toBe(BAG_ROOM);
    for (let i = 0; i < BAG_SOCKETS; i++) {
      addToBag(hero.bag, BAG_IDS[i]);
      expect(fitBag(hero, BAG_IDS[i])).toBe(true);
      expect(bagRoom(hero)).toBe(BAG_ROOM + ROOM_PER_BAG * (i + 1));
    }
    expect(bagRoom(hero)).toBe(48);
    addToBag(hero.bag, 'roughSack');
    expect(fitBag(hero, 'roughSack')).toBe(false); // (every socket taken)
    expect(hero.bag.roughSack).toBe(1);
  });

  it('full, takes nothing new, but more of what it holds; a bag fitted makes room', () => {
    const model = fresh();
    fill(model, BAG_ROOM);
    const [held, fresh1] = [KINDS[0], KINDS[BAG_ROOM]];
    expect(kindsCarried(model.hero)).toBe(BAG_ROOM);
    expect(canCarry(model.hero, fresh1)).toBe(false);
    expect(canCarry(model.hero, held)).toBe(true);
    model.hero.bags[0] = 'roughSack';
    expect(canCarry(model.hero, fresh1)).toBe(true);
  });

  it('full, the hero can\'t pick up something new: it\'s left on the ground, and they\'re told', () => {
    const model = fresh();
    fill(model, BAG_ROOM);
    const item = KINDS[BAG_ROOM];
    model.dropLoot(item, model.hero.x, model.hero.z);
    model.takeEvents();
    expect(model.pickUp()).toBeNull();
    expect(model.hero.bag[item]).toBeUndefined();
    expect(model.loot.some((l) => l.item === item)).toBe(true);
    expect(model.takeEvents()).toContainEqual(expect.objectContaining({ text: 'Your bag is full' }));
  });

  it('full, nothing new bought (the coin kept), nor gear taken off; more of what\'s held, bought', () => {
    const model = fresh();
    fill(model, BAG_ROOM);
    model.hero.money = 1000;
    const shop: Shop = { money: 0, stock: { [KINDS[BAG_ROOM]]: 3, [KINDS[0]]: 3 }, restockedAt: 0 };
    expect(buyFrom(shop, model.hero, KINDS[BAG_ROOM], 10)).toBe('full');
    expect(model.hero.money).toBe(1000);
    expect(buyFrom(shop, model.hero, KINDS[0], 10)).toBe('bought');
    model.hero.equipment.head = 'leatherCap';
    expect(model.unequip('head')).toBe(false);
    expect(model.hero.equipment.head).toBe('leatherCap');
  });

  it('a bag taken off only if what\'s carried still fits without it; back into the bag', () => {
    const model = fresh();
    model.hero.bag = {};
    addToBag(model.hero.bag, 'leatherSatchel');
    fitBag(model.hero, 'leatherSatchel', 2);
    expect(model.hero.bags[2]).toBe('leatherSatchel');
    fill(model, BAG_ROOM + 3); // (more than the bag alone holds)
    expect(unfitBag(model.hero, 2)).toBe(false);
    fill(model, 5);
    expect(unfitBag(model.hero, 2)).toBe(true);
    expect(model.hero.bags[2]).toBeNull();
    expect(model.hero.bag.leatherSatchel).toBe(1);
  });

  it('the bags fitted are kept in the save; an older save, none', () => {
    const model = fresh();
    model.hero.bags = ['roughSack', null, 'tooledBag', null];
    const again = fresh();
    const saved = parseSave(JSON.stringify(snapshot(model)), model.seed)!;
    restore(again, saved);
    expect(again.hero.bags).toEqual(['roughSack', null, 'tooledBag', null]);
    delete (saved.hero as { bags?: unknown }).bags;
    const older = fresh();
    restore(older, saved);
    expect(older.hero.bags).toEqual([null, null, null, null]);
  });

  it('pedlars sell bags, and buy them back', () => {
    for (const id of BAG_IDS) {
      expect(PEDLAR_WARES).toContain(id);
      expect(pedlarBuys(id)).toBe(true);
    }
  });
});

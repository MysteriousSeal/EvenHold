// The bag's room (hero/bagSlots.ts): 24 slots, and four sockets, each bag fitted six more; a full bag refuses what's
// new (picked up, bought, taken off), not more of what it holds; bags fitted and taken off; kept in the save.

import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { BAG_ROOM, BAG_SOCKETS, ROOM_PER_BAG, bagRoom, canCarry, fitBag, kindsCarried, unfitBag } from '../src/model/hero/bagSlots';
import { BAG_IDS } from '../src/model/loot/bags';
import { JUNK_ITEMS } from '../src/model/loot/junk';
import { ITEM_IDS } from '../src/model/human/equipment';
import { LOOT_IDS } from '../src/model/loot/loot';
import { isBagItem } from '../src/model/loot/bags';
import { addToBag, bagStacks, moveSlot, bagLayout, layoutCounts, moveInBag, slotsUsed, sortedBag, stacksOf, type BagItem } from '../src/model/hero/bag';
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

describe('junk in stacks of twenty', () => {
  it('twenty to a slot, the rest in another: each stack its own slot, the last holding what\'s over', () => {
    const bag = { wolfFang: 45, bread: 30 };
    expect(stacksOf('wolfFang', 45)).toBe(3);
    expect(stacksOf('bread', 30)).toBe(1); // (food: all in one)
    expect(slotsUsed(bag)).toBe(4);
    const layout = bagLayout(bag, [], 6);
    expect(layout.filter((i) => i === 'wolfFang')).toHaveLength(3);
    const counts = layoutCounts(bag, layout);
    expect(layout.map((item, i) => (item === 'wolfFang' ? counts[i] : null)).filter((n) => n !== null)).toEqual([20, 20, 5]);
    expect(counts[layout.indexOf('bread')]).toBe(30);
  });

  it('the bag full, one more junk goes onto a stack with room, not a new one', () => {
    const model = fresh();
    model.hero.bag = {};
    for (const id of [...KINDS.filter((k) => !(k in JUNK_ITEMS)), ...ITEM_IDS].slice(0, BAG_ROOM - 1)) addToBag(model.hero.bag, id); // (all but a slot, no junk)
    const junk = Object.keys(JUNK_ITEMS)[0] as BagItem;
    model.hero.bag[junk] = 19; // (its own slot: the last one)
    expect(kindsCarried(model.hero)).toBe(BAG_ROOM);
    expect(canCarry(model.hero, junk)).toBe(true); // (the 20th: the same stack)
    model.hero.bag[junk] = 20;
    expect(canCarry(model.hero, junk)).toBe(false); // (the 21st: a new stack, no slot for it)
  });

  it('tidied, a thing\'s stacks side by side', () => {
    expect(sortedBag({ wolfFang: 41, bread: 2 })).toEqual(['bread', 'wolfFang', 'wolfFang', 'wolfFang']);
  });

  it('a stack moved stays a stack; the order keeps where each stack sits', () => {
    const bag = { wolfFang: 25 };
    const order = moveInBag(bag, bagLayout(bag, [], 6), 1, 4, 6);
    expect(bagLayout(bag, order, 6)).toEqual(['wolfFang', null, null, null, 'wolfFang', null]);
  });
});

describe('a stack of its own, taken from', () => {
  const junk = Object.keys(JUNK_ITEMS)[0] as BagItem;
  const slotsOf = (model: GameModel) => {
    const { layout, counts } = bagStacks(model.hero.bag, model.hero.bagOrder, model.hero.bagCounts, bagRoom(model.hero));
    return layout.flatMap((item, i) => (item === junk ? [[i, counts[i]]] : []));
  };

  it('dropped from a stack, one off that very stack (not the last of its kind)', () => {
    const model = fresh();
    Object.assign(model.hero, { bag: { [junk]: 45 }, bagOrder: [], bagCounts: [] });
    expect(slotsOf(model)).toEqual([[0, 20], [1, 20], [2, 5]]);
    expect(model.dropFromBag(junk, 0)).toBe(true);
    expect(slotsOf(model)).toEqual([[0, 19], [1, 20], [2, 5]]);
    expect(model.hero.bag[junk]).toBe(44);
    model.dropFromBag(junk, 1);
    expect(slotsOf(model)).toEqual([[0, 19], [1, 19], [2, 5]]);
  });

  it('more of it, onto its stacks with room in order, then a new one; fewer (sold, used), off its last', () => {
    const model = fresh();
    Object.assign(model.hero, { bag: { [junk]: 45 }, bagOrder: [], bagCounts: [] });
    model.dropFromBag(junk, 0); // (19, 20, 5)
    addToBag(model.hero.bag, junk);
    expect(slotsOf(model)).toEqual([[0, 20], [1, 20], [2, 5]]);
    model.hero.bag[junk] = 38; // (six gone of the 44 the slots last told, sold: off the last stack, then the one before)
    expect(slotsOf(model)).toEqual([[0, 19], [1, 19]]);
  });

  it('a stack used up leaves its slot empty; moved, a stack keeps what it holds; kept in the save', () => {
    const model = fresh();
    Object.assign(model.hero, { bag: { [junk]: 21 }, bagOrder: [], bagCounts: [] });
    model.dropFromBag(junk, 1); // (the stack of one: gone)
    expect(slotsOf(model)).toEqual([[0, 20]]);
    model.dropFromBag(junk, 0);
    moveSlot(model.hero, 0, 5, bagRoom(model.hero));
    expect(slotsOf(model)).toEqual([[5, 19]]);
    const again = fresh();
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(slotsOf(again)).toEqual([[5, 19]]);
  });

  it('a full stack and one more picked up: the new stack shows at once, in a free slot, never over another thing\'s', () => {
    const model = fresh();
    Object.assign(model.hero, { bag: { [junk]: 20, bread: 1, apple: 1 }, bagOrder: [junk, null, 'bread', 'apple'], bagCounts: [20, 0, 1, 1] });
    addToBag(model.hero.bag, junk); // (the 21st: picked up)
    const { layout, counts } = bagStacks(model.hero.bag, model.hero.bagOrder, model.hero.bagCounts, bagRoom(model.hero));
    expect(layout.slice(0, 4)).toEqual([junk, junk, 'bread', 'apple']);
    expect(counts.slice(0, 4)).toEqual([20, 1, 1, 1]);
    // (the slot the next thing in order keeps, left for it: a new stack goes past it)
    Object.assign(model.hero, { bag: { [junk]: 21, bread: 1 }, bagOrder: [junk, 'bread'], bagCounts: [20, 1] });
    const again = bagStacks(model.hero.bag, model.hero.bagOrder, model.hero.bagCounts, bagRoom(model.hero));
    expect(again.layout.slice(0, 3)).toEqual([junk, 'bread', junk]);
  });
});

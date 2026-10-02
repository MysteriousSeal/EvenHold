import { describe, expect, it } from 'vitest';
import { BAG_GROUPS, addToBag, groupOf, kindOf, takeFromBag, type Bag, type BagItem } from '../src/model/hero/bag';
import { bagStacks, moveSlot, sortedBag } from '../src/model/hero/bagStacks';

import { ITEM_IDS } from '../src/model/human/equipment';
import { LOOT_IDS } from '../src/model/loot/loot';
import { fresh } from './support/testWorld';

const bagLayout = (bag: Bag, order: Array<BagItem | null>, size: number) => bagStacks(bag, order, undefined, size).layout;

describe('the bag', () => {
  it('holds loot and gear under ids that never clash', () => {
    expect(ITEM_IDS.filter((id) => (LOOT_IDS as string[]).includes(id))).toEqual([]);
    const bag = {};
    addToBag(bag, 'wolfFang');
    addToBag(bag, 'leatherCap');
    addToBag(bag, 'leatherCap');
    expect(bag).toEqual({ wolfFang: 1, leatherCap: 2 });
    expect(takeFromBag(bag, 'leatherCap')).toBe(true);
    expect(takeFromBag(bag, 'wolfFang')).toBe(true);
    expect(takeFromBag(bag, 'wolfFang')).toBe(false);
    expect(bag).toEqual({ leatherCap: 1 });
  });
});

describe('wearing gear from the bag', () => {
  it('equips from the bag, and puts back what was in the slot', () => {
    const model = fresh();
    const { hero } = model;
    addToBag(hero.bag, 'leatherCap');
    addToBag(hero.bag, 'maskedHood');
    expect(model.equipFromBag('leatherCap')).toBe(true);
    expect(hero.equipment.head).toBe('leatherCap');
    expect(hero.bag).toEqual({ maskedHood: 1 });
    expect(model.equipFromBag('maskedHood')).toBe(true);
    expect(hero.equipment.head).toBe('maskedHood');
    expect(hero.bag).toEqual({ leatherCap: 1 }); // swapped back in
    expect(model.equipFromBag('gambeson')).toBe(false); // not carried
  });

  it('unequips into the bag', () => {
    const model = fresh();
    const { hero } = model;
    hero.equipment.mainHand = 'armingSword';
    expect(model.unequip('mainHand')).toBe(true);
    expect(hero.equipment).toEqual({});
    expect(hero.bag).toEqual({ armingSword: 1 });
    expect(model.unequip('mainHand')).toBe(false);
  });

  it('puts worn gear on the ground, to be picked up again into the bag', () => {
    const model = fresh();
    const { hero } = model;
    hero.equipment.head = 'leatherCap';
    expect(model.dropEquipped('head')).toBe(true);
    expect(hero.equipment.head).toBeUndefined();
    expect(hero.bag).toEqual({});
    expect(model.loot.map((l) => l.item)).toEqual(['leatherCap']);
    expect(model.pickUp()).toBe('leatherCap');
    expect(hero.bag).toEqual({ leatherCap: 1 });
    expect(model.dropEquipped('head')).toBe(false);
  });
});

describe('bag order', () => {
  it('keeps each thing in its slot: new things fill the first gap, gone things leave theirs empty', () => {
    const bag: Bag = { wolfFang: 1, bread: 2 };
    expect(bagLayout(bag, [], 4)).toEqual(['wolfFang', 'bread', null, null]);
    expect(bagLayout(bag, [null, 'bread', null, 'wolfFang'], 4)).toEqual([null, 'bread', null, 'wolfFang']); // where they were put
    expect(bagLayout({ ...bag, ale: 1 }, [null, 'bread', null, 'wolfFang'], 4)).toEqual(['ale', 'bread', null, 'wolfFang']); // the new one in the first gap
    expect(bagLayout({ bread: 2 }, [null, 'bread', null, 'wolfFang'], 4)).toEqual([null, 'bread', null, null]); // the fang's gone
  });

  it('moves a thing to another slot, swapping with what was there', () => {
    const bag: Bag = { wolfFang: 1, bread: 2, ale: 1 };
    const moved = (to: number) => {
      const hero = { bag, bagOrder: bagLayout(bag, [], 4), bagCounts: [] as number[] }; // fang, bread, ale, -
      moveSlot(hero, 0, to, 4);
      return bagLayout(bag, hero.bagOrder, 4);
    };
    expect(moved(3)).toEqual([null, 'bread', 'ale', 'wolfFang']); // into the empty slot
    expect(moved(2)).toEqual(['ale', 'bread', 'wolfFang', null]); // swapped
  });
});

describe('tidying the bag', () => {
  it('packs it from the first slot: gear head to toe then held, food and drink, ingredients, quest items, junk last; alike by name', () => {
    const bag: Bag = { wolfFang: 2, rustyBuckle: 1, bread: 3, ale: 1, rawBoarMeat: 1, alphaFang: 1, shortSword: 1, nasalCap: 1, leatherBoots: 1, apple: 0 };
    expect(sortedBag(bag)).toEqual(['nasalCap', 'leatherBoots', 'shortSword', 'ale', 'bread', 'rawBoarMeat', 'alphaFang', 'rustyBuckle', 'wolfFang']);
  });
});

describe('the bag\'s groups', () => {
  it('every thing in one of them, each group with something in it; its kind said one way', () => {
    const all = [...LOOT_IDS, ...ITEM_IDS];
    for (const item of all) expect(BAG_GROUPS.map((g) => g.group), item).toContain(groupOf(item));
    for (const { group } of BAG_GROUPS) expect(all.some((item) => groupOf(item) === group), group).toBe(true);
    expect(kindOf('rawBoarMeat')).toBe('Cooking ingredient');
  });
});

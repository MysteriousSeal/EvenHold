import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { addToBag, takeFromBag } from '../src/model/bag';
import { ITEM_IDS } from '../src/model/human/equipment';
import { LOOT_IDS } from '../src/model/loot/loot';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const fresh = () => new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);

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
});

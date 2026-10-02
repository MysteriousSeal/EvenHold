// Potions (loot/potions.ts, hero/bag.ts drinkPotion): drunk at once for their
// share of the hero's most, standing, then a wait before another; on the
// action bar; sold by pedlars and the villages' herbalists (each at home in
// a house of their village), who buy potions and ingredients back.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { drinkPotion } from '../src/model/hero/bag';
import { recover } from '../src/model/hero/heroStats';
import { maxEnergyOf, maxHpOf } from '../src/model/hero/attributes';
import { POTIONS, POTION_COOLDOWN, POTION_IDS, potionText } from '../src/model/loot/potions';
import { LOOT_QUALITY } from '../src/model/loot/loot';
import { setAction, useAction, readActionBar } from '../src/model/hero/actionBar';
import { PEDLAR_WARES, pedlarBuys } from '../src/model/travellers/pedlarShop';
import { buyFromHerbalist, herbalistBuys, herbalistShopAt, sellToHerbalist } from '../src/model/herbalist/herbalistShop';
import { visitHerbalist } from '../src/model/cheats';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const fresh = () => new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);

describe('potions', () => {
  it('six, of their own quality; each says what it gives', () => {
    expect(POTION_IDS).toHaveLength(6);
    for (const id of POTION_IDS) expect(LOOT_QUALITY[id]).toBe('potion');
    expect(potionText('minorHealthPotion')).toBe('Restores 25% health at once');
    expect(potionText('greaterEnergyPotion')).toBe('Restores 70% energy at once');
  });

  it('drunk at once for their share, standing; then none till the wait is over, any', () => {
    const { hero } = fresh();
    Object.assign(hero, { hp: 1, energy: 1, bag: { lesserHealthPotion: 2, minorEnergyPotion: 1 } });
    expect(drinkPotion(hero, 'lesserHealthPotion')).toBe(true);
    expect(hero.hp).toBeCloseTo(Math.min(maxHpOf(hero), 1 + POTIONS.lesserHealthPotion.heal * maxHpOf(hero)), 5);
    expect(hero.eating ?? null).toBeNull(); // (not sat down to it)
    expect(drinkPotion(hero, 'minorEnergyPotion')).toBe(false); // (the wait: any potion)
    expect(hero.bag.minorEnergyPotion).toBe(1);
    for (let t = 0; t < POTION_COOLDOWN; t += 1) recover(hero, 1, false, true);
    expect(drinkPotion(hero, 'minorEnergyPotion')).toBe(true);
    expect(hero.energy).toBeCloseTo(Math.min(maxEnergyOf(hero), 1 + 0.25 * maxEnergyOf(hero)), 5);
    expect(drinkPotion(hero, 'bread')).toBe(false); // (not a potion)
  });

  it('on the action bar, used from it; kept in the save\'s reading', () => {
    const { hero } = fresh();
    hero.bag = { minorHealthPotion: 1 };
    expect(setAction(hero, 0, 'minorHealthPotion')).toBe(true);
    hero.hp = 1;
    expect(useAction(hero, 0)).toBe(true);
    expect(hero.hp).toBeGreaterThan(1);
    expect(readActionBar(['greaterEnergyPotion'])[0]).toBe('greaterEnergyPotion');
  });

  it('pedlars carry them, and buy them back', () => {
    for (const id of POTION_IDS) {
      expect(PEDLAR_WARES).toContain(id);
      expect(pedlarBuys(id)).toBe(true);
    }
  });
});

describe('herbalists', () => {
  it('one in each village with a house, at home in one of its houses', () => {
    const model = fresh();
    const herbalists = model.npcs.filter((n) => n.role === 'herbalist');
    expect(herbalists.length).toBeGreaterThan(0);
    expect(herbalists.length).toBeLessThanOrEqual(model.villages.length);
    for (const h of herbalists) {
      expect(h.home.type).toBe('house');
      expect(h.where).toBe(h.home);
    }
    expect(new Set(herbalists.map((h) => h.village)).size).toBe(herbalists.length);
  });

  it('sell every potion; buy potions and ingredients back, not junk', () => {
    const model = fresh();
    const herbalist = model.npcs.find((n) => n.role === 'herbalist')!;
    const shop = herbalistShopAt(model.shops, model.seed, herbalist);
    for (const id of POTION_IDS) expect(shop.stock[id] ?? 0).toBeGreaterThan(0);
    model.hero.money = 1000;
    expect(buyFromHerbalist(shop, model.hero, 'minorHealthPotion')).toBe('bought');
    expect(model.hero.bag.minorHealthPotion).toBe(1);
    expect(herbalistBuys('rawWolfMeat')).toBe(true);
    expect(herbalistBuys('wolfFang')).toBe(false);
    model.hero.bag.rawWolfMeat = 1;
    expect(sellToHerbalist(shop, model.hero, 'rawWolfMeat')).toBe('sold');
  });

  it('a cheat goes into the nearest one\'s house', () => {
    const model = fresh();
    expect(visitHerbalist(model, new Set())).toBe(true);
    const there = model.npcs.find((n) => n.role === 'herbalist' && n.home === model.inside?.entrance);
    expect(there).toBeDefined();
  });
});

import { describe, expect, it } from 'vitest';
import { PROVISIONS } from '../src/model/loot/provisions';
import { GameModel } from '../src/model/GameModel';
import { RESTOCK_EVERY, buy, buyPrice, restockAll, restockIn, sell, sellPrice, shopAt } from '../src/model/inn/tavernShop';
import { maxHpAt } from '../src/model/hero/heroStats';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const setup = () => {
  const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
  const shop = shopAt(model.shops, model.seed, 0, 0);
  return { model, shop, hero: model.hero };
};

describe("the barmaid's shop", () => {
  it('sells food and drink: the price from the hero to her, one fewer in stock', () => {
    const { shop, hero } = setup();
    hero.money = 100;
    const [money, stock] = [shop.money, shop.stock.bread!];
    expect(buy(shop, hero, 'bread')).toBe('bought');
    expect(hero.money).toBe(100 - buyPrice('bread'));
    expect(shop.money).toBe(money + buyPrice('bread'));
    expect(shop.stock.bread).toBe(stock - 1);
    expect(hero.bag.bread).toBe(1);
    hero.money = 0;
    expect(buy(shop, hero, 'wine')).toBe('too poor');
    shop.stock.ale = 0;
    hero.money = 100;
    expect(buy(shop, hero, 'ale')).toBe('sold out');
  });

  it('buys food and drink back at half, while she has the coin; nothing else', () => {
    const { shop, hero } = setup();
    hero.bag = { roastLeg: 2, wolfFang: 1 };
    const money = shop.money;
    expect(sell(shop, hero, 'roastLeg')).toBe('sold');
    expect(hero.money).toBe(sellPrice('roastLeg'));
    expect(sellPrice('roastLeg')).toBe(Math.floor(buyPrice('roastLeg') / 2));
    expect(shop.money).toBe(money - sellPrice('roastLeg'));
    expect(sell(shop, hero, 'wolfFang')).toBe('not wanted');
    shop.money = 0;
    expect(sell(shop, hero, 'roastLeg')).toBe('she is short');
    expect(hero.bag.roastLeg).toBe(1);
  });

  it('restocks slowly as time passes, never past her usual', () => {
    const { model, shop } = setup();
    const usual = shop.stock.cheese!;
    shop.stock.cheese = 0;
    shop.money = 0;
    const later = shopAt(model.shops, model.seed, 0, 2 * RESTOCK_EVERY); // two restocks on
    expect(later.stock.cheese).toBe(Math.min(usual, 2));
    expect(later.money).toBeGreaterThan(0);
    expect(shopAt(model.shops, model.seed, 0, 600 * RESTOCK_EVERY).stock.cheese).toBe(usual);
  });

  it('lets the hero eat and drink from the bag: food for health, drink for energy', () => {
    const { model, hero } = setup();
    hero.bag = { meatPie: 1, ale: 1 };
    Object.assign(hero, { hp: 1, energy: 1 });
    expect(model.consume('meatPie')).toBe(true);
    expect(hero.hp).toBe(Math.min(maxHpAt(hero.level), 1 + PROVISIONS.meatPie.heal!));
    expect(hero.bag.meatPie).toBeUndefined();
    expect(model.consume('meatPie')).toBe(false);
    expect(model.consume('ale')).toBe(true);
    expect(hero.energy).toBe(1 + PROVISIONS.ale.energy!);
  });

  it("tells how long until she restocks (the countdown for what she's sold out of)", () => {
    const { model, shop } = setup(); // restocked at 0
    expect(restockIn(shop, 18_000)).toBe(RESTOCK_EVERY - 18_000);
    expect(restockIn(shop, RESTOCK_EVERY)).toBe(0);
    shopAt(model.shops, model.seed, 0, RESTOCK_EVERY); // a restock...
    expect(restockIn(shop, RESTOCK_EVERY)).toBe(RESTOCK_EVERY); // ...and the next one five minutes on
  });

  it('restocks every barmaid at once (a cheat): wares and purse back to her usual', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const shop = shopAt(model.shops, model.seed, 0, 0);
    const [usualAle, usualMoney] = [shop.stock.ale, shop.money];
    shop.stock.ale = 0;
    shop.money = 1;
    expect(restockAll(model.shops, model.seed, 5)).toBe(1);
    expect([shop.stock.ale, shop.money]).toEqual([usualAle, usualMoney]);
  });
});

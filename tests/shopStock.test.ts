import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { BUYBACK, RESTOCK_EVERY, buyBack, buyFrom, openShop, restockIn, sellTo, type Shop } from '../src/model/shops/shopStock';
import { restockAll, shopAt } from '../src/model/inn/tavernShop';
import { SMITH_WARES, gearPrice, gearSellPrice, sellGear, smithBuys, smithShopAt } from '../src/model/smithy/smithShop';
import { ITEMS, ITEM_IDS } from '../src/model/human/equipment';
import { parseSave, restore, snapshot } from '../src/model/save';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const hero = () => new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE).hero;

describe('a shop', () => {
  it('opens at its usual stock and purse, and comes back toward them a step each restock, never past', () => {
    const shops = new Map<number, Shop>();
    const usual = { money: 500, stock: { ale: 3 } };
    const shop = openShop(shops, 7, usual, 0);
    expect(shop).toEqual({ money: 500, stock: { ale: 3 }, restockedAt: 0 });
    expect(openShop(shops, 7, usual, 0)).toBe(shop); // the same shop, kept by its door
    Object.assign(shop, { money: 100, stock: { ale: 0 } });
    openShop(shops, 7, usual, RESTOCK_EVERY * 2); // two restocks
    expect(shop.stock.ale).toBe(2); // one of each a restock
    expect(shop.money).toBeGreaterThan(100); // drifting back
    expect(shop.money).toBeLessThan(500);
    openShop(shops, 7, usual, RESTOCK_EVERY * 50);
    expect(shop.stock.ale).toBe(3); // never past its usual
  });

  it('tells how long till its next restock', () => {
    const shop = openShop(new Map(), 1, { money: 0, stock: {} }, 1000);
    expect(restockIn(shop, 1000)).toBe(RESTOCK_EVERY);
    expect(restockIn(shop, 1000 + RESTOCK_EVERY + 5)).toBe(0);
  });

  it('sells what it has to a hero who can pay, and buys what they have while its purse holds', () => {
    const h = hero();
    const shop: Shop = { money: 10, stock: { ale: 1 }, restockedAt: 0 };
    h.money = 2;
    expect(buyFrom(shop, h, 'ale', 3)).toBe('too poor');
    h.money = 5;
    expect(buyFrom(shop, h, 'ale', 3)).toBe('bought');
    expect([h.money, shop.money, shop.stock.ale, h.bag.ale]).toEqual([2, 13, 0, 1]);
    expect(buyFrom(shop, h, 'ale', 3)).toBe('sold out');
    expect(sellTo(shop, h, 'bread', 1)).toBe('none'); // they've none
    shop.money = 0;
    expect(sellTo(shop, h, 'ale', 1)).toBe('short'); // its purse empty
    shop.money = 5;
    expect(sellTo(shop, h, 'ale', 1)).toBe('sold');
    expect([h.money, shop.money, shop.stock.ale, h.bag.ale ?? 0]).toEqual([3, 4, 1, 0]);
  });

  it('keeps the last sales, latest first, to be bought back at what they fetched', () => {
    const h = hero();
    const shop: Shop = { money: 1_000, stock: {}, restockedAt: 0 };
    h.bag.ale = BUYBACK + 2;
    for (let i = 0; i < BUYBACK + 2; i++) sellTo(shop, h, 'ale', i + 1); // each a copper dearer
    expect(shop.buyback!.map((s) => s.price)).toEqual(Array.from({ length: BUYBACK }, (_, i) => BUYBACK + 2 - i)); // only the last BUYBACK
    const money = h.money;
    h.money = 0;
    expect(buyBack(shop, h, 0)).toBe('too poor');
    h.money = money;
    expect(buyBack(shop, h, 0)).toBe('bought');
    expect([h.money, h.bag.ale, shop.stock.ale, shop.buyback!.length]).toEqual([money - (BUYBACK + 2), 1, BUYBACK + 1, BUYBACK - 1]);
    expect(buyBack(shop, h, 99)).toBe('none');
  });

  it('stacks the same thing sold at the same price, to the front, and buys the stack back whole', () => {
    const h = hero();
    const shop: Shop = { money: 1_000, stock: {}, restockedAt: 0 };
    h.bag.wolfFang = 3;
    h.bag.ale = 1;
    sellTo(shop, h, 'wolfFang', 3);
    sellTo(shop, h, 'ale', 1);
    sellTo(shop, h, 'wolfFang', 3);
    sellTo(shop, h, 'wolfFang', 3);
    expect(shop.buyback).toEqual([{ id: 'wolfFang', price: 3, count: 3 }, { id: 'ale', price: 1, count: 1 }]);
    h.money = 8;
    expect(buyBack(shop, h, 0)).toBe('too poor'); // 9 for the three
    h.money = 9;
    expect(buyBack(shop, h, 0)).toBe('bought');
    expect([h.money, h.bag.wolfFang, shop.stock.wolfFang, shop.buyback!.length]).toEqual([0, 3, 0, 1]);
  });

  it('keeps what can be bought back in a save, dropping what the game no longer knows', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const shop = smithShopAt(model.shops, model.seed, 0);
    shop.buyback = [{ id: 'wolfFang', price: 3, count: 4 }, { id: SMITH_WARES[0], price: 40, count: 1 }];
    const data = JSON.parse(JSON.stringify(snapshot(model)));
    data.shops[0].buyback.push({ id: 'ancientRelic', price: 9 }); // gone from the game since
    const again = new GameModel(model.seed, TEST_MAP_SIZE);
    restore(again, parseSave(JSON.stringify(data), model.seed)!);
    expect(smithShopAt(again.shops, again.seed, 0).buyback).toEqual([{ id: 'wolfFang', price: 3, count: 4 }, { id: SMITH_WARES[0], price: 40, count: 1 }]);
  });
});

describe("the smith's shop", () => {
  it('sells each ware at its value and buys at half; gear with no value, cheap', () => {
    expect(SMITH_WARES.length).toBeGreaterThan(20);
    for (const id of SMITH_WARES) {
      expect(gearPrice(id)).toBe(ITEMS[id].value);
      expect(gearSellPrice(id)).toBe(Math.floor(ITEMS[id].value! / 2));
    }
    const plain = ITEM_IDS.find((id) => !ITEMS[id].value && smithBuys(id))!;
    expect(gearSellPrice(plain)).toBeLessThan(gearSellPrice('breastplate'));
    expect(gearSellPrice(plain)).toBeGreaterThan(0);
  });

  it("won't take food, drink or jewellery", () => {
    const h = hero();
    const shop: Shop = { money: 1000, stock: {}, restockedAt: 0 };
    h.bag.ale = 1;
    h.bag.copperRing = 1;
    expect(sellGear(shop, h, 'ale')).toBe('not wanted');
    expect(sellGear(shop, h, 'copperRing')).toBe('not wanted');
    expect(smithBuys('woodenCharm')).toBe(false);
    expect(smithBuys('dagger')).toBe(true);
  });

  it("is kept apart from the inn's: its own wares, left be by the inns' restock, both in the save", () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const [inn, smithy] = ['inn', 'smithy'].map((t) => model.entrances.findIndex((e) => e.type === t));
    const tavern = shopAt(model.shops, model.seed, inn);
    const forge = smithShopAt(model.shops, model.seed, smithy);
    expect(Object.keys(tavern.stock)).toContain('ale');
    expect(Object.keys(forge.stock).every((id) => id in ITEMS)).toBe(true);
    forge.money = 1;
    tavern.money = 1;
    expect(restockAll(model.shops, model.seed)).toBe(1); // the inn's only
    expect(forge.money).toBe(1);
    expect(tavern.money).toBeGreaterThan(1);
    const again = new GameModel(model.seed, TEST_MAP_SIZE);
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(again.shops.get(smithy)?.money).toBe(1);
    expect(Object.keys(again.shops.get(smithy)!.stock)).toEqual(Object.keys(forge.stock));
  });
});

// Trading with the smith, at its edges (smithy/smithShop.ts, hero/wear.ts).
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { TEST_MAP_SIZE, fresh } from './support/testWorld';
import { buyGear, gearPrice, gearSellPrice, sellGear, smithAsks, smithShopIn } from '../src/model/smithy/smithShop';
import { gearKey, isGear, levelOf, type GearKey } from '../src/model/human/items/gear';
import { RESTOCK_EVERY, buyBack } from '../src/model/shops/shopStock';
import { mendBill, mendCost, wearOf } from '../src/model/hero/wear';
import { isCrafted } from '../src/model/skills/salvage';

const atSmith = () => {
  const model = fresh();
  const smithy = model.entrances.find((e) => e.type === 'smithy')!;
  model.teleport(smithy.x, smithy.z);
  model.useDoor();
  return model;
};

describe('trading with the smith', () => {
  it("doesn't keep a found piece he's sold on as a ware forever sold out: one that won't come back is off his wall", () => {
    const model = atSmith();
    const found = gearKey({ item: 'mace', level: 4, rarity: 'common', roll: 7 });
    model.hero.bag[found] = 1;
    model.hero.money = 10_000;
    expect(sellGear(smithShopIn(model), model.hero, found)).toBe('sold');
    expect(buyGear(smithShopIn(model), model.hero, found)).toBe('bought');
    const later = Date.now() + 3 * RESTOCK_EVERY;
    expect(found in smithShopIn(model, later).stock).toBe(false);
  });

  it("has none of his wares forever sold out: what he's one short of is a piece he keeps two of", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const model = new GameModel(seed, TEST_MAP_SIZE);
      const smithy = model.entrances.find((e) => e.type === 'smithy')!;
      model.teleport(smithy.x, smithy.z);
      model.useDoor();
      const later = Date.now() + 3 * RESTOCK_EVERY;
      expect(Object.entries(smithShopIn(model, later).stock).filter(([, n]) => !n)).toEqual([]);
    }
  });

  it("sells the hero a fresh piece, not the wear of the one like it they sold him", () => {
    const model = atSmith();
    const shop = smithShopIn(model);
    const ware = (Object.keys(shop.stock) as string[]).find((k) => isGear(k) && (shop.stock[k as GearKey] ?? 0) > 0)!;
    model.hero.money = 100_000;
    model.hero.level = 20;
    expect(buyGear(shop, model.hero, ware as GearKey)).toBe('bought');
    model.hero.wear = { [ware]: 100 }; // (worn to bits, and taken off)
    expect(sellGear(shop, model.hero, ware)).toBe('sold');
    expect(wearOf(model.hero, ware)).toBe(0); // (gone with it, and bought back as it was: no mending for nothing)
    expect(buyBack(shop, model.hero, 0)).toBe('bought');
    expect(wearOf(model.hero, ware)).toBe(100);
    expect(sellGear(shop, model.hero, ware)).toBe('sold');
    expect(buyGear(shop, model.hero, ware as GearKey)).toBe('bought');
    expect(wearOf(model.hero, ware)).toBe(0);
  });

  it('mends what the hero carries as well as what they wear', () => {
    const model = atSmith();
    model.hero.bag.mace = 1;
    model.hero.wear = { mace: 100 };
    expect(mendBill(model.hero).pieces.map((p) => p.key)).toEqual(['mace']);
  });

  it("keeps back a piece as dear as his heavy work, uncommon, as he keeps that back: by its worth, not its kind's", () => {
    const uncommon = gearKey({ item: 'gauntlets', level: 1, rarity: 'uncommon', roll: 58 });
    expect(gearPrice(uncommon)).toBeGreaterThanOrEqual(gearPrice('chainMail'));
    expect(smithAsks(uncommon)).toBeGreaterThanOrEqual(smithAsks('chainMail'));
    expect(smithAsks(gearKey({ item: 'dagger', level: 9, rarity: 'common', roll: 1 }))).toBe(1); // (a dagger of any level, a dagger)
  });

  it('pays for a worn piece its price less its mending, never under its scrap', () => {
    const model = atSmith();
    const { hero } = model;
    hero.bag.mailCoif = 1;
    const whole = gearSellPrice('mailCoif', hero);
    hero.wear = { mailCoif: 40 };
    expect(gearSellPrice('mailCoif', hero)).toBe(whole - mendCost(hero, 'mailCoif'));
    hero.wear = { dagger: 100 };
    expect(gearSellPrice('dagger', hero)).toBe(10); // (a broken dagger: its scrap)
  });

  it("forges one of each piece: once the hero's outgrown his village, at their level only", () => {
    const model = atSmith();
    smithShopIn(model);
    model.hero.level = 9;
    const levels = new Set(Object.keys(smithShopIn(model).stock).filter(isGear).map(levelOf));
    expect([...levels]).toEqual([8]);
  });

  it('has a purse to match his forging: dearer wares, more coin to buy with', () => {
    const model = atSmith();
    const low = smithShopIn(model).money;
    const later = new GameModel(model.seed, TEST_MAP_SIZE);
    const smithy = later.entrances.find((e) => e.type === 'smithy')!;
    later.teleport(smithy.x, smithy.z);
    later.useDoor();
    later.hero.level = 9;
    expect(smithShopIn(later).money).toBe(Math.round(low * (1 + 7 * 0.15)));
  });

  it("keeps back a piece by what it's worth, at its own level and rarity", () => {
    const dagger = gearKey({ item: 'dagger', level: 1, rarity: 'common', roll: 1 });
    expect(smithAsks(dagger)).toBe(1);
    const keen = gearKey({ item: 'armingSword', level: 8, rarity: 'common', roll: 1 });
    expect(gearPrice(keen)).toBeGreaterThanOrEqual(240);
    expect(smithAsks(keen)).toBe(7);
  });

  it("can't be bought twice: a piece sold him and bought off his wall is no longer to buy back", () => {
    const model = atSmith();
    const found = gearKey({ item: 'mace', level: 4, rarity: 'common', roll: 7 });
    model.hero.bag[found] = 1;
    model.hero.money = 100_000;
    model.hero.level = 20;
    const shop = smithShopIn(model);
    expect(sellGear(shop, model.hero, found)).toBe('sold');
    expect(buyGear(shop, model.hero, found)).toBe('bought');
    expect(shop.buyback ?? []).toEqual([]);
  });

  it('keeps the wear of a piece sold him with it: bought back, it comes as it went', () => {
    const model = atSmith();
    model.hero.bag.mailCoif = 1;
    model.hero.wear = { mailCoif: 60 };
    const shop = smithShopIn(model);
    shop.money = 100_000;
    model.hero.money = 100_000;
    expect(sellGear(shop, model.hero, 'mailCoif')).toBe('sold');
    expect(wearOf(model.hero, 'mailCoif')).toBe(0); // (gone from the hero)
    expect(buyBack(shop, model.hero, 0)).toBe('bought');
    expect(wearOf(model.hero, 'mailCoif')).toBe(60);
  });

  it("pays an eighth for a wooden piece the hero made, half for one found or his own forging; the mark of their make sold with it, and back with it bought back", () => {
    const model = atSmith();
    const { hero } = model;
    const spear = gearKey({ item: 'spear', level: 15, rarity: 'common', roll: 0 }); // (a woodworker's make, and his)
    expect(gearSellPrice(spear, hero)).toBeGreaterThan(gearPrice(spear) / 3); // found: half
    hero.bag[spear] = 1;
    hero.crafted = { [spear]: 1 };
    const made = gearSellPrice(spear, hero);
    expect(made).toBeLessThan(gearPrice(spear) / 6); // made: an eighth
    expect(gearSellPrice(gearKey({ item: 'pavise', level: 3, rarity: 'common', roll: 9 }), hero)).toBeGreaterThan(gearPrice(gearKey({ item: 'pavise', level: 3, rarity: 'common', roll: 9 })) / 3); // (his own: half)
    const shop = smithShopIn(model);
    shop.money = 100_000;
    hero.money = 100_000;
    expect(sellGear(shop, hero, spear)).toBe('sold');
    expect(hero.money).toBe(100_000 + made);
    expect(isCrafted(hero, spear)).toBe(false); // (gone with it: a spear found later, found)
    expect(buyBack(shop, hero, 0)).toBe('bought');
    expect(isCrafted(hero, spear)).toBe(true);
  });
});

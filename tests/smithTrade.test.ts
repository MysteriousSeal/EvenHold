// Trading with the smith, at its edges (smithy/smithShop.ts, hero/wear.ts).
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { TEST_MAP_SIZE, fresh } from './support/testWorld';
import { buyGear, gearPrice, sellGear, smithAsks, smithShopIn } from '../src/model/smithy/smithShop';
import { gearKey, isGear, levelOf, type GearKey } from '../src/model/human/items/gear';
import { RESTOCK_EVERY, buyBack } from '../src/model/shops/shopStock';
import { mendBill, wearOf } from '../src/model/hero/wear';

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

  it("drops his village's wares the hero's outgrown once they're sold out, as they'll not be forged again", () => {
    const model = atSmith();
    smithShopIn(model); // (first seen at level 1)
    model.hero.level = 9;
    const shop = smithShopIn(model);
    const old: string[] = Object.keys(shop.stock).filter(isGear).filter((k) => levelOf(k) !== 8);
    expect(old.length).toBeGreaterThan(0);
    for (const key of old) shop.stock[key as never] = 0;
    const later = Date.now() + 3 * RESTOCK_EVERY;
    expect(Object.keys(smithShopIn(model, later).stock).filter((k) => old.includes(k))).toEqual([]);
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
    expect(wearOf(model.hero, ware)).toBe(100); // (sold, and bought back as it was: no mending for nothing)
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
});

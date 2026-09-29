import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { enterNearest } from '../src/model/cheats';
import { buyPrice, shopAt } from '../src/model/npcs/tavernShop';
import { maxHpAt } from '../src/model/hero/heroStats';
import { callForAle, orderAle, orderLabel } from '../src/controller/barOrder';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

// In the nearest inn, as if sat at the bar.
const atTheInn = () => {
  const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
  enterNearest(model, 'inn', new Set());
  expect(model.inside?.entrance.type).toBe('inn');
  return model;
};

describe('an ale at the bar', () => {
  it('is poured from her stock, paid for, and drunk on the spot', () => {
    const model = atTheInn();
    const shop = shopAt(model.shops, model.seed, model.entrances.indexOf(model.inside!.entrance));
    const stock = shop.stock.ale!;
    model.hero.money = 100;
    model.hero.hp = 1;
    expect(orderLabel(model)).toEqual({ label: `Order an ale · ${buyPrice('ale')} copper`, soldOut: false });
    expect(orderAle(model).drank).toBe(true);
    expect(shop.stock.ale).toBe(stock - 1);
    expect(model.hero.money).toBe(100 - buyPrice('ale'));
    expect(model.hero.hp).toBeGreaterThan(1);
    expect(model.hero.hp).toBeLessThanOrEqual(maxHpAt(model.hero.level));
    expect(model.hero.bag.ale ?? 0).toBe(0); // drunk, not carried off
  });

  it("is called for first: she says she's coming, and nothing's paid till she pours", () => {
    const model = atTheInn();
    model.hero.money = 100;
    expect(callForAle(model).coming).toBe(true);
    expect(model.hero.money).toBe(100);
    model.hero.money = 0;
    expect(callForAle(model).coming).toBe(false); // too poor: she says so at once
  });

  it("isn't, without the coin, or with the barrel dry", () => {
    const model = atTheInn();
    const shop = shopAt(model.shops, model.seed, model.entrances.indexOf(model.inside!.entrance));
    model.hero.money = 0;
    expect(orderAle(model).drank).toBe(false);
    model.hero.money = 100;
    shop.stock.ale = 0;
    expect(orderLabel(model).soldOut).toBe(true);
    expect(orderAle(model)).toMatchObject({ drank: false });
    expect(model.hero.money).toBe(100);
  });
});

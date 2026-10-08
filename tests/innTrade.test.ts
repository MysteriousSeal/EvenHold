// The inn's trade in a woodworker's cups (inn/tavernShop.ts INN_PAYS): bought at her standing price, over the junk one;
// those sold her stock her cupboard, out on the shelves for a barkeep's shift there (jobs/work.ts); and her orders on
// the village's board (quests.ts ORDERS): so many cups, no foes to it, paid her price and over on handing them in.
import { describe, expect, it } from 'vitest';
import { INN_PAYS, sell, shopAt } from '../src/model/inn/tavernShop';
import { sellValue } from '../src/model/shops/sellValue';
import { doorNumber } from '../src/model/interiors/interiors';
import { CUPBOARD_OUT } from '../src/model/jobs/work';
import type { BarShift } from '../src/model/jobs/barShift';
import { OFFERS, isOrder, questTitle } from '../src/model/quests/quests';
import { fresh } from './support/testWorld';

describe("the inn's cups", () => {
  it('buys carved tankards and wooden bowls at her standing price, well over the junk one, and keeps them', () => {
    const model = fresh();
    const inn = model.entrances.find((e) => e.type === 'inn')!;
    const shop = shopAt(model.shops, model.seed, doorNumber(inn));
    shop.money = 1000;
    model.hero.bag.carvedTankard = 2;
    const money = model.hero.money;
    expect(INN_PAYS.carvedTankard).toBeGreaterThan(sellValue('carvedTankard')!);
    expect(sell(shop, model.hero, 'carvedTankard')).toBe('sold');
    expect(model.hero.money).toBe(money + INN_PAYS.carvedTankard);
    expect(shop.stock.carvedTankard).toBe(1);
    expect(sell(shop, model.hero, 'bentSpoon')).toBe('not wanted'); // (junk still: the junk price, elsewhere)
  });

  it("stocks a barkeep's shift with her tankards, so many at most, and they're hers no longer after", () => {
    const model = fresh();
    const inn = model.entrances.find((e) => e.type === 'inn')!;
    const shop = shopAt(model.shops, model.seed, doorNumber(inn));
    shop.stock.carvedTankard = CUPBOARD_OUT + 2;
    model.teleport(inn.x, inn.z);
    model.useDoor();
    expect(model.work.start(inn, 'innBarkeep')).toBe(true);
    const shift = model.work.shift as BarShift;
    expect(shift.clean.ale).toBe(6 + CUPBOARD_OUT);
    expect(shop.stock.carvedTankard).toBe(2);
  });
});

describe("the inn's orders", () => {
  it('are every third notice on a board: so many cups, no foes gathered, done once carried, paid her price and over', () => {
    const model = fresh();
    const offers = model.quests.offersAt(0);
    const orders = offers.filter((q) => isOrder(q.item));
    expect(orders.length).toBe(Math.floor(OFFERS / 3));
    const [order] = orders;
    expect(questTitle(order)).toMatch(/^Bring \d+ (carved tankards|wooden bowls)$/);
    expect(order.copper).toBeGreaterThan(INN_PAYS[order.item as keyof typeof INN_PAYS] * order.count);
    expect(model.quests.accept(order)).toBe(true);
    model.quests.update(120);
    expect(model.enemies.some((e) => e.quest === order.key)).toBe(false); // (nothing to slay)
    expect(model.quests.done(model.quests.takenOf(order.key)!)).toBe(false);
    model.hero.bag[order.item as 'carvedTankard'] = order.count;
    expect(model.quests.done(model.quests.takenOf(order.key)!)).toBe(true);
    const money = model.hero.money;
    expect(model.quests.handIn(order.key)).toBe(true);
    expect(model.hero.money).toBe(money + order.copper);
    expect(model.hero.bag[order.item as 'carvedTankard']).toBeUndefined(); // (handed over)
  });
});

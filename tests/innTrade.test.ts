// The inn's trade in a woodworker's cups (inn/tavernShop.ts INN_WANTS): bought at her standing price, over the junk one;
// those sold her stock her cupboard, out on the shelves for a barkeep's shift there (jobs/work.ts); and her orders on
// the village's board (quests.ts orderAt, by the same table): so many cups, no foes to it, paid her price and over on handing them in.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { INN_WANTS, sell, shopAt, innWants, type InnWant, cupboardWords } from '../src/model/inn/tavernShop';
import { Cupboard, MUGS_A_SHELF } from '../src/view/interior/cupboard';
import { sellValue } from '../src/model/shops/sellValue';
import { doorNumber } from '../src/model/interiors/interiors';
import { CUPBOARD_OUT } from '../src/model/jobs/work';
import { takeStock } from '../src/model/shops/shopStock';
import type { BarShift } from '../src/model/jobs/barShift';
import { OFFERS, questTitle } from '../src/model/quests/quests';
import { fresh } from './support/testWorld';

describe("the inn's cups", () => {
  it('buys carved tankards and wooden bowls at her standing price, well over the junk one, and keeps them', () => {
    const model = fresh();
    const inn = model.entrances.find((e) => e.type === 'inn')!;
    const shop = shopAt(model.shops, model.seed, doorNumber(inn));
    shop.money = 1000;
    model.hero.bag.carvedTankard = 2;
    const money = model.hero.money;
    expect(INN_WANTS.carvedTankard.pays).toBeGreaterThan(sellValue('carvedTankard')!);
    expect(sell(shop, model.hero, 'carvedTankard')).toBe('sold');
    expect(model.hero.money).toBe(money + INN_WANTS.carvedTankard.pays);
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

describe("the inn's cupboard, to be seen", () => {
  it('is told in words: bare, or what she has of tankards and bowls', () => {
    const shop = { money: 0, stock: {} as Record<string, number>, restockedAt: 0 };
    expect(cupboardWords(shop as never)).toMatch(/^Her cupboard is bare/);
    shop.stock.carvedTankard = 1;
    expect(cupboardWords(shop as never)).toBe('Her cupboard: 1 tankard.');
    shop.stock.woodenBowl = 3;
    shop.stock.carvedTankard = 12;
    expect(cupboardWords(shop as never)).toBe('Her cupboard: 12 tankards and 3 bowls.');
  });

  it('stands her tankards along her bottle shelves, so many a shelf, as many as she has; redrawn as the count changes, gone with the room', () => {
    const model = fresh();
    const inn = model.entrances.find((e) => e.type === 'inn')!;
    const shop = shopAt(model.shops, model.seed, doorNumber(inn));
    model.teleport(inn.x, inn.z);
    model.useDoor();
    const shelves = model.inside!.furniture.filter((f) => f.kind === 'bottleShelf').length;
    expect(shelves).toBeGreaterThan(0);
    const room = new THREE.Group();
    const view = new Cupboard();
    view.update(model, room);
    expect(view.mugs).toBe(0);
    shop.stock.carvedTankard = 3;
    view.update(model, room);
    expect(view.mugs).toBe(3);
    shop.stock.carvedTankard = 100;
    view.update(model, room);
    expect(view.mugs).toBe(shelves * MUGS_A_SHELF);
    expect(room.children.length).toBe(1);
    model.useDoor(); // (out)
    view.clear();
    expect([view.mugs, room.children.length]).toEqual([0, 0]);
    view.dispose();
  });
});

describe("a shop's shelves", () => {
  it('give up so many of a thing as asked, or as many as there are, and none of what is not there', () => {
    const shop = { money: 0, stock: { carvedTankard: 5 } as Record<string, number>, restockedAt: 0 };
    expect(takeStock(shop as never, 'carvedTankard', 3)).toBe(3);
    expect(shop.stock.carvedTankard).toBe(2);
    expect(takeStock(shop as never, 'carvedTankard', 6)).toBe(2);
    expect(shop.stock.carvedTankard).toBeUndefined();
    expect(takeStock(shop as never, 'woodenBowl', 1)).toBe(0);
  });
});

describe("the inn's orders", () => {
  it('are every third notice on a board: so many cups, no foes gathered, done once carried, paid her price and over', () => {
    const model = fresh();
    const offers = model.quests.offersAt(0);
    const orders = offers.filter((q) => innWants(q.item));
    expect(orders.length).toBe(Math.floor(OFFERS / 3));
    const [order] = orders;
    expect(questTitle(order)).toMatch(/^Bring \d+ (carved tankards|wooden bowls)$/);
    expect(order.copper).toBeGreaterThan(INN_WANTS[order.item as InnWant].pays * order.count);
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

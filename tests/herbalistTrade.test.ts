// @vitest-environment happy-dom
// Trading with a herbalist (herbalist/herbalistShop.ts, controller/trade/herbalistPanel.ts): what they won't take
// (wood, scrap), so many of a kind at a time; their shop through a save; their word on the hero (hurt, spent, with
// nothing to drink) and on what's sold them; and their bed, not the hero's, while they're home.
import { describe, expect, it, vi } from 'vitest';
import { fresh } from './support/testWorld';
import { buyFromHerbalist, herbalistBuys, herbalistShopAt, sellToHerbalist } from '../src/model/herbalist/herbalistShop';
import { WANTS } from '../src/model/shops/shopStock';
import { restore, snapshot } from '../src/model/save';
import { maxEnergyOf, maxHpOf } from '../src/model/hero/attributes';
import { NOT_YOURS } from '../src/model/hero/setbacks';
import { takeSpeech } from '../src/model/npcs/speech';
import type { GameModel } from '../src/model/GameModel';
import { herbalistGreets, herbalistTakes } from '../src/controller/trade/herbalistPanel';

vi.mock('../src/view/ui/voxelIcon', () => ({ voxelIcon: () => document.createElement('canvas') }));

const atHerbalist = (model: GameModel) => {
  const herbalist = model.npcs.find((n) => n.role === 'herbalist')!;
  return { herbalist, shop: herbalistShopAt(model.shops, model.seed, herbalist) };
};

describe("a herbalist's trade", () => {
  it('takes what the wild gives and potions, not wood finds, scrap or what the shops sell', () => {
    for (const id of ['rawBoarMeat', 'honeycomb', 'salmon', 'smallFry', 'minorHealthPotion']) expect(herbalistBuys(id), id).toBe(true);
    for (const id of ['pineResin', 'heartwood', 'oakBurl', 'oakLog', 'pinePlank', 'ironScrap', 'salt', 'flour', 'firewood', 'ironOre']) expect(herbalistBuys(id), id).toBe(false);
    const model = fresh();
    const { shop } = atHerbalist(model);
    model.hero.bag = { heartwood: 1 };
    expect(sellToHerbalist(shop, model.hero, 'heartwood')).toBe('not wanted');
    expect(model.hero.bag.heartwood).toBe(1);
  });

  it('so many of an ingredient at a time; potions back, at half, without end', () => {
    const model = fresh();
    const { shop } = atHerbalist(model);
    shop.money = 100_000;
    model.hero.bag = { salmon: WANTS.goods + 2, minorHealthPotion: 8 };
    for (let i = 0; i < WANTS.goods; i++) expect(sellToHerbalist(shop, model.hero, 'salmon')).toBe('sold');
    expect(sellToHerbalist(shop, model.hero, 'salmon')).toBe('not wanted');
    const before = model.hero.money;
    for (let i = 0; i < 8; i++) expect(sellToHerbalist(shop, model.hero, 'minorHealthPotion')).toBe('sold');
    expect(model.hero.money - before).toBe(8 * 10);
  });

  it('a full bag, no coin, an empty purse: each a no, and nothing changes hands', () => {
    const model = fresh();
    const { shop } = atHerbalist(model);
    const { hero } = model;
    hero.money = 0;
    expect(buyFromHerbalist(shop, hero, 'minorHealthPotion')).toBe('too poor');
    hero.bag = { rawBearMeat: 1 };
    shop.money = 0;
    expect(sellToHerbalist(shop, hero, 'rawBearMeat')).toBe('short');
    expect([hero.money, hero.bag.rawBearMeat]).toEqual([0, 1]);
  });

  it('keeps their purse, shelves and what the hero sold them through a save', () => {
    const model = fresh();
    const { herbalist, shop } = atHerbalist(model);
    model.hero.money = 500;
    model.hero.bag = { honeycomb: 1 };
    expect(buyFromHerbalist(shop, model.hero, 'greaterHealthPotion')).toBe('bought');
    expect(sellToHerbalist(shop, model.hero, 'honeycomb')).toBe('sold');
    const copy = fresh();
    restore(copy, JSON.parse(JSON.stringify(snapshot(model))));
    const again = herbalistShopAt(copy.shops, copy.seed, herbalist, shop.restockedAt);
    expect(again.money).toBe(shop.money);
    expect(again.stock.greaterHealthPotion ?? 0).toBe(0);
    expect(again.buyback).toEqual(shop.buyback);
    expect(again.bought).toEqual(shop.bought);
  });
});

describe("a herbalist's word", () => {
  it('on a hero hurt, spent, or with no potion on them (half the time); else none of their own', () => {
    const { hero } = fresh();
    Object.assign(hero, { hp: maxHpOf(hero), energy: maxEnergyOf(hero), bag: { minorHealthPotion: 1 } });
    expect(herbalistGreets(hero, 0.1)).toBeNull();
    hero.hp = maxHpOf(hero) * 0.2;
    expect(herbalistGreets(hero, 0.9)).toMatch(/red/i);
    hero.hp = maxHpOf(hero);
    hero.energy = 0;
    expect(herbalistGreets(hero, 0.9)).toMatch(/blue/i);
    hero.energy = maxEnergyOf(hero);
    hero.bag = {};
    expect(herbalistGreets(hero, 0.1)).toMatch(/potion|drink|flask/i);
    expect(herbalistGreets(hero, 0.9)).toBeNull();
  });

  it('on a potion sold back, not as something to brew with; on a fish, a cut, a comb, each its own', () => {
    for (const roll of [0, 0.5, 0.99]) {
      expect(herbalistTakes('Minor health potion', 'minorHealthPotion', roll)).not.toMatch(/brew/);
      expect(herbalistTakes('Salmon', 'salmon', roll)).toMatch(/oil|scales/i);
    }
    expect(herbalistTakes('Honeycomb', 'honeycomb')).toMatch(/wax/);
  });
});

describe("a herbalist's bed", () => {
  it('not the hero\'s: lain in, with them home (always), they turn the hero out', () => {
    const model = fresh();
    const { herbalist } = atHerbalist(model);
    model.enterRoom(herbalist.home);
    const bed = model.inside!.furniture.find((f) => f.kind === 'bed')!;
    expect(bed).toBeTruthy();
    const { width, depth } = model.inside!.room;
    let found = false;
    for (let x = 0; x < width && !found; x += 0.25) for (let z = 0; z < depth && !found; z += 0.25) {
      Object.assign(model.hero, { x, z });
      found = model.seatInReach?.piece === bed;
    }
    expect(found).toBe(true);
    takeSpeech();
    model.sitOrStand();
    expect(model.seated).toBeNull();
    expect(takeSpeech().some((e) => e.kind === 'say' && NOT_YOURS.includes(e.text))).toBe(true);
  });
});

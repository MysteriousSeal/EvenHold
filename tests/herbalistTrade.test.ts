// @vitest-environment happy-dom
// Trading with a herbalist (herbalist/herbalistShop.ts, controller/trade/herbalistPanel.ts): what they won't take
// (wood, scrap), so many of a kind at a time; their shop through a save; their word on the hero (hurt, spent, with
// nothing to drink) and on what's sold them; their bed, theirs at night (by day, at their work, as good as away);
// abed at night, their shop shut, the pox seen to all the same.
import { describe, expect, it, vi } from 'vitest';
import { fresh } from './support/testWorld';
import { buyFromHerbalist, herbalistBuys, herbalistShopAt, sellToHerbalist } from '../src/model/herbalist/herbalistShop';
import { WANTS } from '../src/model/shops/shopStock';
import { restore, snapshot } from '../src/model/save';
import { maxEnergyOf, maxHpOf } from '../src/model/hero/attributes';
import { NOT_YOURS } from '../src/model/hero/setbacks';
import { takeSpeech } from '../src/model/npcs/speech';
import type { GameModel } from '../src/model/GameModel';
import { herbalistAbed } from '../src/model/herbalist/herbalistWork';
import { SALVE, poxTalk } from '../src/model/hero/pox';
import { givePox, hasPox } from '../src/model/hero/blessing';
import type { Talk } from '../src/model/story/story';
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

// Into the herbalist's house, the hero stood where they'd lie down in their bed.
function byTheirBed(model: GameModel) {
  const { herbalist } = atHerbalist(model);
  model.enterRoom(herbalist.home);
  const bed = model.inside!.furniture.find((f) => f.kind === 'bed')!;
  const { width, depth } = model.inside!.room;
  for (let x = 0; x < width; x += 0.25) for (let z = 0; z < depth; z += 0.25) {
    Object.assign(model.hero, { x, z });
    if (model.seatInReach?.piece === bed) return { herbalist, bed };
  }
  throw new Error('no way into their bed');
}
const said = () => takeSpeech().flatMap((e) => (e.kind === 'say' ? [e.text] : []));
const NIGHT = 23 * 60 + 30; // on the clock, day 0

describe("a herbalist's bed and night", () => {
  it('by day (at their work), rests the hero slowly, as an absent villager\'s does; at their bedtime, they turn the hero out', () => {
    const model = fresh();
    byTheirBed(model);
    takeSpeech();
    model.sitOrStand();
    expect(model.seated?.seat.lying).toBe(true);
    model.hero.energy = 10;
    model.update(0, 0, 1);
    expect(model.hero.energy - 10).toBeCloseTo(1, 1); // (a bed's 2 a second, halved)
    expect(said()).toEqual([]);
    model.minutes = NIGHT;
    model.update(0, 0, 0.1);
    expect(model.seated).toBeNull();
    expect(NOT_YOURS).toContain(said()[0]);
  });

  it('at night, abed: they go to it, not to their counter for the hero; their shop shut; up to their work at dawn', () => {
    const model = fresh();
    const { herbalist, bed } = byTheirBed(model);
    model.minutes = NIGHT;
    const counter = model.inside!.furniture.find((f) => f.kind === 'herbCounter')!;
    Object.assign(model.hero, { x: counter.x + counter.w / 2, z: counter.z + counter.d + 0.6 }); // (at their counter, as to trade)
    for (let t = 0; t < 20; t += 1 / 30) model.update(0, 0, 1 / 30);
    expect(herbalist.seat?.piece).toBe(bed);
    expect(herbalistAbed(model.minutes)).toBe(true);
    model.minutes = 7 * 60 + 24 * 60;
    for (let t = 0; t < 90; t += 1 / 10) model.update(0, 0, 1 / 10);
    expect(herbalist.seat ?? null).toBeNull(); // (up, at their work)
  });

  it('woken for the pox at night, sells the salve all the same; their wares wait for the morning', () => {
    const model = fresh();
    const { herbalist } = atHerbalist(model);
    givePox(model.hero);
    model.minutes = NIGHT;
    const woken = poxTalk(model, herbalist)!;
    expect(woken.lines[0]).toMatch(/woke me/);
    expect(woken.answers.some((a) => a.trade)).toBe(false);
    model.hero.money = SALVE;
    const paid = woken.answers[0].pick() as Talk;
    expect(hasPox(model.hero)).toBe(false);
    expect(paid.answers.some((a) => a.trade)).toBe(false);
    model.minutes = 9 * 60;
    givePox(model.hero);
    expect(poxTalk(model, herbalist)!.answers.some((a) => a.trade)).toBe(true);
  });
});

// The pedlar, given the keepers' treatment (travellers/pedlarCamp.ts, pedlarShop.ts, pedlarNews.ts): camped off the
// road at night, a fire to cook at, back on the road at dawn; relics bought (twice junk's, a few at a time, then
// junk's again), the bag saying so; their word on the hero by how they find them; the news of the road, the
// cathedral's once the long road's been taken; a rumour inked on the map, one a while; and the save.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { generateWorld } from '../src/model/worldgen/world';
import { DAY_MINUTES } from '../src/model/clock';
import { campOf, camping } from '../src/model/travellers/pedlarCamp';
import { onRoadSide, type Traveller } from '../src/model/travellers/travellers';
import { PEDLAR_WARES, buyFromPedlar, pedlarPrice, pedlarShopAt, pedlarWaresOf, sellToPedlar } from '../src/model/travellers/pedlarShop';
import { RUMOUR_PRICE, buyRumour, pedlarGreets, pedlarNews, rumourOf } from '../src/model/travellers/pedlarNews';
import { saleOf } from '../src/model/shops/sellValue';
import { LOOT } from '../src/model/loot/loot';
import { maxHpOf } from '../src/model/hero/attributes';
import { RESTOCK_EVERY } from '../src/model/shops/shopStock';
import { parseSave, restore, snapshot } from '../src/model/save';
import { FRAME } from './support/testWorld';

const MID = { width: 512, depth: 512 };
let world: ReturnType<typeof generateWorld> | null = null;
const fresh = () => new GameModel(1, MID, (world ??= generateWorld(1, MID)));
// A pedlar alone on the roads, the hero beside them (near enough for them to be about), no foes.
function alone(): { model: GameModel; t: Traveller } {
  const model = fresh();
  const t = model.travellers.list.find((x) => x.role === 'pedlar')!;
  model.travellers.list.splice(0, model.travellers.list.length, t);
  model.enemies.splice(0);
  Object.assign(model.hero, { x: t.x + 6, z: t.z });
  return { model, t };
}
const step = (model: GameModel, seconds: number) => {
  for (let s = 0; s < seconds; s += FRAME) model.update(0, 0, FRAME);
};

describe("a pedlar's night", () => {
  it('camps from nine at night till six in the morning', () => {
    expect(camping(20 * 60 + 59)).toBe(false);
    expect(camping(21 * 60)).toBe(true);
    expect(camping(DAY_MINUTES + 3 * 60)).toBe(true);
    expect(camping(DAY_MINUTES + 6 * 60)).toBe(false);
  });

  it('stops where they are of a night and eases off the road to their camp; at dawn, on along it again', () => {
    const { model, t } = alone();
    model.minutes = 22 * 60;
    const along = t.along;
    step(model, 3);
    expect(t.camp).toBeTruthy();
    expect(t.along).toBe(along); // (stopped)
    const road = model.travellers.roadOf(t);
    const middle = onRoadSide(road, t.along, t.way, 0);
    expect(Math.hypot(t.x - middle.x, t.z - middle.z)).toBeGreaterThan(0.6); // (off the road)
    model.minutes = DAY_MINUTES + 7 * 60;
    step(model, 3);
    expect(t.camp).toBe(null);
    expect(t.along).not.toBe(along); // (walking on)
  });

  it("makes camp on the far side when theirs is blocked, never in what's blocked", () => {
    const { model, t } = alone();
    const road = model.travellers.roadOf(t);
    const near = campOf(road, t.along, t.way, () => false);
    const mine = (x: number, z: number) => Math.hypot(x - near.fire.x, z - near.fire.z) < 0.5; // (their own side's fire spot, in a tree)
    const far = campOf(road, t.along, t.way, mine);
    expect(Math.sign(far.lane)).toBe(-Math.sign(near.lane));
    expect(mine(far.fire.x, far.fire.z)).toBe(false);
  });

  it("their camp's fire is one to cook at", () => {
    const { model, t } = alone();
    model.minutes = 22 * 60;
    step(model, 1);
    Object.assign(model.hero, { x: t.camp!.fire.x + 0.6, z: t.camp!.fire.z });
    expect(model.cooking.fireInReach).toMatchObject({ kind: 'campfire', x: t.camp!.fire.x, z: t.camp!.fire.z });
  });
});

describe('relics', () => {
  it("a bone charm or a shroud fetches twice junk's, four at a time; then junk's, as anyone pays", () => {
    const { model, t } = alone();
    const shop = pedlarShopAt(model.shops, model.seed, t, 0);
    shop.money = 10_000;
    model.hero.bag.boneCharm = 6;
    expect(pedlarPrice('boneCharm', true)).toBe(LOOT.boneCharm.value * 2);
    for (let i = 0; i < 4; i++) expect(sellToPedlar(shop, model.hero, 'boneCharm')).toBe('sold');
    expect(sellToPedlar(shop, model.hero, 'boneCharm')).toBe('not wanted');
    expect(model.hero.bag.boneCharm).toBe(2);
    expect(saleOf('boneCharm')).toEqual({ price: LOOT.boneCharm.value * 2, to: expect.stringContaining('a pedlar, as a relic') });
    expect(saleOf('tatteredShroud')!.price).toBe(LOOT.tatteredShroud.value * 2);
  });

  it('wanted again a restock on, and kept through the save', () => {
    const { model, t } = alone();
    const shop = pedlarShopAt(model.shops, model.seed, t, 0);
    shop.money = 10_000;
    model.hero.bag.boneCharm = 5;
    for (let i = 0; i < 4; i++) sellToPedlar(shop, model.hero, 'boneCharm');
    const again = new GameModel(model.seed, MID, world!);
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    const kept = pedlarShopAt(again.shops, again.seed, t, 0);
    expect(sellToPedlar(kept, again.hero, 'boneCharm')).toBe('not wanted');
    const later = pedlarShopAt(again.shops, again.seed, t, RESTOCK_EVERY + 1);
    expect(sellToPedlar(later, again.hero, 'boneCharm')).toBe('sold');
  });
});

describe("a pedlar's word", () => {
  it('on a hero camped by, hurt, laden, with bones, wearing their wares, or skint', () => {
    const { model } = alone();
    const hero = model.hero;
    expect(pedlarGreets(hero, true, 0)).toMatch(/fire|late|Kettle/);
    hero.hp = maxHpOf(hero) * 0.2;
    expect(pedlarGreets(hero, false, 0.9)).toMatch(/bleeding|potion/i);
    hero.hp = maxHpOf(hero);
    hero.bag.boneCharm = 1;
    expect(pedlarGreets(hero, false, 0.1)).toMatch(/bone/i);
    delete hero.bag.boneCharm;
    hero.equipment.ring = 'copperRing';
    expect(pedlarGreets(hero, false, 0.1)).toMatch(/mine|sold/);
    delete hero.equipment.ring;
    hero.money = 3;
    expect(pedlarGreets(hero, false, 0.1)).toMatch(/skint|purse/i);
    expect(pedlarGreets(hero, false, 0.9)).toBe(null); // (not every time)
  });

  // All a pedlar has to tell at an act of the second arc (and its ending).
  const told = (act: 0 | 1 | 2 | 3 | 4, ending: 'exposed' | 'kept' | null = null, witch: 'freed' | 'handed' | 'left' | null = null) => Array.from({ length: 20 }, (_, n) => pedlarNews({ act, ending, witch }, n)).join(' ');

  it("the news of the road: the cathedral's once the long road's been taken, never before", () => {
    expect(told(0)).not.toMatch(/grey|Greyminster|Aldous|bishop/i);
    expect(told(1)).toMatch(/men in grey|greycoats/i);
    expect(told(1)).toMatch(/saint/);
  });

  it('the news act by act: the pilgrims, the witches chained, the man in the cells; at the last, how it ended', () => {
    expect(told(1)).toMatch(/new saint heals/);
    expect(told(2)).toMatch(/chaining hedge-witches/);
    expect(told(3)).toMatch(/shouting the saint's a knuckle/);
    expect(told(4, 'exposed')).toMatch(/bishop in the stocks/);
    expect(told(4, 'kept')).toMatch(/miracles stopped, but the pilgrims still come/);
    expect(told(2)).not.toMatch(/new saint heals|knuckle|stocks!/);
    expect(told(3)).not.toMatch(/fists/); // (Captain Grey writes names down; he'd never use them)
    expect(told(3)).toMatch(/little book/);
  });

  it("the hero's own doings, talked of on the road: the witch they freed, or sold", () => {
    expect(told(3, null, 'freed')).toMatch(/slipped her chain/);
    expect(told(3, null, 'handed')).toMatch(/sold a hedge-witch/);
    expect(told(3, null, 'left')).not.toMatch(/slipped her chain|sold a hedge-witch/);
    expect(told(0, null, 'freed')).not.toMatch(/slipped her chain/); // (the road's own news before)
  });
});

describe('a rumour', () => {
  it('inks the nearest place the map has not got on it, for coin; one a while', () => {
    const { model, t } = alone();
    const shop = pedlarShopAt(model.shops, model.seed, t, 0);
    model.hero.money = 100;
    const place = rumourOf(model, t)!;
    expect(place).toBeTruthy();
    const told = buyRumour(model, shop, model.hero, t);
    expect(told.sold).toBe(true);
    expect(told.said).toContain(place.name);
    expect(model.hero.money).toBe(100 - RUMOUR_PRICE);
    expect(model.atlas.places().some((p) => Math.hypot(p.x - place.x, p.z - place.z) < 2)).toBe(true);
    expect(buyRumour(model, shop, model.hero, t).sold).toBe(false); // (one a while)
    const later = pedlarShopAt(model.shops, model.seed, t, RESTOCK_EVERY + 1);
    const next = rumourOf(model, t);
    if (next) expect(next.name === place.name && Math.hypot(next.x - place.x, next.z - place.z) < 1).toBe(false); // (another place)
    model.hero.money = 0;
    expect(buyRumour(model, later, model.hero, t)).toMatchObject({ sold: false, said: expect.stringContaining('coin') });
  });

  it('none to tell when the map has it all', () => {
    const { model, t } = alone();
    const empty = { crypts: [], caves: [], strongholds: [], camps: [], atlas: model.atlas };
    expect(buyRumour(empty, pedlarShopAt(model.shops, model.seed, t, 0), model.hero, t)).toMatchObject({ sold: false });
  });
});

describe('their wares', () => {
  it("shown only what they carry: nothing sold out that a restock never brings back", () => {
    const { model, t } = alone();
    const shop = pedlarShopAt(model.shops, model.seed, t, 0);
    const later = pedlarShopAt(model.shops, model.seed, t, RESTOCK_EVERY * 50); // (restocked fully)
    for (const id of pedlarWaresOf(model.seed, t)) expect(later.stock[id] ?? 0).toBeGreaterThan(0);
    expect(pedlarWaresOf(model.seed, t).length).toBeLessThan(PEDLAR_WARES.length); // (not every trinket, every potion, every bag)
    void shop;
  });

  it('still bought from at their price', () => {
    const { model, t } = alone();
    const shop = pedlarShopAt(model.shops, model.seed, t, 0);
    model.hero.money = 100;
    expect(buyFromPedlar(shop, model.hero, 'bread')).toBe('bought');
  });
});

// Potions (loot/potions.ts, hero/bag.ts drinkPotion): drunk at once for their
// share of the hero's most, standing, then a wait before another; on the
// action bar; sold by pedlars and the villages' herbalists (each at home in
// a house of their village), who buy potions and ingredients back.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { drinkPotion, potionRefused } from '../src/model/hero/bag';
import { recover } from '../src/model/hero/heroStats';
import { maxEnergyOf, maxHpOf } from '../src/model/hero/attributes';
import { POTIONS, POTION_COOLDOWN, POTION_IDS, SHOP_POTIONS, potionText } from '../src/model/loot/potions';
import { LOOT_QUALITY } from '../src/model/loot/loot';
import { setAction, useAction, readActionBar } from '../src/model/hero/actionBar';
import { PEDLAR_WARES, pedlarBuys } from '../src/model/travellers/pedlarShop';
import { HERBALIST_WARES, buyFromHerbalist, herbalistBuys, herbalistShopAt, sellToHerbalist } from '../src/model/herbalist/herbalistShop';
import { visitHerbalist } from '../src/model/cheats';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';
import { heroStruck } from '../src/model/hero/fighting';
import { parseSave, restore, snapshot } from '../src/model/save';
import { eatOrDrink } from '../src/model/hero/bag';

const fresh = () => new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);

describe('potions', () => {
  it('six sold everywhere and an alchemist\'s brews, of their own quality; each says what it gives', () => {
    expect(SHOP_POTIONS).toHaveLength(6);
    expect(POTION_IDS).toEqual(expect.arrayContaining([...SHOP_POTIONS]));
    for (const id of POTION_IDS) expect(LOOT_QUALITY[id]).toBe('potion');
    expect(potionText('minorHealthPotion')).toBe('Restores 25% health at once');
    expect(potionText('greaterEnergyPotion')).toBe('Restores 70% energy at once');
  });

  it('drunk at once for their share, standing; then none till the wait is over, any', () => {
    const { hero } = fresh();
    Object.assign(hero, { hp: 1, energy: 1, bag: { lesserHealthPotion: 2, minorEnergyPotion: 1 } });
    expect(drinkPotion(hero, 'lesserHealthPotion')).toBe(true);
    expect(hero.hp).toBeCloseTo(Math.min(maxHpOf(hero), 1 + POTIONS.lesserHealthPotion.heal * maxHpOf(hero)), 5);
    expect(hero.eating ?? null).toBeNull(); // (not sat down to it)
    expect(drinkPotion(hero, 'minorEnergyPotion')).toBe(false); // (the wait: any potion)
    expect(hero.bag.minorEnergyPotion).toBe(1);
    for (let t = 0; t < POTION_COOLDOWN; t += 1) recover(hero, 1, false, true);
    expect(drinkPotion(hero, 'minorEnergyPotion')).toBe(true);
    expect(hero.energy).toBeCloseTo(Math.min(maxEnergyOf(hero), 1 + 0.25 * maxEnergyOf(hero)), 5);
    expect(drinkPotion(hero, 'bread')).toBe(false); // (not a potion)
  });

  it('not drunk for nothing: at full health a red one, at full energy a blue one, kept; told why, from the bag or the bar', () => {
    const model = fresh();
    const { hero } = model;
    Object.assign(hero, { hp: maxHpOf(hero), energy: 1, bag: { minorHealthPotion: 1, minorEnergyPotion: 1 } });
    expect(potionRefused(hero, 'minorHealthPotion')).toBe("You're already at full health.");
    expect(drinkPotion(hero, 'minorHealthPotion')).toBe(false);
    expect([hero.bag.minorHealthPotion, hero.potionCooldown ?? 0]).toEqual([1, 0]); // (kept, and no wait begun)
    setAction(hero, 0, 'minorHealthPotion');
    model.takeEvents();
    expect(model.useAction(0)).toBe(false);
    expect(model.takeEvents().some((e) => e.kind === 'poor' && e.text === "You're already at full health.")).toBe(true);
    expect(potionRefused(hero, 'minorEnergyPotion')).toBeNull();
    expect(drinkPotion(hero, 'minorEnergyPotion')).toBe(true);
    hero.hp = 1;
    expect(potionRefused(hero, 'minorHealthPotion')).toMatch(/^Not yet: another potion in 30 s/);
    expect(model.useAction(0)).toBe(false);
    expect(model.takeEvents().some((e) => e.kind === 'poor' && /Not yet/.test(e.text))).toBe(true);
    hero.energy = maxEnergyOf(hero);
    hero.potionCooldown = 0;
    expect(potionRefused({ ...hero, bag: { minorEnergyPotion: 1 } }, 'minorEnergyPotion')).toBe('Your energy is already full.');
  });

  it('on the action bar, used from it; kept in the save\'s reading', () => {
    const { hero } = fresh();
    hero.bag = { minorHealthPotion: 1 };
    expect(setAction(hero, 0, 'minorHealthPotion')).toBe(true);
    hero.hp = 1;
    expect(useAction(hero, 0)).toBe(true);
    expect(hero.hp).toBeGreaterThan(1);
    expect(readActionBar(['greaterEnergyPotion'])[0]).toBe('greaterEnergyPotion');
  });

  it('pedlars carry the six (not the brews), and buy any back', () => {
    for (const id of POTION_IDS) {
      expect(PEDLAR_WARES.includes(id)).toBe(SHOP_POTIONS.includes(id));
      expect(pedlarBuys(id)).toBe(true);
    }
  });
});

describe('herbalists', () => {
  it('one in each village with a house, at home in one of its houses', () => {
    const model = fresh();
    const herbalists = model.npcs.filter((n) => n.role === 'herbalist');
    expect(herbalists.length).toBeGreaterThan(0);
    expect(herbalists.length).toBeLessThanOrEqual(model.villages.length);
    for (const h of herbalists) {
      expect(h.home.type).toBe('house');
      expect(h.where).toBe(h.home);
    }
    expect(new Set(herbalists.map((h) => h.village)).size).toBe(herbalists.length);
  });

  it('sell every potion; buy potions and ingredients back, not junk', () => {
    const model = fresh();
    const herbalist = model.npcs.find((n) => n.role === 'herbalist')!;
    const shop = herbalistShopAt(model.shops, model.seed, herbalist);
    for (const id of HERBALIST_WARES) expect(shop.stock[id] ?? 0, id).toBeGreaterThan(0); // (the brews too: shown as the hero levels)
    model.hero.money = 1000;
    expect(buyFromHerbalist(shop, model.hero, 'minorHealthPotion')).toBe('bought');
    expect(model.hero.bag.minorHealthPotion).toBe(1);
    expect(herbalistBuys('rawWolfMeat')).toBe(true);
    expect(herbalistBuys('wolfFang')).toBe(false);
    for (const crafted of ['oakLog', 'oakPlank', 'ironScrap', 'cutGem', 'salt', 'flour', 'firewood']) expect(herbalistBuys(crafted), crafted).toBe(false); // (a lumberjack's logs no gold mine; nor the shops' own wares sold back)
    model.hero.bag.rawWolfMeat = 1;
    expect(sellToHerbalist(shop, model.hero, 'rawWolfMeat')).toBe('sold');
  });

  it('a cheat goes into the nearest one\'s house', () => {
    const model = fresh();
    expect(visitHerbalist(model, new Set())).toBe(true);
    const there = model.npcs.find((n) => n.role === 'herbalist' && n.home === model.inside?.entrance);
    expect(there).toBeDefined();
  });
});

describe('health potions, at once and over a while (a lesser, a greater: carrying them through a fight)', () => {
  const big = (model = fresh()) => {
    const { hero } = model;
    hero.trained.stamina = 30; // (a most health worth the shares: whole numbers aside)
    Object.assign(hero, { hp: 1, bag: { minorHealthPotion: 1, lesserHealthPotion: 1, greaterHealthPotion: 1, bread: 1 } });
    return model;
  };
  const run = (hero: ReturnType<typeof fresh>['hero'], seconds: number) => {
    for (let t = 0; t < seconds - 1e-9; t += 0.1) recover(hero, 0.1, false, true);
  };

  it('the split: a minor all at once; a lesser 20% then 30% over 6 s; a greater 25% then 60% over 10 s', () => {
    expect(POTIONS.minorHealthPotion).toMatchObject({ heal: 0.25 });
    expect(POTIONS.lesserHealthPotion).toMatchObject({ heal: 0.2, mend: 0.3, mendFor: 6 });
    expect(POTIONS.greaterHealthPotion).toMatchObject({ heal: 0.25, mend: 0.6, mendFor: 10 });
    expect(potionText('lesserHealthPotion')).toBe('Restores 20% health at once, and 30% more over 6 s');
    expect(potionText('greaterHealthPotion')).toBe('Restores 25% health at once, and 60% more over 10 s');
  });

  it('a greater: its share at once, the rest a little at a time, all of it by its end, then no more', () => {
    const { hero } = big();
    const most = maxHpOf(hero);
    expect(drinkPotion(hero, 'greaterHealthPotion')).toBe(true);
    expect(hero.hp).toBeCloseTo(1 + 0.25 * most, 5);
    run(hero, 5);
    expect(hero.hp).toBeCloseTo(1 + 0.25 * most + 0.3 * most, 3); // (half its over-time share, half way)
    run(hero, 5.2); // (a moment past its end)
    expect(hero.hp).toBeCloseTo(1 + 0.85 * most, 3);
    expect(hero.draught ?? null).toBeNull();
    run(hero, 5);
    expect(hero.hp).toBeCloseTo(1 + 0.85 * most, 3);
  });

  it('in a fight, the bigger wins: blows taken over ten seconds, a greater leaves them well above a lesser, a lesser above a minor', () => {
    const left = (id: 'minorHealthPotion' | 'lesserHealthPotion' | 'greaterHealthPotion') => {
      const model = big();
      const { hero } = model;
      hero.hp = maxHpOf(hero) * 0.5;
      drinkPotion(hero, id);
      for (let t = 0; t < 10; t += 0.1) {
        recover(hero, 0.1, false, false);
        if (Math.round(t * 10) % 10 === 0) hero.hp -= maxHpOf(hero) * 0.04; // (a blow a second, 4% each)
      }
      return hero.hp / maxHpOf(hero);
    };
    expect(left('greaterHealthPotion')).toBeGreaterThan(left('lesserHealthPotion') + 0.2);
    expect(left('lesserHealthPotion')).toBeGreaterThan(left('minorHealthPotion') + 0.05);
  });

  it('carries on through blows taken (unlike food), and alongside a meal: both heal at once', () => {
    const model = big();
    const { hero } = model;
    const most = maxHpOf(hero);
    drinkPotion(hero, 'lesserHealthPotion');
    heroStruck({ hero, godMode: false, focused: null, focus() {}, moves: { struck: (damage: number) => ({ guarded: 'taken', damage }) }, random: () => 0.99, report() {}, fall() {} } as never, 1, null);
    expect(hero.draught).not.toBeNull();
    expect(eatOrDrink(hero, 'bread')).toBe(true);
    const was = hero.hp;
    run(hero, 3);
    expect(hero.hp - was).toBeCloseTo(0.15 * most + (0.2 * most * 3) / 15, 2); // (half the lesser's, and a fifth of the bread's)
  });

  it("another drunk while one's still mending (a wait cut short: a cheat): what was left of it is kept, added to the new", () => {
    const { hero } = big();
    const most = maxHpOf(hero);
    drinkPotion(hero, 'lesserHealthPotion');
    run(hero, 3);
    hero.potionCooldown = 0;
    hero.hp = 1;
    drinkPotion(hero, 'greaterHealthPotion');
    expect(hero.draught).toMatchObject({ left: 10, seconds: 10 });
    expect(hero.draught!.heal).toBeCloseTo(0.6 * most + 0.15 * most, 5);
  });

  it("kept through a save, mid-way (a reload neither loses it nor gives it back whole); an older save's, or a damaged one's, none", () => {
    const model = fresh(); // (as a save keeps them: no cheat to their most health)
    Object.assign(model.hero, { hp: 1, bag: { greaterHealthPotion: 1 } });
    drinkPotion(model.hero, 'greaterHealthPotion');
    run(model.hero, 4);
    const draught = { ...model.hero.draught! };
    const data = parseSave(JSON.stringify(snapshot(model)), model.seed)!;
    const again = fresh();
    restore(again, data);
    expect(again.hero.draught).toEqual(draught);
    const hp = again.hero.hp;
    run(again.hero, 6);
    expect(again.hero.hp - hp).toBeCloseTo((draught.heal * 6) / 10, 2); // (its last 6 s, at its rate)
    for (const broken of [undefined, { heal: 'lots', left: 3, seconds: 10, item: 'greaterHealthPotion' }, { heal: 5, left: 3, seconds: 10, item: 'bread' }, { heal: 5, left: -1, seconds: 10, item: 'greaterHealthPotion' }]) {
      const old = parseSave(JSON.stringify(snapshot(model)), model.seed)!;
      (old.hero as { draught?: unknown }).draught = broken;
      const read = fresh();
      restore(read, old);
      expect(read.hero.draught ?? null).toBeNull();
    }
    const greedy = parseSave(JSON.stringify(snapshot(model)), model.seed)!;
    (greedy.hero as { draught?: unknown }).draught = { heal: 1e9, left: 1e9, seconds: 1e9, item: 'greaterHealthPotion' };
    const capped = fresh();
    restore(capped, greedy);
    expect(capped.hero.draught).toMatchObject({ left: 10, seconds: 10 });
    expect(capped.hero.draught!.heal).toBeLessThanOrEqual(maxHpOf(capped.hero));
  });
});

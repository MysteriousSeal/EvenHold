import { describe, expect, it } from 'vitest';
import { ENEMY_STATS } from '../src/model/constants';
import { DROP_CHANCE, LOOT, LOOT_IDS, LOOT_QUALITY, PICKUP_RANGE, rollDrop, type LootSource } from '../src/model/loot/loot';
import { LOOT_MODELS } from '../src/view/meshes/loot/lootModels';
import { INGREDIENTS } from '../src/model/loot/ingredients';
import { JUNK_ITEMS } from '../src/model/loot/junk';
import { PROVISIONS } from '../src/model/loot/provisions';
import { GameModel } from '../src/model/GameModel';
import { eatOrDrink, kindOf } from '../src/model/hero/bag';
import { recover } from '../src/model/hero/heroStats';
import { heroStruck } from '../src/model/hero/fighting';
import { MEAL_SECONDS, givesText } from '../src/model/loot/provisions';
import { ITEM_IDS } from '../src/model/human/equipment';
import { maxEnergyOf, maxHpOf } from '../src/model/hero/attributes';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';
import { QUEST_ITEMS } from '../src/model/quests/questItems';
import { fresh, slay } from './support/testWorld';

const drops = (source: LootSource) => Array.from({ length: 400 }, (_, id) => rollDrop(source, id));

describe('loot ids', () => {
  it('are never shared between junk, ingredients, provisions and quest items (one would hide the other)', () => {
    const ids = [...Object.keys(JUNK_ITEMS), ...Object.keys(INGREDIENTS), ...Object.keys(PROVISIONS), ...Object.keys(QUEST_ITEMS)];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('loot drops', () => {
  it('drops about half the time, only what that family of enemy carries', () => {
    for (const source of ['beast', 'humanoid'] as const) {
      const all = drops(source);
      const dropped = all.filter((d) => d !== null);
      expect(dropped.length / all.length).toBeGreaterThan(DROP_CHANCE - 0.1);
      expect(dropped.length / all.length).toBeLessThan(DROP_CHANCE + 0.1);
      for (const item of dropped) expect(LOOT[item!].droppedBy[source]).toBeGreaterThan(0);
      // Every item of that family shows up.
      const kinds = LOOT_IDS.filter((id) => LOOT[id].droppedBy[source]);
      expect(new Set(dropped).size).toBe(kinds.length);
    }
    expect(rollDrop('beast', 7)).toBe(rollDrop('beast', 7)); // the same fight, the same loot
  });

  it('wolves are beasts and bandits humanoids, and every item has a model', () => {
    expect(ENEMY_STATS.wolf.family).toBe('beast');
    expect(ENEMY_STATS.bandit.family).toBe('humanoid');
    for (const id of LOOT_IDS) expect(LOOT_MODELS[id].build().cells.some((c) => c > 0)).toBe(true);
  });
});

describe('picking up loot', () => {
  it('only within reach, into the bag, and off the ground', () => {
    const model = fresh();
    expect(model.pickUp()).toBeNull();
    model.dropLoot('wolfFang', model.hero.x + PICKUP_RANGE + 0.3, model.hero.z);
    expect(model.lootInReach).toBeNull();
    model.dropLoot('bentSpoon', model.hero.x + 0.4, model.hero.z);
    expect(model.lootInReach?.item).toBe('bentSpoon');
    expect(model.pickUp()).toBe('bentSpoon');
    expect(model.hero.bag).toEqual({ hatchet: 1, bentSpoon: 1 }); // (the hatchet: theirs from the start)
    expect(model.loot.map((l) => l.item)).toEqual(['wolfFang']);
  });

  it('a slain enemy may leave loot where it fell', () => {
    // Find a wolf whose id rolls a drop, and kill it.
    const model = fresh();
    model.godMode = true;
    const wolf = model.enemies.find((e) => e.kind === 'wolf' && rollDrop('beast', e.id) !== null)!;
    model.enemies.splice(0, model.enemies.length, wolf);
    slay(model, wolf);
    expect(model.loot).toHaveLength(1);
    expect(model.loot[0].item).toBe(rollDrop('beast', wolf.id));
    expect(Math.hypot(model.loot[0].x - wolf.x, model.loot[0].z - wolf.z)).toBeLessThan(0.5);
  });

  it('drops one item from the bag just in front of the hero', () => {
    const model = fresh();
    model.hero.bag.wolfFang = 2;
    model.update(1, 0, 1e-6); // facing +X
    expect(model.dropFromBag('wolfFang')).toBe(true);
    expect(model.hero.bag.wolfFang).toBe(1);
    const [dropped] = model.loot;
    expect(dropped.item).toBe('wolfFang');
    expect(dropped.x).toBeGreaterThan(model.hero.x);
    expect(Math.hypot(dropped.x - model.hero.x, dropped.z - model.hero.z)).toBeLessThan(PICKUP_RANGE); // right there to pick back up
    expect(model.dropFromBag('wolfFang')).toBe(true);
    expect(model.hero.bag).toEqual({ hatchet: 1 });
    expect(model.dropFromBag('wolfFang')).toBe(false);
  });
});

describe('food and drink from the bag', () => {
  // A while sat (so no energy spent meanwhile): what's being eaten, restored as it goes.
  const meal = (hero: GameModel['hero'], seconds: number) => {
    for (let t = 0; t < seconds; t += 0.1) recover(hero, 0.1, false, true);
  };

  it('food gives back its share of their most health, drink of their most energy (each only that), over a few seconds', () => {
    const { hero } = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    for (const id of Object.keys(PROVISIONS) as Array<keyof typeof PROVISIONS>) {
      Object.assign(hero, { hp: 1, energy: 1, bag: { [id]: 1 }, eating: null });
      expect(eatOrDrink(hero, id)).toBe(true);
      expect(hero.bag[id] ?? 0).toBe(0);
      const { heal = 0, energy = 0, drink } = PROVISIONS[id];
      meal(hero, MEAL_SECONDS / 2);
      expect(drink ? hero.energy : hero.hp, `${id}: half way, half of it`).toBeCloseTo(1 + (drink ? energy * maxEnergyOf(hero) : heal * maxHpOf(hero)) / 2, 0);
      meal(hero, MEAL_SECONDS);
      expect(hero.hp, id).toBeCloseTo(Math.min(maxHpOf(hero), 1 + heal * maxHpOf(hero)), 5);
      expect(hero.energy, id).toBeCloseTo(Math.min(maxEnergyOf(hero), 1 + energy * maxEnergyOf(hero)), 5);
      expect(drink ? hero.hp : hero.energy, `${id}: only what it gives`).toBe(1);
      expect(hero.eating).toBeNull();
    }
    Object.assign(hero, { hp: maxHpOf(hero), energy: maxEnergyOf(hero) - 1, bag: { wine: 1 } });
    eatOrDrink(hero, 'wine');
    meal(hero, MEAL_SECONDS + 0.5);
    expect(hero.energy).toBe(maxEnergyOf(hero)); // (no more than their most)
  });

  it('tells how much, of the most, and over how long', () => {
    expect(givesText('apple')).toBe(`Heals 10% over ${MEAL_SECONDS} seconds`);
    expect(givesText('wine')).toBe(`Restores 50% energy over ${MEAL_SECONDS} seconds`);
  });

  it('one at a time; a blow stops it, the rest lost', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const { hero } = model;
    model.random = () => 0.999; // (no dodge)
    Object.assign(hero, { hp: 1, bag: { roastLeg: 1, bread: 1 } });
    expect(eatOrDrink(hero, 'roastLeg')).toBe(true);
    expect(eatOrDrink(hero, 'bread')).toBe(false); // (still at the leg)
    expect(hero.bag.bread).toBe(1);
    meal(hero, 1);
    hero.hp += 5; // (enough to take the blow standing)
    heroStruck(model, 1, null);
    expect(hero.eating).toBeNull();
  });
});

describe('what kind of thing it is', () => {
  it('said short, for each kind: junk, ingredient, food, drink, quest item, bag; gear by what it\'s worn on', () => {
    expect(kindOf('wolfFang')).toBe('Junk');
    expect(kindOf('bread')).toBe('Food');
    expect(kindOf('ale')).toBe('Drink');
    expect(kindOf('roughSack')).toBe('Bag');
    expect(kindOf('leatherCap')).toBe('Head');
    for (const id of [...LOOT_IDS, ...ITEM_IDS]) expect(kindOf(id).length, id).toBeGreaterThan(2);
  });
});

describe('wolf meat', () => {
  it('a cooking ingredient, left by wolves as often as a fang', () => {
    expect(LOOT_QUALITY.rawWolfMeat).toBe('ingredient');
    expect(kindOf('rawWolfMeat')).toBe('Crafting material');
    expect(LOOT.rawWolfMeat.droppedBy).toEqual({ beast: LOOT.wolfFang.droppedBy!.beast });
    expect(ENEMY_STATS.wolf.family).toBe('beast');
  });
});

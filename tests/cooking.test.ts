// @vitest-environment happy-dom
// Cooking (model/skills/cooking.ts): recipes known as the skill reaches them, cooked only by a fire (a hearth indoors,
// a camp's, or a campfire kindled of two logs), the stews on only at a hearth; one cooked takes its makings out of the
// bag and puts the meal in, the skill up as its difficulty allows, some of the hero's own experience; stopped by
// walking off or the fire burnt out. The meals (loot/meals.ts): eaten from the bag, healing more than the inn's food,
// and from the stews on, eaten through, a blessing a while (hero/blessing.ts), one at a time, kept in a save. The
// cooking page of the skills window (controller/skills/cookBook.ts).
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { COOK_RECIPES, COOK_RECIPE_IDS, KINDLED_BURNS, KINDLE_LOGS } from '../src/model/skills/cooking';
import { MEALS, MEAL_IDS } from '../src/model/loot/meals';
import { PROVISIONS, PROVISION_IDS, givesText } from '../src/model/loot/provisions';
import { SKILLS, skillOf } from '../src/model/skills/skills';
import { eatOrDrink } from '../src/model/hero/bag';
import { blowDamage, hitTaken, mending, tiring, tossCoin } from '../src/model/hero/blessing';
import { maxHpOf } from '../src/model/hero/attributes';
import { recover } from '../src/model/hero/heroStats';
import { MEAL_SECONDS } from '../src/model/loot/provisions';
import { parseSave, restore, snapshot } from '../src/model/save';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

// A model, its hero at `level` in cooking with `bag` in their bag.
function kitchen(level = 1, bag: Record<string, number> = {}) {
  const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
  skillOf(model.hero, 'cooking').level = level;
  Object.assign(model.hero.bag, bag);
  return model;
}
const run = (model: GameModel, seconds: number, dirX = 0) => {
  for (let t = 0; t < seconds; t += 0.1) model.update(dirX, 0, 0.1);
};
// Into the first inn, stood right before its hearth.
function byTheHearth(model: GameModel): void {
  model.enterRoom(model.entrances.find((e) => e.type === 'inn')!);
  const hearth = model.inside!.furniture.find((f) => f.kind === 'hearth')!;
  Object.assign(model.hero, { x: hearth.x + hearth.w / 2 - 0.5, z: hearth.z + 0.8 });
}
// A campfire kindled before them, of logs given them.
function byACampfire(model: GameModel): void {
  model.hero.bag.birchLog = (model.hero.bag.birchLog ?? 0) + KINDLE_LOGS;
  expect(model.cooking.kindle()).toBe(true);
}

describe('cooking', () => {
  it('has a recipe for every meal, in the order of the skill they want, from 1 to near the top; the four fish among them', () => {
    expect(COOK_RECIPE_IDS.slice().sort()).toEqual(MEAL_IDS.slice().sort());
    const needs = COOK_RECIPE_IDS.map((id) => COOK_RECIPES[id].needs);
    expect(needs).toEqual([...needs].sort((a, b) => a - b));
    expect(needs[0]).toBe(1);
    expect(needs.at(-1)).toBeGreaterThan(250);
    const fishAt = (fish: string) => Math.min(...COOK_RECIPE_IDS.filter((id) => fish in COOK_RECIPES[id].from).map((id) => COOK_RECIPES[id].needs));
    expect([fishAt('smallFry'), fishAt('riverTrout'), fishAt('lakePerch'), fishAt('pike')]).toEqual([1, 75, 90, 150]);
    expect(SKILLS.cooking.practice).toBeTruthy(); // (practicable)
  });

  it('cooks only by a fire: none outdoors at first, nor indoors away from the hearth', () => {
    const model = kitchen(1, { rawBoarMeat: 2 });
    expect(model.cooking.fireInReach).toBeNull();
    expect(model.cooking.canMake('roastBoar')).toBe(2); // (the makings are there…)
    expect(model.cooking.start('roastBoar')).toBe(false); // (…but no fire)
    model.enterRoom(model.entrances.find((e) => e.type === 'inn')!);
    const hearth = model.inside!.furniture.find((f) => f.kind === 'hearth')!;
    Object.assign(model.hero, { x: hearth.x, z: hearth.z + 5 });
    expect(model.cooking.fireInReach).toBeNull();
    byTheHearth(model);
    expect(model.cooking.fireInReach?.kind).toBe('hearth');
    expect(model.cooking.start('roastBoar')).toBe(true);
  });

  it("cooks over a camp's fire", () => {
    const model = kitchen(1, { rawBoarMeat: 1 });
    const camp = model.camps[0];
    Object.assign(model.hero, { x: camp.x + 1, z: camp.z });
    expect(model.cooking.fireInReach).toEqual({ kind: 'campfire', x: camp.x, z: camp.z });
  });

  it('kindles a campfire of two logs outdoors (not indoors, not without them), which burns out after a while', () => {
    const model = kitchen(1, { rawBoarMeat: 1 });
    expect(model.cooking.kindle()).toBe(false); // (no logs)
    model.hero.bag.pineLog = 1;
    model.hero.bag.birchLog = 1;
    expect(model.cooking.kindle()).toBe(true);
    expect([model.hero.bag.pineLog, model.hero.bag.birchLog]).toEqual([undefined, undefined]);
    expect(model.cooking.fireInReach?.kind).toBe('campfire');
    expect(model.cooking.start('roastBoar')).toBe(true); // (a roast over it)
    model.cooking.stop();
    model.cooking.kindled!.left = 0.5;
    run(model, 1);
    expect(model.cooking.kindled).toBeNull();
    expect(model.cooking.fireInReach).toBeNull();
    byTheHearth(model);
    model.hero.bag.oakLog = 2;
    expect(model.cooking.kindle()).toBe(false); // (indoors: a hearth's there for it)
    expect(model.hero.bag.oakLog).toBe(2);
    expect(KINDLED_BURNS).toBeGreaterThan(60);
  });

  it('wants a hearth for the stews, pies and feasts; a campfire does for roasts and fish', () => {
    const model = kitchen(300, { rawBoarMeat: 4, salt: 2 });
    byACampfire(model);
    expect(model.cooking.byFireFor('roastBoar')).toBe(true);
    expect(model.cooking.byFireFor('boarStew')).toBe(false);
    expect(model.cooking.start('boarStew')).toBe(false);
    byTheHearth(model);
    expect(model.cooking.start('boarStew')).toBe(true);
    for (const id of COOK_RECIPE_IDS) expect(!!COOK_RECIPES[id].hearth, id).toBe(['Stews', 'Pies', 'Feasts'].includes(COOK_RECIPES[id].group));
  });

  it('cooks one: its makings out of the bag, the meal in, the skill up (orange), some experience; told', () => {
    const model = kitchen(1, { rawBoarMeat: 2 });
    byTheHearth(model);
    const xp = model.hero.xp;
    expect(model.cooking.start('roastBoar')).toBe(true);
    expect(model.cooking.progress).toBe(0);
    run(model, COOK_RECIPES.roastBoar.seconds + 0.05);
    expect([model.hero.bag.rawBoarMeat, model.hero.bag.roastBoar]).toEqual([1, 1]);
    expect(skillOf(model.hero, 'cooking').level).toBe(2);
    expect(model.hero.xp).toBeGreaterThan(xp);
    expect(model.cooking.making).toBeNull();
    const events = model.takeEvents();
    expect(events).toContainEqual({ kind: 'crafted', item: 'roastBoar' });
    expect(events).toContainEqual({ kind: 'skillUp', skill: 'Cooking', level: 2 });
  });

  it('knows a recipe only once the skill reaches it', () => {
    const model = kitchen(1, { riverTrout: 3 });
    byTheHearth(model);
    expect(model.cooking.knows('grilledTrout')).toBe(false);
    expect(model.cooking.canMake('grilledTrout')).toBe(0);
    expect(model.cooking.start('grilledTrout')).toBe(false);
    skillOf(model.hero, 'cooking').level = 75;
    expect(model.cooking.canMake('grilledTrout')).toBe(3);
  });

  it('cooks all the bag allows, and a grey recipe teaches nothing more', () => {
    const model = kitchen(200, { smallFry: 7 });
    byTheHearth(model);
    expect(model.cooking.start('roastedFry', Infinity)).toBe(true);
    run(model, COOK_RECIPES.roastedFry.seconds * 3 + 0.5);
    expect([model.hero.bag.smallFry, model.hero.bag.roastedFry]).toEqual([1, 3]);
    expect(skillOf(model.hero, 'cooking').level).toBe(200);
  });

  it('stops when the hero walks off, or the fire they cook over burns out', () => {
    const model = kitchen(1, { rawBoarMeat: 3 });
    byTheHearth(model);
    model.cooking.start('roastBoar', 3);
    run(model, 0.5, 1);
    expect(model.cooking.making).toBeNull();
    expect(model.hero.bag.rawBoarMeat).toBe(3);
    const outdoors = kitchen(1, { rawBoarMeat: 3 });
    byACampfire(outdoors);
    outdoors.cooking.start('roastBoar', 3);
    outdoors.cooking.kindled!.left = 0.3;
    run(outdoors, 1);
    expect(outdoors.cooking.making).toBeNull();
  });
});

describe('meals', () => {
  it('heal more than the inn food they stand for, and nobody sells them', () => {
    const innBest = Math.max(...PROVISION_IDS.map((id) => PROVISIONS[id].heal ?? 0));
    expect(MEALS.bearSteak.heal).toBeGreaterThanOrEqual(PROVISIONS.roastLeg.heal!);
    expect(MEALS.huntersFeast.heal).toBeGreaterThan(innBest);
    expect(MEALS.roastBoar.heal).toBeGreaterThan(PROVISIONS.bread.heal!);
    for (const id of MEAL_IDS) expect(PROVISION_IDS as readonly string[]).not.toContain(id);
    expect(givesText('boarStew')).toBe('Heals 40% over 15 seconds, then Well fed for 15 minutes');
    expect(givesText('honeyCake')).toBe('Heals 25% and restores 50% energy over 15 seconds, then Fortified for 20 minutes');
  });

  it("give their blessing once eaten through (not if got up from), one meal's at a time, kept through a well's toss", () => {
    const model = kitchen();
    const { hero } = model;
    Object.assign(hero, { hp: 1, bag: { boarStew: 2, huntersPie: 1 } });
    expect(eatOrDrink(hero, 'boarStew')).toBe(true);
    for (let t = 0; t < MEAL_SECONDS / 2; t += 0.1) recover(hero, 0.1, false, true);
    hero.eating = null; // (got up: the rest left)
    expect(hero.blessings ?? []).toEqual([]);
    expect(eatOrDrink(hero, 'boarStew')).toBe(true);
    for (let t = 0; t < MEAL_SECONDS + 0.2; t += 0.1) recover(hero, 0.1, false, true);
    expect(hero.blessings).toEqual([{ kind: 'fed', left: 15 * 60 }]);
    hero.money = 100;
    tossCoin(hero, 0);
    expect(hero.blessings!.map((b) => b.kind)).toContain('fed');
    expect(eatOrDrink(hero, 'huntersPie')).toBe(true);
    for (let t = 0; t < MEAL_SECONDS + 0.2; t += 0.1) recover(hero, 0.1, false, true);
    expect(hero.blessings!.map((b) => b.kind)).not.toContain('fed'); // (the pie's in place of the stew's)
    expect(hero.blessings!.map((b) => b.kind)).toContain('fortified');
  });

  it("Well fed mends a little each second up and about; Fortified takes a blow's sting and slows tiring; Feasted both, and a harder blow", () => {
    const model = kitchen();
    const { hero } = model;
    hero.hp = 1;
    recover(hero, 10);
    expect(hero.hp).toBe(1); // (hardcore: nothing back by itself)
    hero.blessings = [{ kind: 'fed', left: 60 }];
    expect(mending(hero)).toBeGreaterThan(0);
    recover(hero, 10);
    expect(hero.hp).toBeCloseTo(1 + maxHpOf(hero) * mending(hero) * 10, 5);
    expect([blowDamage(hero, 5), hitTaken(hero, 5), tiring(hero)]).toEqual([5, 5, 1]);
    hero.blessings = [{ kind: 'fortified', left: 60 }];
    expect([blowDamage(hero, 5), hitTaken(hero, 5), mending(hero)]).toEqual([5, 4, 0]);
    expect(tiring(hero)).toBeLessThan(1);
    hero.blessings = [{ kind: 'feasted', left: 60 }];
    expect([blowDamage(hero, 5), hitTaken(hero, 5)]).toEqual([6, 4]);
    expect(mending(hero)).toBeGreaterThan(0);
  });

  it("wear off with time, and a meal's blessing is kept in a save", () => {
    const model = kitchen();
    model.hero.blessings = [{ kind: 'feasted', left: 100 }];
    run(model, 1);
    expect(model.hero.blessings[0].left).toBeCloseTo(99, 0);
    const again = new GameModel(model.seed, TEST_MAP_SIZE);
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(again.hero.blessings?.[0].kind).toBe('feasted');
    expect(again.hero.blessings?.[0].left).toBeCloseTo(99, 0);
  });
});

describe('by a fire', () => {
  it("E there opens cooking's recipes (before the hearth, and by a kindled campfire); the bar over the hero says what's cooking", async () => {
    const { interactionOf } = await import('../src/model/hero/interaction');
    const { castOf } = await import('../src/controller/skills/castOf');
    const model = kitchen(1, { rawBoarMeat: 2 });
    byACampfire(model);
    expect(interactionOf(model, new Set(['traveller', 'talk']))?.kind).toBe('fire'); // (whoever's passing by at the start, passed over)
    byTheHearth(model);
    expect(interactionOf(model)?.kind).toBe('fire');
    model.cooking.start('roastBoar', 2);
    expect(castOf(model)?.label).toBe('Roast boar · 2 to cook');
  });
});

// @vitest-environment happy-dom
// Cooking (model/skills/cooking.ts): recipes known as the skill reaches them, cooked only by a fire (a hearth indoors,
// a camp's, or a campfire kindled of two logs), the stews on only at a hearth; one cooked takes its makings out of the
// bag and puts the meal in, the skill up as its difficulty allows, some of the hero's own experience; stopped by
// walking off or the fire burnt out. The meals (loot/meals.ts): eaten from the bag, healing more than the inn's food,
// and from the stews on, eaten through, a blessing a while (hero/blessing.ts), one at a time, kept in a save. The
// cooking page of the skills window (controller/skills/cookBook.ts).
import { describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { COOK_RECIPES, COOK_RECIPE_IDS, HUNTED_WORTH, KINDLED_BURNS, KINDLE_LOGS, dishWorth } from '../src/model/skills/cooking';
import { MEALS, MEAL_IDS } from '../src/model/loot/meals';
import { PROVISIONS, PROVISION_IDS, givesText } from '../src/model/loot/provisions';
import { SKILLS, skillOf, stepsOf } from '../src/model/skills/skills';
import { eatOrDrink } from '../src/model/hero/bag';
import { blowDamage, hitTaken, mending, spared, tiring, tossCoin } from '../src/model/hero/blessing';
import { maxHpOf } from '../src/model/hero/attributes';
import { recover } from '../src/model/hero/heroStats';
import { MEAL_SECONDS } from '../src/model/loot/provisions';
import { bagRoom } from '../src/model/hero/bagSlots';
import { parseSave, restore, snapshot } from '../src/model/save';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

vi.mock('../src/view/ui/voxelIcon', () => ({ voxelIcon: () => document.createElement('canvas') }));
const { cookBook } = await import('../src/controller/skills/cookBook');
const { newBook } = await import('../src/controller/skills/recipeBook');

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
  it("roasts the last of the fry in a full bag: their slot is the meal's", () => {
    const model = kitchen(1, { smallFry: 2 });
    byACampfire(model);
    for (let i = 0; Object.keys(model.hero.bag).length < bagRoom(model.hero); i++) model.hero.bag[`dagger@${i + 2}c0` as never] = 1 as never; // (every other slot a dagger)
    expect(model.cooking.start('roastedFry')).toBe(true);
    run(model, COOK_RECIPES.roastedFry.seconds + 0.2);
    expect([model.hero.bag.smallFry, model.hero.bag.roastedFry]).toEqual([undefined, 1]);
  });

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

  it('kindles it on open ground: on a shore, facing the lake, behind or beside them, not in the water', () => {
    const model = kitchen(1, { birchLog: KINDLE_LOGS });
    let shore: { x: number; z: number } | undefined;
    for (let x = 2; x < TEST_MAP_SIZE.width - 2 && !shore; x++) for (let z = 2; z < TEST_MAP_SIZE.depth - 2 && !shore; z++) if (model.isOpenTile(x, z) && model.tiles.lake(x + 1, z)) shore = { x, z };
    model.teleport(shore!.x, shore!.z);
    model.hero.facing = Math.PI / 2; // (toward +x: the water)
    expect(model.cooking.kindle()).toBe(true);
    const { x, z } = model.cooking.kindled!;
    expect(model.tiles.lake(Math.round(x), Math.round(z))).toBe(false);
    expect(model.isOpenTile(Math.round(x), Math.round(z))).toBe(true);
    expect(model.cooking.fireInReach?.kind).toBe('campfire');
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
    skillOf(model.hero, 'cooking').toward = stepsOf('cooking', 1) - 1; // (a meal short of the next level)
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

  it("counts a dish of a hunt's meat or honeycomb as more tries than a fish's (dear to come by), and one of several bigger fish as one for each", () => {
    expect([dishWorth('roastBoar'), dishWorth('wolfSkewer'), dishWorth('honeyCake'), dishWorth('huntersFeast')]).toEqual([HUNTED_WORTH, HUNTED_WORTH, HUNTED_WORTH, HUNTED_WORTH]);
    expect([dishWorth('roastedFry'), dishWorth('fryChowder'), dishWorth('pikePie')]).toEqual([1, 1, 1]); // (the fry and roach: a moment's catch)
    expect([dishWorth('fishStew'), dishWorth('bakedBream'), dishWorth('riverFeast'), dishWorth('anglersFeast')]).toEqual([2, 2, 3, 4]);
  });

  it('has a dish of every fish caught, the salmon grilled at 240', () => {
    for (const fish of ['smallFry', 'roach', 'riverTrout', 'lakePerch', 'eel', 'bream', 'grayling', 'char', 'pike', 'salmon', 'sturgeon']) expect(COOK_RECIPE_IDS.some((id) => fish in COOK_RECIPES[id].from), fish).toBe(true);
    expect(COOK_RECIPES.grilledSalmon).toMatchObject({ needs: 240, from: { salmon: 1, salt: 1 }, makes: 'grilledSalmon' });
    expect(MEALS.grilledSalmon.value).toBe(26); // (under the smoked sturgeon, a harder fish's)
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
    expect([blowDamage(hero, 5), hitTaken(hero, 5), spared(hero), tiring(hero)]).toEqual([5, 5, 0, 1]);
    hero.blessings = [{ kind: 'fortified', left: 60 }];
    expect([blowDamage(hero, 5), spared(hero), mending(hero)]).toEqual([5, 0.15, 0]);
    expect(tiring(hero)).toBeLessThan(1);
    hero.blessings = [{ kind: 'feasted', left: 60 }];
    expect([blowDamage(hero, 5), spared(hero)]).toEqual([5.75, 0.15]); // (15% harder)
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

  it('a meal half eaten is kept in a save as it was (neither lost nor given back whole), and a campfire lit burns on', () => {
    const model = kitchen(1, { huntersFeast: 1 });
    byACampfire(model);
    model.hero.hp = 1;
    expect(eatOrDrink(model.hero, 'huntersFeast')).toBe(true);
    run(model, 5);
    const again = new GameModel(model.seed, TEST_MAP_SIZE);
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(again.hero.bag.huntersFeast).toBeUndefined();
    expect(again.hero.eating).toMatchObject({ item: 'huntersFeast', fed: { kind: 'feasted' } });
    expect(again.hero.eating!.left).toBeCloseTo(model.hero.eating!.left, 1);
    expect(again.cooking.kindled).toEqual(model.cooking.kindled);
    expect(again.cooking.fireInReach?.kind).toBe('campfire');
    run(again, MEAL_SECONDS);
    expect([again.hero.eating, again.hero.blessings?.some((b) => b.kind === 'feasted')]).toEqual([null, true]);
    // Damaged: neither.
    const data = parseSave(JSON.stringify(snapshot(model)), model.seed)!;
    Object.assign(data, { kindled: { x: 'a', z: 1, left: 9 } });
    Object.assign(data.hero, { eating: { item: 'rock', heal: 5, left: 3 } });
    const broken = new GameModel(model.seed, TEST_MAP_SIZE);
    restore(broken, data);
    expect([broken.cooking.kindled, broken.hero.eating]).toEqual([null, null]);
  });
});

describe('by a fire', () => {
  it("E there opens cooking's recipes (before the hearth, and by a kindled campfire); the bar over the hero says what's cooking", async () => {
    const { interactionOf } = await import('../src/model/hero/interaction');
    const { castOf } = await import('../src/controller/skills/castOf');
    const model = kitchen(1, { rawBoarMeat: 2 });
    byACampfire(model);
    expect(interactionOf(model, new Set(['traveller', 'talk', 'carter']))?.kind).toBe('fire'); // (whoever's passing by at the start, passed over)
    byTheHearth(model);
    expect(interactionOf(model)?.kind).toBe('fire');
    model.cooking.start('roastBoar', 2);
    expect(castOf(model)?.label).toBe('Roast boar · 2 to cook');
  });
});

describe('the cook', () => {
  it('turns to the fire to cook', () => {
    const model = kitchen(1, { rawBoarMeat: 1 });
    byACampfire(model);
    model.hero.facing += Math.PI; // (turned away)
    model.cooking.start('roastBoar');
    const { x, z } = model.cooking.kindled!;
    expect(model.hero.facing).toBeCloseTo(Math.atan2(x - model.hero.x, z - model.hero.z), 5);
  });
});

describe("cooking's page", () => {
  it('lists the recipes under roasts, fish, stews, pies and feasts, the meal told as food with its blessing', () => {
    const model = kitchen(100, { rawBoarMeat: 2, salt: 1 });
    const page = cookBook(model, { picked: 'boarStew', canOnly: false, count: 1 }, () => {});
    expect(Array.from(page.querySelectorAll('.book-group')).map((g) => g.textContent)).toEqual(['Roasts', 'Fish', 'Stews', 'Pies', 'Feasts']);
    expect(page.querySelectorAll('.book-row')).toHaveLength(COOK_RECIPE_IDS.length);
    const detail = page.querySelector('.book-detail')!;
    expect(detail.querySelector('.book-kind')?.textContent).toBe('Food · Heals 40% over 15 seconds, then Well fed for 15 minutes');
    expect(detail.querySelector('.book-needs')?.textContent).toContain('Requires Cooking 100');
  });

  it('says there is no fire, its Cook buttons off, and kindles one of two logs; a campfire will not do for a stew', () => {
    const model = kitchen(100, { rawBoarMeat: 2, salt: 1, birchLog: 2 });
    const state = newBook();
    state.picked = 'roastBoar';
    let page = cookBook(model, state, () => {});
    expect(page.querySelector('.book-why')?.textContent).toContain('Stand by a fire');
    expect(page.querySelector<HTMLButtonElement>('.book-actions .book-craft')!.disabled).toBe(true);
    const kindle = page.querySelector<HTMLButtonElement>('.cook-fire button')!;
    expect(kindle.textContent).toBe('Kindle a campfire (2 logs)');
    kindle.click();
    expect(model.cooking.kindled).not.toBeNull();
    page = cookBook(model, state, () => {});
    expect(page.querySelector('.cook-fire')?.textContent).toContain('By your campfire');
    const cook = page.querySelector<HTMLButtonElement>('.book-actions .book-craft')!;
    expect([cook.disabled, cook.textContent]).toEqual([false, 'Cook']);
    cook.click();
    expect(model.cooking.making).toMatchObject({ recipe: 'roastBoar', left: 1 });
    model.cooking.stop();
    page = cookBook(model, { picked: 'boarStew', canOnly: false, count: 1 }, () => {});
    expect(page.querySelector('.book-why')?.textContent).toContain('wants a hearth');
  });
});

describe('tuning', () => {
  it("cooked meat and fish heal more than the inn's like (a bear steak over her roast leg), each Well fed a few minutes after (a roast of meat twice a fish's); a stew's longer", () => {
    expect(MEALS.bearSteak.heal).toBeGreaterThan(PROVISIONS.roastLeg.heal!);
    expect(MEALS.roastPike.heal).toBeGreaterThan(PROVISIONS.roastLeg.heal!);
    for (const id of ['roastedFry', 'fryCake', 'grilledTrout', 'saltedPerch', 'roastPike'] as const) expect(MEALS[id].fed, id).toEqual({ kind: 'fed', seconds: 4 * 60 });
    for (const id of ['roastBoar', 'wolfSkewer', 'searedLynx', 'bearSteak'] as const) expect(MEALS[id].fed, id).toEqual({ kind: 'fed', seconds: 8 * 60 });
    expect(MEALS.boarStew.fed!.seconds).toBeGreaterThan(4 * 60);
    expect(KINDLED_BURNS).toBe(8 * 60); // (time enough for a batch)
  });

  it("keeps a whole feast's half hour through a save (no meal's blessing outlasts what a save allows)", () => {
    const model = kitchen();
    const longest = Math.max(...MEAL_IDS.map((id) => MEALS[id].fed?.seconds ?? 0));
    model.hero.blessings = [{ kind: 'feasted', left: longest }];
    const again = new GameModel(model.seed, TEST_MAP_SIZE);
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(again.hero.blessings?.[0].left).toBe(longest);
  });
});

describe('butchered', () => {
  it("a beast slain leaves its meat on a roll of its own, about as often as told; a bear's honeycomb now and then; no one else's", async () => {
    const { butcher } = await import('../src/model/loot/ingredients');
    const share = (source: Parameters<typeof butcher>[0], item: string) => Array.from({ length: 2000 }, (_, id) => butcher(source, id)).filter((got) => got.includes(item as never)).length / 2000;
    expect(share('boar', 'rawBoarMeat')).toBeCloseTo(0.9, 1);
    expect(share('bear', 'rawBearMeat')).toBeCloseTo(0.9, 1);
    expect(share('bear', 'honeycomb')).toBeCloseTo(0.4, 1);
    expect(share('beast', 'rawWolfMeat')).toBeCloseTo(0.75, 1);
    expect(share('lynx', 'leanLynxMeat')).toBeCloseTo(0.8, 1);
    expect(butcher('undead', 3)).toEqual([]);
  });
});

describe('firewood', () => {
  it('a pedlar sells bundles of it; one kindles a campfire, before any logs are touched', async () => {
    const { PEDLAR_WARES, pedlarPrice } = await import('../src/model/travellers/pedlarShop');
    expect(PEDLAR_WARES).toContain('firewood');
    expect(pedlarPrice('firewood', false)).toBe(3);
    const model = kitchen(1, { firewood: 1, birchLog: 2 });
    expect(model.cooking.kindle()).toBe(true);
    expect([model.hero.bag.firewood, model.hero.bag.birchLog]).toEqual([undefined, 2]);
    expect(model.cooking.canKindle).toBe(true); // (the logs, still)
  });
});

describe('one thing at a time', () => {
  it('woodworking begun while cooking stops the cooking (and cooking begun, the woodworking)', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    Object.assign(model.hero.bag, { rawBoarMeat: 5, birchLog: 7 });
    expect(model.cooking.kindle()).toBe(true);
    expect(model.cooking.start('roastBoar', 5)).toBe(true);
    expect(model.woodworking.start('birchPlank', 5)).toBe(true);
    model.update(0, 0, 0.1);
    expect([!!model.cooking.making, !!model.woodworking.making]).toEqual([false, true]);
    expect(model.cooking.start('roastBoar', 5)).toBe(true);
    model.update(0, 0, 0.1);
    expect([!!model.cooking.making, !!model.woodworking.making]).toEqual([true, false]);
  });
});

// @vitest-environment happy-dom
// Alchemy (model/skills/alchemy.ts, herbalism.ts; loot/herbs.ts): herbs picked in the wilds, each in its country and
// season, and brewed at a cauldron (or by a fire with a brewer's kit) into potions, cures and draughts; its pacing, an
// hour or so a tier as every trade's; the herbalist's extras (stronger brews as the hero levels, brewing to order);
// all kept in the save, an older save's none picked.
import { describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { BREW_GROUPS, BREW_RECIPES, BREW_RECIPE_IDS, BREW_WORTH, KIT_SLOWER, type BrewRecipeId } from '../src/model/skills/alchemy';
import { PATCH_REACH, PULL, REGROW, SITE, herbOf, patchIn, patchesNear, pullsIn } from '../src/model/skills/herbalism';
import { HERBS, HERB_IDS, herbsIn, isHerb } from '../src/model/loot/herbs';
import { POTIONS, potionText } from '../src/model/loot/potions';
import { LOOT, LOOT_QUALITY } from '../src/model/loot/loot';
import { SEASONS } from '../src/model/clock';
import { BIOMES } from '../src/model/scenery/biomes';
import { SKILLS, SKILL_TIERS, difficulty, skillOf } from '../src/model/skills/skills';
import { drinkPotion, potionRefused } from '../src/model/hero/bag';
import { makeWebbed, givePox, hasPox, makeWeary, feed, tossCoin } from '../src/model/hero/blessing';
import { HERO_SPEED } from '../src/model/constants';
import { interactionOf } from '../src/model/hero/interaction';
import { parseSave, restore, snapshot } from '../src/model/save';
import { BREWS_AT, KIT, ORDER_MOST, brewToOrder, herbalistBuys, herbalistShopAt, herbalistWares, orderFee, orderFor } from '../src/model/herbalist/herbalistShop';
import { visitHerbalist } from '../src/model/cheats';
import { herbPrompt } from '../src/controller/skills/herbPrompt';
import { TEST_MAP_SIZE } from './support/testWorld';

vi.mock('../src/view/ui/voxelIcon', () => ({ voxelIcon: () => document.createElement('canvas') }));
const { alchemyBook } = await import('../src/controller/skills/alchemyBook');
const { newBook } = await import('../src/controller/skills/recipeBook');

const run = (model: GameModel, seconds: number) => {
  for (let t = 0; t < seconds; t += 0.1) model.update(0, 0, 0.1);
};

// A model, the hero stood by the first patch with something up on it this season (spring, a new game's), skilled
// enough for it; and the patch.
function byAPatch(seed = 2) {
  const model = new GameModel(seed, TEST_MAP_SIZE);
  const patch = model.herbs.growing(model.size.width / 2, model.size.depth / 2, Math.max(model.size.width, model.size.depth)).find((p) => !model.isBlocked(p.x + 0.6, p.z, 0.2))!;
  Object.assign(model.hero, { x: patch.x + 0.6, z: patch.z });
  skillOf(model.hero, 'alchemy').level = HERBS[patch.herb].needs;
  return { model, patch };
}

// Into a herbalist's house, stood before their cauldron, at `level` with `bag`.
function atTheCauldron(level = 1, bag: Record<string, number> = {}) {
  const model = new GameModel(2, TEST_MAP_SIZE);
  expect(visitHerbalist(model, new Set())).toBe(true);
  const cauldron = model.inside!.furniture.find((f) => f.kind === 'cauldron')!;
  Object.assign(model.hero, { x: cauldron.x, z: cauldron.z + 0.8 });
  skillOf(model.hero, 'alchemy').level = level;
  Object.assign(model.hero.bag, bag);
  return model;
}

describe('herbs in their season', () => {
  it('are real loot (ingredients), each its country and its seasons, wanting the skill', () => {
    for (const id of HERB_IDS) {
      expect([isHerb(id), LOOT_QUALITY[id], LOOT[id].value > 0]).toEqual([true, 'ingredient', true]);
      expect(HERBS[id].in.length).toBeGreaterThan(0);
      expect(HERBS[id].seasons.length).toBeGreaterThan(0);
    }
    expect(HERBS.foxglove.in).toContain('heath'); // (foxglove on the moors in summer)
    expect(HERBS.foxglove.seasons).toEqual(['summer']);
    expect(HERBS.woundwort.in).toEqual(['marsh']);
    expect(HERBS.flyAgaric.seasons).toEqual(['autumn']);
    expect(HERBS.hellebore.seasons).toContain('winter');
  });

  it('give every season something to learn from at every tier (none more than 75 short of the last)', () => {
    for (const season of SEASONS) {
      const needs = HERB_IDS.filter((id) => HERBS[id].seasons.includes(season)).map((id) => HERBS[id].needs);
      expect(Math.min(...needs), season).toBe(1);
      for (let level = 1; level < 300; level++) expect(needs.some((n) => difficulty(n, level).chance > 0 && n <= level), `${season} at ${level}`).toBe(true);
    }
  });

  it('grow in every country in the warm months, and something is up somewhere each winter', () => {
    for (const country of BIOMES) for (const season of ['spring', 'summer', 'autumn'] as const) expect(herbsIn(country, season).length, `${country} in ${season}`).toBeGreaterThan(0);
    expect(BIOMES.filter((b) => herbsIn(b, 'winter').length > 0).length).toBeGreaterThanOrEqual(4);
  });

  it('lie in patches by the seed, on open natural ground, one at most a cell; the same each time', () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    const patches = patchesNear(model, model.size.width / 2, model.size.depth / 2, model.size.width);
    expect(patches.length).toBeGreaterThan(20);
    for (const p of patches.slice(0, 60)) {
      expect([model.tiles.surface(p.x, p.z), model.isOpenTile(p.x, p.z)]).toEqual(['natural', true]);
      expect(patchIn(model, Math.floor(p.x / SITE), Math.floor(p.z / SITE))).toEqual(p);
    }
  });

  it("grow what's up in their country that season: the same patch something else as the year turns", () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    const patches = patchesNear(model, model.size.width / 2, model.size.depth / 2, model.size.width);
    for (const p of patches.slice(0, 80))
      for (const season of SEASONS) {
        const herb = herbOf(model.seed, p, season);
        if (herb) expect(HERBS[herb].seasons).toContain(season);
      }
    const turns = patches.filter((p) => new Set(SEASONS.map((s) => herbOf(model.seed, p, s))).size > 1);
    expect(turns.length).toBeGreaterThan(patches.length / 2);
    expect(model.herbs.season).toBe('spring'); // (a new game's)
    for (const p of model.herbs.growing(model.size.width / 2, model.size.depth / 2, 60)) expect(HERBS[p.herb].seasons).toContain('spring');
  });
});

describe('picking herbs', () => {
  it('says what E would do; E picks on its own, a herb at a time into the bag, the skill toward its next level', () => {
    const { model, patch } = byAPatch();
    expect(interactionOf(model)?.kind).toBe('pick');
    expect(herbPrompt(model)?.label).toMatch(new RegExp(`^Pick ${LOOT[patch.herb].name.toLowerCase()} · \\d herbs?`));
    expect(model.herbs.use()).toBe(true);
    expect(interactionOf(model)?.kind).toBe('stopPick');
    run(model, PULL + 0.15);
    expect(model.hero.bag[patch.herb]).toBe(1);
    expect(skillOf(model.hero, 'alchemy').toward).toBe(1); // (orange: always)
    run(model, PULL * 5);
    expect(model.hero.bag[patch.herb]).toBe(pullsIn(model.seed, patch)); // (picked bare: no second herb under 100)
    expect([model.herbs.picking, model.herbs.left(patch)]).toEqual([null, 0]);
    expect(model.herbs.growing(patch.x, patch.z, 0.5)).toEqual([]); // (gone, till it's back)
  });

  it("wants the skill to know it: told why not, a hand at it already", () => {
    const { model, patch } = byAPatch();
    if (HERBS[patch.herb].needs === 1) return void expect(model.herbs.action?.kind).toBe('pick'); // (anyone knows the first)
    skillOf(model.hero, 'alchemy').level = HERBS[patch.herb].needs - 1;
    expect(interactionOf(model)?.kind).toBe('cannotPick');
    expect(model.herbs.use()).toBe(false);
  });

  it('stops when they walk off, press E again, or take up another trade; only in reach close by, outdoors', () => {
    const { model, patch } = byAPatch();
    model.herbs.use();
    model.update(1, 0, 0.1);
    expect(model.herbs.picking).toBeNull();
    model.hero.x = patch.x + 0.6;
    model.herbs.use();
    expect(model.herbs.use()).toBe(true); // (E again)
    expect(model.herbs.picking).toBeNull();
    model.hero.x = patch.x + PATCH_REACH + 0.5;
    expect(model.herbs.action).toBeNull();
  });

  it('comes back a day after it was picked bare', () => {
    const { model, patch } = byAPatch();
    model.herbs.use();
    run(model, PULL * 5);
    model.minutes += REGROW - 20;
    run(model, 0.2);
    expect(model.herbs.left(patch)).toBe(0);
    model.minutes += 30;
    run(model, 0.2);
    expect(model.herbs.left(patch)).toBe(pullsIn(model.seed, patch));
  });

  it("are kept so in the save; an older save's (none) none picked, a broken one made sound", () => {
    const { model, patch } = byAPatch();
    model.herbs.use();
    run(model, PULL + 0.15);
    const again = new GameModel(model.seed, TEST_MAP_SIZE);
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(again.herbs.left(patch)).toBe(model.herbs.left(patch));
    expect(again.herbs.saved().picked).toEqual(model.herbs.saved().picked);
    for (const [key, at] of Object.entries(model.herbs.saved().at)) expect(again.herbs.saved().at[key]).toBeCloseTo(at, -1); // (the clock saved to the minute)
    const old = snapshot(model) as unknown as Record<string, unknown>;
    delete old.herbs;
    const older = new GameModel(model.seed, TEST_MAP_SIZE);
    restore(older, parseSave(JSON.stringify(old), model.seed)!);
    expect(older.herbs.saved()).toEqual({ picked: {}, at: {} });
    older.herbs.restore({ picked: { '3,4': 99, 'x,y': 1, '5,6': 'two' }, at: { '3,4': 'soon' } });
    expect(older.herbs.saved()).toEqual({ picked: { '3,4': 4 }, at: { '3,4': older.minutes } });
  });
});

describe('brewing', () => {
  it('has recipes for the six potions and brews of its own, in the order of the skill they want, the cave parts used', () => {
    const needs = BREW_RECIPE_IDS.map((id) => BREW_RECIPES[id].needs);
    expect(needs).toEqual([...needs].sort((a, b) => a - b));
    const makes = new Set(BREW_RECIPE_IDS.map((id) => BREW_RECIPES[id].makes));
    for (const p of Object.keys(POTIONS)) expect(makes.has(p as never), p).toBe(true);
    const used = new Set(BREW_RECIPE_IDS.flatMap((id) => Object.keys(BREW_RECIPES[id].from)));
    for (const part of ['spiderSilk', 'venomGland', 'batWing', ...HERB_IDS]) expect(used.has(part), part).toBe(true);
    for (const id of BREW_RECIPE_IDS) expect(BREW_GROUPS).toContain(BREW_RECIPES[id].group);
    for (const tier of SKILL_TIERS) expect(needs.some((n) => n >= tier.from && n < tier.to)).toBe(true);
  });

  it('brews only at a still: a cauldron stood before, or a fire with a kit', () => {
    const model = atTheCauldron(1, { chamomile: 4 });
    expect([model.alchemy.stillInReach?.kind, interactionOf(model)?.kind]).toEqual(['cauldron', 'cauldron']);
    model.hero.z += 1.5;
    expect(model.alchemy.start('minorHealth')).toBe(false);
    const outdoors = new GameModel(2, TEST_MAP_SIZE);
    Object.assign(outdoors.hero.bag, { chamomile: 2, birchLog: 2 });
    expect(outdoors.cooking.kindle()).toBe(true);
    expect(outdoors.alchemy.stillInReach).toBeNull(); // (no kit)
    outdoors.hero.bag[KIT] = 1;
    expect(outdoors.alchemy.stillInReach?.kind).toBe('kit');
    expect(outdoors.alchemy.secondsOf('minorHealth')).toBeCloseTo(BREW_RECIPES.minorHealth.seconds * KIT_SLOWER, 9);
    expect(outdoors.alchemy.start('minorHealth')).toBe(true);
  });

  it('brews one: its herbs out of the bag, the potion in, the skill up (two tries), some experience', () => {
    const model = atTheCauldron(1, { chamomile: 4 });
    const xp = model.hero.xp;
    expect(model.alchemy.start('minorHealth', 2)).toBe(true);
    run(model, BREW_RECIPES.minorHealth.seconds + 0.05);
    expect([model.hero.bag.chamomile, model.hero.bag.minorHealthPotion, skillOf(model.hero, 'alchemy').toward]).toEqual([2, 1, BREW_WORTH]);
    expect(model.hero.xp).toBeGreaterThan(xp);
    run(model, BREW_RECIPES.minorHealth.seconds + 0.05);
    expect([model.hero.bag.chamomile ?? 0, model.hero.bag.minorHealthPotion, model.alchemy.making]).toEqual([0, 2, null]);
  });

  it('knows a recipe only once the skill reaches it; walking off stops it', () => {
    const model = atTheCauldron(74, { yarrow: 4, chamomile: 2 });
    expect(model.alchemy.canMake('lesserHealth')).toBe(0);
    skillOf(model.hero, 'alchemy').level = 75;
    expect(model.alchemy.start('lesserHealth')).toBe(true);
    model.update(0, 1, 0.1);
    expect(model.alchemy.making).toBeNull();
  });

  it('shows a page of brews (Healing to Oddities) over the still, and a page of herbs, those in season marked', () => {
    const model = atTheCauldron(1, { chamomile: 2 });
    const page = { half: 'brew' as const, book: newBook(), herb: null };
    const brew = alchemyBook(model, page, () => {});
    expect(Array.from(brew.querySelectorAll('.book-group')).map((g) => g.textContent)).toEqual([...BREW_GROUPS]);
    expect(brew.querySelector('.cook-fire')?.textContent).toContain('At a cauldron');
    const herbs = alchemyBook(model, { ...page, half: 'herbs' }, () => {});
    expect(herbs.querySelectorAll('.book-row')).toHaveLength(HERB_IDS.length);
    expect(herbs.querySelector('.book-group')?.textContent).toBe('Herbs · Spring now');
    expect(Array.from(herbs.querySelectorAll('.book-row')).filter((r) => r.textContent?.includes('in season')).length).toBe(HERB_IDS.filter((id) => HERBS[id].seasons.includes('spring')).length);
  });
});

describe("the brews", () => {
  it('each says what it does; a cure not drunk with nothing to cure, a philtre never', () => {
    for (const id of Object.keys(POTIONS) as Array<keyof typeof POTIONS>) expect(potionText(id).length).toBeGreaterThan(8);
    const { hero } = new GameModel(2, TEST_MAP_SIZE);
    hero.bag = { antidote: 1, lovePhiltre: 1, poxSalve: 1 };
    expect(potionRefused(hero, 'antidote')).toBe('Nothing on you for it to cure.');
    expect(potionRefused(hero, 'lovePhiltre')).toMatch(/sweat/);
    makeWebbed(hero, 20);
    expect(drinkPotion(hero, 'antidote')).toBe(true);
    expect(hero.blessings).toEqual([]);
    hero.potionCooldown = 0;
    givePox(hero);
    expect(drinkPotion(hero, 'poxSalve')).toBe(true);
    expect(hasPox(hero)).toBe(false);
  });

  it("a purge sees off Weary and the last meal; a draught gives its blessing in place of a well's, a meal's kept", () => {
    const { hero } = new GameModel(2, TEST_MAP_SIZE);
    hero.bag = { purge: 1, oxDraught: 1 };
    makeWeary(hero);
    feed(hero, 'fed', 60);
    expect(drinkPotion(hero, 'purge')).toBe(true);
    expect(hero.blessings).toEqual([]);
    hero.potionCooldown = 0;
    feed(hero, 'fed', 60);
    hero.money = 1000;
    tossCoin(hero, 0);
    expect(drinkPotion(hero, 'oxDraught')).toBe(true);
    expect(hero.blessings!.map((b) => b.kind).sort()).toEqual(['fed', 'strong']);
  });
});

describe('pacing', () => {
  // An hour of it, as a hand that keeps to what teaches plays it: walking to the next patch of a herb that still teaches
  // them (a third of the patches about), picking it bare, brewing what's picked; each try at about the yellow's odds and
  // better (0.8). The steps of each tier, against the hour or so of every trade's (skills.ts).
  const hoursAt = (tier: number) => {
    const walk = SITE / Math.sqrt(0.55 / 3) / HERO_SPEED; // seconds to the next useful patch
    const pulls = 3; // a patch's, about
    const recipes = BREW_RECIPE_IDS.filter((id) => BREW_RECIPES[id].needs >= SKILL_TIERS[tier].from - 75 && BREW_RECIPES[id].needs < SKILL_TIERS[tier].to);
    const herbsABrew = recipes.reduce((n, id) => n + Object.values(BREW_RECIPES[id as BrewRecipeId].from).reduce((a, b) => a + b!, 0), 0) / recipes.length;
    const brews = pulls / herbsABrew;
    const brewTime = recipes.reduce((n, id) => n + BREW_RECIPES[id].seconds, 0) / recipes.length;
    const seconds = walk + pulls * PULL + brews * brewTime;
    const taught = (pulls + brews * BREW_WORTH) * 0.8;
    return ((SKILL_TIERS[tier].to - SKILL_TIERS[tier].from) * SKILLS.alchemy.steps[tier] * seconds) / taught / 3600;
  };

  it('an hour or so a tier, the whole of it three to five', () => {
    const hours = SKILL_TIERS.map((_, i) => hoursAt(i));
    for (const h of hours) [expect(h).toBeGreaterThan(0.7), expect(h).toBeLessThan(1.6)];
    const all = hours.reduce((a, b) => a + b, 0);
    expect(all).toBeGreaterThan(3);
    expect(all).toBeLessThan(5);
  });
});

describe("the herbalist's extras", () => {
  it('sells stronger brews as the hero levels, and a kit; buys herbs at their worth', () => {
    expect(herbalistWares(1)).not.toContain('antidote');
    expect(herbalistWares(1)).toContain(KIT);
    for (const [id, at] of BREWS_AT) [expect(herbalistWares(at - 1)).not.toContain(id), expect(herbalistWares(at)).toContain(id)];
    expect(herbalistWares(30)).not.toContain('lovePhiltre');
    for (const id of HERB_IDS) expect(herbalistBuys(id)).toBe(true);
  });

  it('brews to order from the hero\'s herbs for a fee, whatever their skill (up to their own), the dearest the bag makes', () => {
    const model = new GameModel(2, TEST_MAP_SIZE);
    const herbalist = model.npcs.find((n) => n.role === 'herbalist')!;
    const shop = herbalistShopAt(model.shops, model.seed, herbalist);
    const { hero } = model;
    hero.bag = { comfrey: 2, woundwort: 2, spiderSilk: 1, chamomile: 2 };
    expect(orderFor(hero)).toBe('greaterHealth');
    expect(brewToOrder(shop, hero, 'greaterHealth')).toBe('too poor');
    hero.money = 500;
    const purse = shop.money;
    expect(brewToOrder(shop, hero, 'greaterHealth')).toBe('brewed');
    expect([hero.bag.greaterHealthPotion, hero.bag.comfrey ?? 0, hero.money, shop.money - purse]).toEqual([1, 0, 500 - orderFee('greaterHealth'), orderFee('greaterHealth')]);
    expect(orderFee('greaterHealth') + 2 * LOOT.comfrey.value + LOOT.woundwort.value + LOOT.spiderSilk.value).toBeLessThan(POTIONS.greaterHealthPotion.value); // (well under its price)
    expect(brewToOrder(shop, hero, 'greaterHealth')).toBe('short');
    expect(BREW_RECIPES.superiorHealth.needs).toBeGreaterThan(ORDER_MOST);
    expect(brewToOrder(shop, hero, 'superiorHealth')).toBe('beyond');
  });
});

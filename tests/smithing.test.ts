// @vitest-environment happy-dom
// Smithing (model/skills/smithing.ts): metal worked at a smithy's anvil, as woodworking's wood is: ore and salvaged
// scrap smelted into ingots, ingots into fittings, picks and the smith's own wares (never finer than he forges at
// their level); made only before the anvil; the skill up as its difficulty allows; the smith buys the ingots back.
import { describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { SMITH_RECIPES, SMITH_RECIPE_IDS, nextToLearn, smithRise } from '../src/model/skills/smithing';
import { isCrafted } from '../src/model/skills/salvage';
import { MATERIAL_RISE, RISE, skillOf, stepsOf } from '../src/model/skills/skills';
import { gearOf } from '../src/model/human/items/gear';
import { ITEMS } from '../src/model/human/equipment';
import { LOOT } from '../src/model/loot/loot';
import { isTool } from '../src/model/loot/tools';
import { saleOf } from '../src/model/shops/sellValue';
import { interactionOf } from '../src/model/hero/interaction';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

vi.mock('../src/view/ui/voxelIcon', () => ({ voxelIcon: () => document.createElement('canvas') }));
const { recipeBook, newBook } = await import('../src/controller/skills/recipeBook');
const { SMITHING } = await import('../src/controller/skills/smithBook');

// A world with a smithy, the hero stood before its anvil, at `level` in smithing with `bag` in their bag.
function atTheAnvil(level = 1, bag: Record<string, number> = {}) {
  const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
  const smithy = model.entrances.find((e) => e.type === 'smithy')!;
  model.teleport(smithy.x, smithy.z);
  model.useDoor();
  const anvil = model.inside!.furniture.find((f) => f.kind === 'anvil')!;
  Object.assign(model.hero, { x: anvil.x, z: anvil.z + 1 });
  skillOf(model.hero, 'smithing').level = level;
  Object.assign(model.hero.bag, bag);
  return { model, anvil };
}
const run = (model: GameModel, seconds: number, dirX = 0) => {
  for (let t = 0; t < seconds; t += 0.1) model.update(dirX, 0, 0.1);
};

describe('smithing', () => {
  it('has its recipes in the order of the skill they want, from 1 to near the top, never a gap past 25', () => {
    const needs = SMITH_RECIPE_IDS.map((id) => SMITH_RECIPES[id].needs);
    expect(needs).toEqual([...needs].sort((a, b) => a - b));
    expect(needs[0]).toBe(1);
    for (let i = 1; i < needs.length; i++) expect(needs[i] - needs[i - 1]).toBeLessThanOrEqual(25);
    expect(300 - needs.at(-1)!).toBeLessThanOrEqual(25);
  });

  it("makes nothing finer than the smith forges at its level (rare only of star-iron), and in every tier something to sell and something to use", () => {
    for (const id of SMITH_RECIPE_IDS) {
      const { makes, from } = SMITH_RECIPES[id];
      if (typeof makes === 'string') continue;
      expect(ITEMS[makes.item], id).toBeTruthy();
      if (makes.rarity !== 'common' && makes.rarity !== 'uncommon') expect((from as Record<string, number>).starIronIngot, id).toBeGreaterThan(0);
    }
    for (const [lo, hi] of [[1, 75], [75, 150], [150, 225], [225, 300]]) {
      const tier = SMITH_RECIPE_IDS.filter((id) => SMITH_RECIPES[id].needs >= lo && SMITH_RECIPES[id].needs < hi);
      const made = tier.map((id) => SMITH_RECIPES[id].makes);
      expect(made.some((m) => typeof m !== 'string' || isTool(m)), `used ${lo}`).toBe(true); // (worn, wielded or dug with)
      expect(made.some((m) => saleOf(typeof m === 'string' ? m : (m.item as never)) !== null), `sold ${lo}`).toBe(true);
    }
    for (const ingot of ['copperIngot', 'ironIngot', 'steelIngot', 'silverIngot', 'goldIngot', 'starIronIngot'] as const) expect(saleOf(ingot)?.to).toBe('a smith');
  });

  it('is made at the anvil alone: E there opens it; a recipe started, its materials out, an ingot in, the skill up; walking off stops it', () => {
    const { model } = atTheAnvil(20, { copperIngot: 6 });
    expect(interactionOf(model)?.kind).toBe('anvil');
    expect(model.smithing.anvilInReach).toBeTruthy();
    const { hero } = model;
    hero.skills!.smithing!.toward = stepsOf('smithing', 20) - 1; // (one more try that teaches: a level)
    expect(model.smithing.start('dagger', 3)).toBe(true);
    run(model, SMITH_RECIPES.dagger.seconds + 0.05);
    expect([hero.bag.copperIngot, Object.keys(hero.bag).some((k) => k.startsWith('dagger@4'))]).toEqual([4, true]);
    expect(skillOf(hero, 'smithing').level).toBe(21);
    run(model, 0.2, 1); // (a step away: stopped)
    expect(model.smithing.making).toBeNull();
    hero.x += 2; // (off from the anvil, whoever's passing)
    expect(model.smithing.start('dagger')).toBe(false); // (away from the anvil)
  });

  it("makes gear at the recipe's level and rarity, and a pick as a tool", () => {
    const { model } = atTheAnvil(300, { starIronIngot: 3, gildedFittings: 1, copperIngot: 2, birchPlank: 1 });
    expect(model.smithing.start('starIronBlade')).toBe(true);
    run(model, SMITH_RECIPES.starIronBlade.seconds + 0.05);
    const made = Object.keys(model.hero.bag).find((k) => k.startsWith('armingSword'))!;
    expect(gearOf(made as never)).toMatchObject({ item: 'armingSword', level: 32, rarity: 'rare' });
    expect(model.smithing.start('copperPick')).toBe(true);
    run(model, SMITH_RECIPES.copperPick.seconds + 0.05);
    expect([model.hero.bag.copperPick, LOOT.copperPick.name]).toEqual([1, 'Copper pickaxe']);
  });

  it('teaches by its forging: an ingot or a fitting green while what is made of it teaches, never the ladder itself', () => {
    expect([smithRise('copperIngot', 1), smithRise('ironIngot', 90), smithRise('copperRivets', 10)]).toEqual([MATERIAL_RISE, MATERIAL_RISE, MATERIAL_RISE]);
    expect(smithRise('copperIngot', 200)).toBe(RISE[3]); // (nothing of copper teaches there: grey)
    expect(smithRise('dagger', 20)).toBe(RISE[0]);
  });

  it('has its page in the skill window: away from the anvil said so, its Forge button off', () => {
    const { model } = atTheAnvil(1, { ironScrap: 3 });
    const book = () => recipeBook(model, { ...newBook(), picked: 'scrapIron' }, () => {}, SMITHING);
    expect(book().querySelector<HTMLButtonElement>('.book-craft')!.disabled).toBe(false);
    model.hero.x += 3;
    const away = book();
    expect(away.querySelector<HTMLButtonElement>('.book-craft')!.disabled).toBe(true);
    expect(away.textContent).toContain('anvil');
  });

  it("tells, in the book, of a piece the hero isn't of the level to wear yet", () => {
    const { model } = atTheAnvil(60, { ironIngot: 2 });
    model.hero.level = 3;
    const book = recipeBook(model, { ...newBook(), picked: 'shortSword' }, () => {}, SMITHING);
    expect(book.textContent).toContain('Requires level 8');
  });
});

describe('what smithing would teach next', () => {
  it('names a recipe reached that still teaches, the likeliest to; of those as likely, one the bag would make first', () => {
    const { model } = atTheAnvil(1);
    expect(nextToLearn(model.hero)).toBe('copperIngot');
    model.hero.bag.ironScrap = 3;
    expect(nextToLearn(model.hero)).toBe('scrapIron'); // (as likely, and the bag would make it)
    skillOf(model.hero, 'smithing').level = 60;
    const id = nextToLearn(model.hero)!;
    expect(SMITH_RECIPES[id].needs).toBeLessThanOrEqual(60);
    expect(smithRise(id, 60).chance).toBe(Math.max(...SMITH_RECIPE_IDS.filter((r) => SMITH_RECIPES[r].needs <= 60).map((r) => smithRise(r, 60).chance)));
  });

  it('marks the gear the hero crafts as their own, for whoever asks (the bench, a buyer); a found piece, not', () => {
    const { model } = atTheAnvil(20, { copperIngot: 2 });
    expect(model.smithing.start('dagger')).toBe(true);
    run(model, SMITH_RECIPES.dagger.seconds + 0.05);
    const made = Object.keys(model.hero.bag).find((k) => k.startsWith('dagger@4'))!;
    expect([isCrafted(model.hero, made), isCrafted(model.hero, 'dagger@4c999')]).toEqual([true, false]);
  });
});

describe('the hero at work at the anvil and the bench', () => {
  it('has E go to the anvil or the bench stood before, not to the smith beside them; a step off, to him', () => {
    const { model, anvil } = atTheAnvil();
    const smith = model.folk.find((n) => n.role === 'smith' && n.where === model.inside!.entrance)!;
    Object.assign(smith, { x: model.hero.x + 1, z: model.hero.z }); // (at his round, or behind his counter, within a word)
    expect(interactionOf(model)?.kind).toBe('anvil');
    const bench = model.inside!.furniture.find((f) => f.kind === 'salvageBench')!;
    Object.assign(model.hero, { x: bench.x, z: bench.z + 1 });
    Object.assign(smith, { x: model.hero.x + 1, z: model.hero.z });
    expect(interactionOf(model)?.kind).toBe('bench');
    Object.assign(model.hero, { x: anvil.x + 3, z: anvil.z + 3 });
    Object.assign(smith, { x: model.hero.x + 1, z: model.hero.z });
    expect(interactionOf(model)?.kind).toBe('talk');
  });

  it('faces the anvil and swings a hammer at it, a blow at a time, while forging; none when not', () => {
    const { model, anvil } = atTheAnvil(1, { copperOre: 4 });
    model.hero.facing = 0; // (away from it: it's at -z)
    expect(model.attackProgress).toBeNull();
    expect(model.smithing.start('copperIngot', 4)).toBe(true);
    expect(model.hero.facing).toBeCloseTo(Math.atan2(anvil.x - model.hero.x, anvil.z - model.hero.z));
    run(model, 0.3);
    expect(model.smithing.swing).not.toBeNull();
    expect(model.attackProgress).toBe(model.smithing.swing);
    model.smithing.stop();
    expect([model.smithing.swing, model.attackProgress]).toEqual([null, null]);
  });

  it('does one thing at a time: the bench and the anvil, or a plank made from the bag, stop one another', () => {
    const { model } = atTheAnvil(1, { copperOre: 4, rustyBuckle: 4, birchLog: 2 });
    const bench = model.inside!.furniture.find((f) => f.kind === 'salvageBench')!;
    const salvage = model.salvage as unknown as { benchInReach: unknown };
    Object.defineProperty(salvage, 'benchInReach', { get: () => bench }); // (as though the two stood side by side)
    expect(model.salvage.start('rustyBuckle', Infinity)).toBe('started');
    expect(model.smithing.start('copperIngot', 4)).toBe(true);
    run(model, 0.2);
    expect([model.salvage.breaking, !!model.smithing.making]).toEqual([null, true]);
    expect(model.salvage.start('rustyBuckle', Infinity)).toBe('started');
    run(model, 0.2);
    expect([!!model.salvage.breaking, model.smithing.making]).toEqual([true, null]);
    expect(model.woodworking.start('birchPlank')).toBe(true); // (a plank, anywhere: the bench left)
    run(model, 0.2);
    expect([model.salvage.breaking, !!model.woodworking.making]).toEqual([null, true]);
  });
});

// @vitest-environment happy-dom
// Woodworking (model/skills/woodworking.ts): recipes known as the skill reaches them; one made takes its materials out
// of the bag and puts what it makes in (gear at the recipe's level and rarity), the skill up as its difficulty allows,
// some of the hero's own experience; as many as asked, or all the bag allows; stopped by walking off, by chopping, by
// a full bag (told); not begun at work. The recipe list in the skills window (controller/skills/recipeList.ts). And
// lumberjacking past its first tiers (model/skills/lumber.ts): ancient trees, a second log now and then, finds.
import { describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { RECIPES, RECIPE_IDS } from '../src/model/skills/woodworking';
import { ANCIENT, WOOD, chopsIn, gradeOf, woodOf } from '../src/model/skills/lumber';
import { RISE, difficulty, skillOf } from '../src/model/skills/skills';
import { gearOf } from '../src/model/human/items/gear';
import { bagRoom } from '../src/model/hero/bagSlots';
import type { Tree } from '../src/model/types';
import { TEST_MAP_SIZE } from './support/testWorld';

vi.mock('../src/view/ui/voxelIcon', () => ({ voxelIcon: () => document.createElement('canvas') }));
const { craftStatus, recipeList, recipeProgress } = await import('../src/controller/skills/recipeList');

// A model, its hero at `level` in woodworking with `bag` in their bag.
function workshop(level = 1, bag: Record<string, number> = {}) {
  const model = new GameModel(1, TEST_MAP_SIZE);
  skillOf(model.hero, 'woodworking').level = level;
  Object.assign(model.hero.bag, bag);
  return model;
}
const run = (model: GameModel, seconds: number, dirX = 0) => {
  for (let t = 0; t < seconds; t += 0.1) model.update(dirX, 0, 0.1);
};

describe('woodworking', () => {
  it('has its recipes in the order of the skill they want, from 1 to near the top, each making something', () => {
    const needs = RECIPE_IDS.map((id) => RECIPES[id].needs);
    expect(needs).toEqual([...needs].sort((a, b) => a - b));
    expect(needs[0]).toBe(1);
    expect(needs.at(-1)).toBeGreaterThan(250); // (something to learn from almost to 300)
    for (const id of RECIPE_IDS) expect(Object.keys(RECIPES[id].from).length).toBeGreaterThan(0);
  });

  it('knows a recipe once the skill reaches it; makes as many as the bag allows', () => {
    const model = workshop(1, { birchLog: 3, pineLog: 5 });
    expect(model.woodworking.knows('birchPlank')).toBe(true);
    expect(model.woodworking.knows('pinePlank')).toBe(false);
    expect(model.woodworking.canMake('birchPlank')).toBe(3);
    expect(model.woodworking.canMake('pinePlank')).toBe(0); // (not known: none, whatever's in the bag)
    expect(model.woodworking.start('pinePlank')).toBe(false);
  });

  it('makes one: its materials out of the bag, what it makes in, the skill up (orange), some experience; told', () => {
    const model = workshop(1, { birchLog: 2 });
    const xp = model.hero.xp;
    expect(model.woodworking.start('birchPlank')).toBe(true);
    run(model, RECIPES.birchPlank.seconds + 0.05);
    expect([model.hero.bag.birchLog, model.hero.bag.birchPlank]).toEqual([1, 1]);
    expect(skillOf(model.hero, 'woodworking').level).toBe(2);
    expect(model.hero.xp).toBeGreaterThan(xp);
    expect(model.woodworking.making).toBeNull(); // (one asked for: done)
    const events = model.takeEvents();
    expect(events).toContainEqual({ kind: 'crafted', item: 'birchPlank' });
    expect(events).toContainEqual({ kind: 'skillUp', skill: 'Woodworking', level: 2 });
  });

  it('makes gear at the recipe\'s level and rarity', () => {
    const model = workshop(270, { heartwood: 3, varnish: 2 });
    model.woodworking.start('heartwoodStaff');
    run(model, RECIPES.heartwoodStaff.seconds + 0.05);
    const made = Object.keys(model.hero.bag).find((k) => k.startsWith('quarterstaff'))!;
    expect(gearOf(made as never)).toMatchObject({ item: 'quarterstaff', level: 32, rarity: 'rare' });
    expect([model.hero.bag.heartwood, model.hero.bag.varnish]).toEqual([undefined, undefined]); // (all used)
  });

  it('makes all the bag allows, one after another, then stops', () => {
    const model = workshop(1, { birchLog: 3 });
    model.woodworking.start('birchPlank', Infinity);
    expect(model.woodworking.making?.left).toBe(3);
    run(model, RECIPES.birchPlank.seconds * 3 + 0.3);
    expect([model.hero.bag.birchLog, model.hero.bag.birchPlank, model.woodworking.making]).toEqual([undefined, 3, null]);
  });

  it('stops on walking off, on chopping, at work; with a full bag, told so, nothing taken', () => {
    const walked = workshop(1, { birchLog: 2 });
    walked.woodworking.start('birchPlank');
    run(walked, 0.2, 1);
    expect([walked.woodworking.making, walked.hero.bag.birchLog]).toEqual([null, 2]);
    const chopping = workshop(1, { birchLog: 2 });
    const tree = chopping.trees.find((t) => t.kind === 'birch')!;
    Object.assign(chopping.hero, { x: tree.x + 0.7, z: tree.z });
    chopping.hero.equipment.mainHand = 'hatchet';
    chopping.woodworking.start('birchPlank');
    expect(chopping.lumber.use()).toBe(true); // (E at a tree: chopping)
    run(chopping, 0.2);
    expect(chopping.woodworking.making).toBeNull();
    const full = workshop(10, { birchPlank: 2 });
    for (let i = 0; i <= bagRoom(full.hero); i++) full.hero.bag[`dagger@${i + 2}c0` as never] = 1 as never; // (every slot taken, a dagger each)
    full.woodworking.start('woodenSword');
    run(full, RECIPES.woodenSword.seconds + 0.05);
    expect([full.hero.bag.birchPlank, full.woodworking.making]).toEqual([2, null]);
    expect(full.takeEvents()).toContainEqual({ kind: 'poor', text: 'Your bag is full' });
  });

  it('rises as its recipes are hard for them: orange always, grey never', () => {
    expect(difficulty(RECIPES.birchPlank.needs, 1)).toBe(RISE[0]);
    expect(difficulty(RECIPES.birchPlank.needs, 80)).toBe(RISE[3]);
    const model = workshop(90, { birchLog: 5 });
    model.woodworking.start('birchPlank', Infinity);
    run(model, RECIPES.birchPlank.seconds * 5 + 0.5);
    expect(skillOf(model.hero, 'woodworking').level).toBe(90); // (grey: nothing more to learn from it)
  });
});

describe('the recipe list', () => {
  it('a row each: what it makes, its name in its difficulty\'s colour, its materials (have/need), buttons; those not reached faded', () => {
    const model = workshop(1, { birchLog: 2 });
    const list = recipeList(model, () => {});
    const rows = Array.from(list.querySelectorAll('li'));
    expect(rows).toHaveLength(RECIPE_IDS.length);
    const plank = rows.find((r) => r.dataset.recipe === 'birchPlank')!;
    expect((plank.querySelector('.recipe-name') as HTMLElement).style.color).toBeTruthy();
    expect(plank.querySelector('.recipe-from')?.textContent).toContain('2/1');
    expect(Array.from(plank.querySelectorAll('button')).map((b) => [b.textContent, b.disabled])).toEqual([['Craft', false], ['All (2)', false]]);
    const sword = rows.find((r) => r.dataset.recipe === 'woodenSword')!;
    expect([sword.className, sword.querySelector('.recipe-needs')?.textContent]).toEqual(['recipe locked', 'Needs 10']);
    (plank.querySelector('button') as HTMLButtonElement).click();
    expect(model.woodworking.making?.recipe).toBe('birchPlank');
  });
});

describe('the one being made', () => {
  it("is told of on its own: what, how many of how many, a bar filling toward the next, a button to stop; its recipe's row lit", () => {
    const model = workshop(1, { birchLog: 3 });
    expect(craftStatus(model, () => {})).toBeNull(); // (nothing being made: no card)
    model.woodworking.start('birchPlank', Infinity);
    run(model, RECIPES.birchPlank.seconds * 1.5); // (one made, the next half way)
    const card = craftStatus(model, () => {})!;
    expect(card.textContent).toContain('Birch plank');
    expect(card.textContent).toContain('Making 2 of 3');
    recipeProgress(model, card);
    expect(parseFloat((card.querySelector('.recipe-progress > i') as HTMLElement).style.width)).toBeCloseTo(50, -1);
    const row = recipeList(model, () => {}).querySelector<HTMLElement>('[data-recipe="birchPlank"]')!;
    expect([row.className, row.querySelector('.recipe-left')?.textContent, row.querySelector('.recipe-progress')]).toEqual(['recipe making', 'In progress', null]);
    (card.querySelector('button') as HTMLButtonElement).click();
    expect(model.woodworking.making).toBeNull();
  });
});

describe('lumberjacking past its first tiers', () => {
  const model = new GameModel(1, TEST_MAP_SIZE);
  // A pine or oak of the grade asked for.
  const of = (grade: string) => model.trees.find((t) => gradeOf(t, model.seed) === grade) as Tree;

  it('has ancient pines and oaks, about one in twelve, wanting a master, two logs a chop, still 2 to 5 chops', () => {
    const olds = model.trees.filter((t) => t.kind !== 'birch');
    const share = olds.filter((t) => gradeOf(t, model.seed).startsWith('ancient')).length / olds.length;
    expect(share).toBeGreaterThan(ANCIENT * 0.6);
    expect(share).toBeLessThan(ANCIENT * 1.4);
    expect(model.trees.some((t) => t.kind === 'birch' && gradeOf(t, model.seed) !== 'birch')).toBe(false);
    expect([WOOD.ancientPine.needs, WOOD.ancientOak.needs, WOOD.ancientPine.logs, WOOD.ancientOak.logs]).toEqual([125, 175, 2, 2]);
    for (const grade of ['ancientPine', 'ancientOak']) expect(chopsIn(of(grade), model.seed)).toBeLessThanOrEqual(5);
    expect(woodOf(of('ancientOak'), model.seed).name).toBe('ancient oak');
  });

  // A hero at `level` chopping a tree of `grade` to its fall: what fell on the ground.
  function felled(grade: string, level: number) {
    const m = new GameModel(1, TEST_MAP_SIZE);
    const tree = m.trees.find((t) => gradeOf(t, m.seed) === grade)!;
    Object.assign(m.hero, { x: tree.x + 0.7, z: tree.z });
    m.hero.equipment.mainHand = 'hatchet';
    skillOf(m.hero, 'lumberjacking').level = level;
    m.lumber.chopping = { tree, t: 0 }; // (at this one, whatever stands nearer)
    run(m, m.lumber.chopSeconds * chopsIn(tree, m.seed) + 0.5);
    return { chops: chopsIn(tree, m.seed), items: m.loot.map((l) => l.item) };
  }

  it('gives two logs a chop from an ancient tree; a second now and then only from 100; finds past their levels', () => {
    const ancient = felled('ancientOak', 175);
    expect(ancient.items.filter((i) => i === 'oakLog').length).toBeGreaterThanOrEqual(ancient.chops * 2);
    const plain = felled('birch', 60);
    expect(plain.items.filter((i) => i === 'birchLog')).toHaveLength(plain.chops); // (no second log under 100)
    expect(felled('pine', 120).items).not.toContain('pineResin'); // (none under 150)
    let found = 0;
    for (let level = 280; level <= 300 && found === 0; level++) found += felled('ancientOak', level).items.filter((i) => i === 'heartwood').length;
    expect(found).toBeGreaterThan(0);
  });
});

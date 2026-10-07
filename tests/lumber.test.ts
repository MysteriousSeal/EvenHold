// Lumberjacking (model/skills/lumber.ts): an axe in hand, E by a tree starts the hero chopping on their own, a log
// knocked loose onto the ground at every chop; each tree good for 2 to 5 chops (a birch fewest, an oak most), then
// felled for good (out of the way, kept so in the save, not there when its region's made again). The harder woods
// want the skill; it rises as they chop, the surer the harder the tree (orange always, grey never). Walking off stops
// them. The prompt over a tree says what E would do, or why not.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { REACH, WOOD, chopsIn, woodOf } from '../src/model/skills/lumber';
import { RISE, difficulty } from '../src/model/skills/skills';
import { MAIN_HAND_ITEMS } from '../src/model/human/items/held';
import { gearKey, weaponTypeOf } from '../src/model/human/items/gear';
import { SKILLS, skillOf } from '../src/model/skills/skills';
import { parseSave, restore, snapshot } from '../src/model/save';
import { chopPrompt } from '../src/controller/skills/chopPrompt';
import type { Tree, TreeKind } from '../src/model/types';
import { TEST_MAP_SIZE } from './support/testWorld';
import { STREAMED_SIZE } from '../src/model/worldgen/regions';

// A model, the hero stood by a tree of `kind` (an axe in hand, unless told not), and the tree.
function byATree(kind: TreeKind = 'birch', axe: string | null = 'hatchet') {
  const model = new GameModel(1, TEST_MAP_SIZE);
  const tree = model.trees.find((t) => t.kind === kind)!;
  Object.assign(model.hero, { x: tree.x + 0.7, z: tree.z });
  if (axe) model.hero.equipment.mainHand = axe as never;
  return { model, tree };
}

// The model on `seconds`, standing still, a tenth at a time.
const run = (model: GameModel, seconds: number) => {
  for (let t = 0; t < seconds; t += 0.1) model.update(0, 0, 0.1);
};

describe('weapons', () => {
  it('each have a type; the axes are what chop', () => {
    for (const [id, item] of Object.entries(MAIN_HAND_ITEMS)) expect(item.type, id).toMatch(/^(sword|dagger|axe|mace|hammer|club|spear|staff)$/);
    expect(Object.keys(MAIN_HAND_ITEMS).filter((id) => weaponTypeOf(id as never) === 'axe').sort()).toEqual(['battleAxe', 'hatchet']);
    expect(weaponTypeOf('plankShield')).toBeNull(); // (not a weapon)
  });
});

describe('trees', () => {
  it('give 2 to 5 chops each, by kind (a birch fewest, an oak most), each its own by where it stands', () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    const seen = new Set<number>();
    for (const tree of model.trees.slice(0, 400)) {
      const n = chopsIn(tree, model.seed);
      expect(n).toBeGreaterThanOrEqual(woodOf(tree, model.seed).chops[0]);
      expect(n).toBeLessThanOrEqual(woodOf(tree, model.seed).chops[1]);
      expect(chopsIn(tree, model.seed)).toBe(n);
      seen.add(n);
    }
    expect(Math.min(...seen)).toBe(2);
    expect(Math.max(...seen)).toBeGreaterThanOrEqual(4);
  });

  it('want an axe in hand, and the skill for the harder woods', () => {
    expect(byATree('birch', null).model.lumber.action).toMatchObject({ kind: 'cannot', why: 'axe' });
    expect(byATree('birch').model.lumber.action).toMatchObject({ kind: 'chop' });
    expect(byATree('oak').model.lumber.action).toMatchObject({ kind: 'cannot', why: 'skill', needs: WOOD.oak.needs });
    expect(byATree('birch', 'battleAxe').model.lumber.action?.kind).toBe('chop'); // (any axe does)
    expect(byATree('birch', gearKey({ item: 'hatchet', level: 7, rarity: 'rare', roll: 3 })).model.lumber.action?.kind).toBe('chop'); // (whatever its level and rarity)
    expect(byATree('birch', 'armingSword').model.lumber.action).toMatchObject({ kind: 'cannot', why: 'axe' }); // (a sword doesn't)
    const { model } = byATree('oak');
    skillOf(model.hero, 'lumberjacking').level = WOOD.oak.needs;
    expect(model.lumber.action?.kind).toBe('chop');
    expect(SKILLS.lumberjacking.kind).toBe('main');
  });

  it("in reach, one they can fell before a nearer one beyond them (a birch by a pine: the birch); none they can, the nearest, to say why", () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    const birch = model.trees.find((t) => t.kind === 'birch')!;
    const pine = { ...model.trees.find((t) => t.kind === 'pine')!, x: birch.x + 1, z: birch.z }; // (a pine right by it)
    model.trees.push(pine);
    model.hero.equipment.mainHand = 'hatchet';
    Object.assign(model.hero, { x: birch.x + 0.6, z: birch.z }); // (nearer the pine)
    expect(model.lumber.treeInReach).toBe(birch);
    model.lumber.cut.set(`${birch.x},${birch.z}`, 9); // (the birch felled)
    expect(model.lumber.treeInReach).toBe(pine);
    expect(model.lumber.action).toMatchObject({ kind: 'cannot', why: 'skill' });
  });

  it('are only in reach close by, outdoors', () => {
    const { model, tree } = byATree();
    Object.assign(model.hero, { x: tree.x + REACH + 0.5 });
    expect(model.lumber.treeInReach).not.toBe(tree);
  });
});

describe('chopping', () => {
  it('goes on on its own: a log on the ground at every chop, the skill up (orange: surely), some of the hero\'s own experience', () => {
    const { model, tree } = byATree();
    const xp = model.hero.xp;
    expect(model.lumber.use()).toBe(true);
    run(model, model.lumber.chopSeconds + 0.05);
    expect(model.lumber.cut.get(`${tree.x},${tree.z}`)).toBe(1);
    expect(model.loot.filter((l) => l.item === 'birchLog')).toHaveLength(1);
    const [log] = model.loot;
    expect(Math.hypot(log.x - tree.x, log.z - tree.z)).toBeLessThan(1); // (beside the trunk)
    expect(skillOf(model.hero, 'lumberjacking').level).toBe(2);
    expect(model.hero.xp).toBeGreaterThan(xp);
    expect(model.takeEvents()).toContainEqual({ kind: 'skillUp', skill: 'Lumberjacking', level: 2 });
    expect(model.lumber.chopping).not.toBeNull(); // (on to the next chop)
  });

  it('fells the tree at its last chop: gone for good, out of the way, a log for every chop', () => {
    const { model, tree } = byATree();
    const chops = chopsIn(tree, model.seed);
    expect(model.isBlocked(tree.x, tree.z, 0.1)).toBe(true);
    model.lumber.use();
    run(model, model.lumber.chopSeconds * chops + 0.5);
    expect(model.lumber.felled(tree)).toBe(true);
    expect(model.lumber.chopping).toBeNull();
    expect(model.loot.filter((l) => l.item === 'birchLog')).toHaveLength(chops);
    expect(model.isBlocked(tree.x, tree.z, 0.1)).toBe(false);
    expect(model.lumber.treeInReach).not.toBe(tree);
    expect(model.takeEvents()).toContainEqual({ kind: 'felled', x: tree.x, z: tree.z });
  });

  it('stops when they walk off, or press E again', () => {
    const { model, tree } = byATree();
    model.lumber.use();
    model.update(1, 0, 0.1);
    expect(model.lumber.chopping).toBeNull();
    Object.assign(model.hero, { x: tree.x + 0.7, z: tree.z }); // (back by it)
    expect(model.lumber.use()).toBe(true);
    expect(model.lumber.use()).toBe(true); // (E again: stopped)
    expect(model.lumber.chopping).toBeNull();
  });

  it('raises the skill the surer the harder the tree is for them: orange always, grey never', () => {
    expect(difficulty(WOOD.birch.needs, 1)).toBe(RISE[0]);
    expect(difficulty(WOOD.birch.needs, 30)).toBe(RISE[1]);
    expect(difficulty(WOOD.birch.needs, 60)).toBe(RISE[2]);
    expect(difficulty(WOOD.birch.needs, 200)).toBe(RISE[3]);
    expect(RISE.map((r) => r.chance)).toEqual([1, 0.6, 0.25, 0]);
  });

  it('swings the hero\'s axe while at it (their arms drawn so)', () => {
    const { model } = byATree();
    expect(model.attackProgress).toBeNull();
    model.lumber.use();
    run(model, 0.3);
    expect(model.attackProgress).toBeGreaterThan(0);
  });
});

describe('felled trees', () => {
  it('are kept so in the save: gone, out of the way, a part-cut one still part-cut', () => {
    const { model, tree } = byATree();
    model.lumber.use();
    run(model, model.lumber.chopSeconds * chopsIn(tree, model.seed) + 0.5);
    const other = model.trees.find((t) => t !== tree && t.kind === 'birch')!;
    model.lumber.cut.set(`${other.x},${other.z}`, 1);
    const again = new GameModel(1, TEST_MAP_SIZE);
    restore(again, parseSave(JSON.stringify(snapshot(model)), 1)!);
    expect(again.lumber.felled(again.trees.find((t) => t.x === tree.x && t.z === tree.z) as Tree)).toBe(true);
    expect(again.isBlocked(tree.x, tree.z, 0.1)).toBe(false);
    expect(again.lumber.left(other)).toBe(chopsIn(other, again.seed) - 1);
  });

  it("aren't there when their region's made again (a streamed world's, let go and come back to)", () => {
    const model = new GameModel(1, STREAMED_SIZE);
    const tree = model.trees.find((t) => t.kind === 'birch' && Math.hypot(t.x - model.hero.x, t.z - model.hero.z) < 60)!;
    model.lumber.cut.set(`${tree.x},${tree.z}`, 5);
    const home = { x: model.hero.x, z: model.hero.z };
    model.teleport(home.x + 900, home.z + 300); // (its region let go, over the frames after)
    for (let i = 0; i < 300 && model.trees.includes(tree); i++) model.update(0, 0, 0.1);
    expect(model.trees.includes(tree)).toBe(false);
    model.teleport(home.x, home.z); // (and made again)
    run(model, 3);
    expect(model.world.has(tree.x, tree.z)).toBe(true);
    expect(model.trees.some((t) => t.x === tree.x && t.z === tree.z)).toBe(false);
    expect(model.isBlocked(tree.x, tree.z, 0.1)).toBe(false);
  }, 120_000);

  it('a broken save\'s cuts made sound', () => {
    const { model } = byATree();
    model.lumber.restore({ '3,4': 2, 'nonsense': 4, '5,6': -1, '7,8': 'x', '9,10': 99 });
    expect(model.lumber.saved()).toEqual({ '3,4': 2, '9,10': 5 });
  });
});

describe('the prompt over a tree', () => {
  it('says what E would do (how many chops it has), or why not; chopping, how to stop', () => {
    const { model, tree } = byATree();
    expect(chopPrompt(model)).toMatchObject({ label: `Chop the birch · ${chopsIn(tree, model.seed)} chops`, x: tree.x, z: tree.z });
    model.lumber.use();
    expect(chopPrompt(model)?.label).toMatch(/^Stop chopping · \d chops left$/);
    expect(chopPrompt(byATree('birch', null).model)).toMatchObject({ label: 'Needs an axe in hand', muted: true });
    expect(chopPrompt(byATree('pine').model)).toMatchObject({ label: `Needs Lumberjacking ${WOOD.pine.needs}`, muted: true });
  });
});

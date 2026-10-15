// Lumberjacking (model/skills/lumber.ts): an axe to hand (in hand or in the pack), E by a tree starts the hero chopping on their own, a log
// knocked loose onto the ground at every chop; each tree good for 2 to 5 chops (a birch fewest, an oak most), then
// felled for good (out of the way, kept so in the save, not there when its region's made again). The harder woods
// want the skill; it rises as they chop, the surer the harder the tree (orange always, grey never). Walking off stops
// them. The prompt over a tree says what E would do, or why not.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { REACH, SEEK, WOOD, chopsIn, gradeOf, riseOf, woodOf } from '../src/model/skills/lumber';
import { bearing } from '../src/model/travellers/travellerTalk';
import { RISE, difficulty, stepsOf } from '../src/model/skills/skills';
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
  delete model.hero.bag.hatchet; // (a new hero's, in the pack: the test says what axe there is, if any)
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
    expect(Object.keys(MAIN_HAND_ITEMS).filter((id) => weaponTypeOf(id as never) === 'axe').sort()).toEqual(['battleAxe', 'broadAxe', 'fellingAxe', 'hatchet', 'headsmansAxe']);
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
    // An axe carried in the pack does as well, the best of them (the view shows it in hand for the chopping); one in hand first.
    const packed = byATree('birch', 'armingSword');
    packed.model.hero.bag.hatchet = 1;
    expect([packed.model.lumber.action?.kind, packed.model.lumber.axeKey]).toEqual(['chop', 'hatchet']);
    const better = gearKey({ item: 'battleAxe', level: 7, rarity: 'rare', roll: 3 });
    packed.model.hero.bag[better] = 1;
    expect(packed.model.lumber.axeKey).toBe(better);
    packed.model.hero.equipment.mainHand = 'hatchet' as never;
    expect(packed.model.lumber.axeKey).toBe('hatchet');
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
    skillOf(model.hero, 'lumberjacking').toward = stepsOf('lumberjacking', 1) - 1; // (a chop short of the next level)
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
    expect(RISE.map((r) => r.chance)).toEqual([1, 0.75, 0.4, 0]);
  });

  it('never has the oak go grey: green at the least, so there is always a tree to learn from, to the top', () => {
    expect(riseOf('oak', 100)).toBe(RISE[0]);
    for (const level of [170, 200, 299]) expect(riseOf('oak', level)).toBe(RISE[2]);
    expect(riseOf('pine', 125)).toBe(RISE[3]); // (the rest: grey as ever)
    expect(riseOf('ancientPine', 140)).toBe(RISE[0]);
    for (const level of [270, 299]) expect([riseOf('ancientPine', level), riseOf('ancientOak', level)]).toEqual([RISE[2], RISE[2]]);
    expect(riseOf('elderOak', 299)).toBe(RISE[2]); // (nor any tree harder than the oak: an ancient pine never teaching less than it)
    // Oaks chopped at by a hand at 170, one after another: the skill rises, in time.
    const { model } = byATree('oak');
    const skill = skillOf(model.hero, 'lumberjacking');
    Object.assign(skill, { level: 170, toward: stepsOf('lumberjacking', 170) - 1 }); // (a chop short of the next level)
    for (const oak of model.trees.filter((t) => woodOf(t, model.seed) === WOOD.oak).slice(0, 12)) {
      Object.assign(model.hero, { x: oak.x + 0.7, z: oak.z });
      if (model.lumber.use()) run(model, 30);
    }
    expect(skill.level).toBeGreaterThan(170);
  });

  it('tells, in its unlocks, the level each tree wants', () => {
    const at = SKILLS.lumberjacking.unlocks.map((u) => u.at);
    for (const wood of Object.values(WOOD)) expect(at).toContain(wood.needs);
  });

  it('has, to 290, a tree orange or yellow to learn from, never more than ten levels without (and past it, the elder oak, green)', () => {
    let without = 0;
    for (let level = 1; level < 290; level++) {
      const teaches = Object.keys(WOOD).some((g) => WOOD[g as keyof typeof WOOD].needs <= level && riseOf(g as keyof typeof WOOD, level).chance >= 0.6);
      without = teaches ? 0 : without + 1;
      expect(without, `at ${level}`).toBeLessThanOrEqual(10);
    }
  });

  it("never gives a grown-old tree more chops than its kind's (a tree felled stays felled, however it's graded)", () => {
    const kindOf = { birch: 'birch', pine: 'pine', oak: 'oak', ancientPine: 'pine', ancientOak: 'oak', elderOak: 'oak' } as const;
    for (const [grade, wood] of Object.entries(WOOD)) {
      const kind = WOOD[kindOf[grade as keyof typeof kindOf]];
      expect(wood.chops[1]).toBeLessThanOrEqual(kind.chops[1]);
      expect(wood.chops[0]).toBeLessThanOrEqual(kind.chops[0]);
    }
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
    expect(chopPrompt(byATree('birch', null).model)).toMatchObject({ label: 'Needs an axe', muted: true });
    skillOf(model.hero, 'lumberjacking').level = 120; // (a birch: grey for them)
    model.lumber.stop();
    expect(chopPrompt(model)?.label).toMatch(/^Chop the birch · \d chops? · teaches you nothing now(; an? [a-z ]+ does, \d+ paces? [a-z-]+)?$/);
    const pine = byATree('pine').model;
    expect(chopPrompt(pine)).toBeNull(); // (a new hero, never risen in the trade: no refusal for a first prompt)
    skillOf(pine.hero, 'lumberjacking').level = 2;
    expect(chopPrompt(pine)).toMatchObject({ label: `Needs Lumberjacking ${WOOD.pine.needs}`, muted: true });
  });

  it("points a grey tree's chopper to the nearest one a walk away that still teaches them: what, how far, which way", () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    const d = (t: Tree) => Math.hypot(t.x - model.hero.x, t.z - model.hero.z);
    const teaches = (t: Tree) => woodOf(t, model.seed).needs <= 120 && riseOf(gradeOf(t, model.seed), 120).chance > 0; // (at 120: birches and pines grey, the oaks not)
    const tree = model.trees.find((t) => t.kind === 'birch' && !model.trees.some((o) => teaches(o) && Math.hypot(o.x - t.x, o.z - t.z) < 4))!; // (a birch with no oak close by)
    Object.assign(model.hero, { x: tree.x + 0.7, z: tree.z });
    model.hero.equipment.mainHand = 'hatchet' as never;
    skillOf(model.hero, 'lumberjacking').level = 120;
    const nearest = model.trees.filter((t) => teaches(t) && d(t) < SEEK).sort((a, b) => d(a) - d(b))[0];
    expect(nearest).toBeTruthy(); // (a test world's woods have oaks among the birches)
    expect(model.lumber.teachingNear).toBe(nearest);
    expect(chopPrompt(model)?.label).toBe(`Chop the birch · ${model.lumber.left(tree)} chops · teaches you nothing now; an ${woodOf(nearest, model.seed).name} does, ${Math.round(d(nearest))} paces ${bearing(model.hero, nearest)}`);
    skillOf(model.hero, 'lumberjacking').level = 50; // (the birch teaches again: no pointing)
    expect(chopPrompt(model)?.label).toBe(`Chop the birch · ${model.lumber.left(tree)} chops`);
  });

  it('offers a tree in reach that still teaches before a nearer one that teaches nothing', () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    const [birch, oak] = [model.trees.find((t) => t.kind === 'birch')!, model.trees.find((t) => woodOf(t, model.seed).name === 'oak')!];
    Object.assign(birch, { x: oak.x + 1.4, z: oak.z }); // (side by side: the hero nearer the birch, both in reach)
    Object.assign(model.hero, { x: oak.x + 0.9, z: oak.z });
    skillOf(model.hero, 'lumberjacking').level = 120;
    expect(model.lumber.treeInReach).toBe(oak);
    skillOf(model.hero, 'lumberjacking').level = 50; // (both teach, the oak beyond them: the birch)
    expect(model.lumber.treeInReach).toBe(birch);
  });
});

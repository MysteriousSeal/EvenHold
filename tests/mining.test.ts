// Mining (model/skills/mining.ts): every boulder and outcrop of the wilds seamed with a vein of its own, by where it lies
// (star-iron only on the high ground); E by one with a pickaxe in the bag strikes at it on its own, a lump of ore on the
// ground at each strike, till its vein's worked out (the rock left standing). The veins want the skill, which rises as
// they strike, the surer the harder the vein; walking off stops them. Kept in the save; the prompt says what E would do.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { PICK_BONUS, REGROW, STAR_IRON, VEINS, isRock, middleOf, riseOf, strikesIn, upland, veinOf, type Rock } from '../src/model/skills/mining';
import { RISE, SKILLS, skillOf, stepsOf } from '../src/model/skills/skills';
import { LOOT_IDS } from '../src/model/loot/loot';
import { parseSave, restore, snapshot } from '../src/model/save';
import { minePrompt } from '../src/controller/skills/minePrompt';
import { castOf } from '../src/controller/skills/castOf';
import { statusOf } from '../src/controller/skills/skillsPanel';
import { interactionOf } from '../src/model/hero/interaction';
import { buyGear, pickPrice, sellGear, smithShopAt } from '../src/model/smithy/smithShop';
import { TOOL_ITEMS } from '../src/model/loot/tools';
import { TEST_MAP_SIZE } from './support/testWorld';

// A model, the hero stood by a rock (a pickaxe in the bag, unless told not), skilled enough for its vein; and the rock.
function byARock(pick: string | null = 'copperPick', seed = 2) {
  const model = new GameModel(seed, TEST_MAP_SIZE);
  const rock = model.scenery.find((s): s is Rock => isRock(s) && s.kind === 'boulder')!;
  const m = middleOf(rock);
  Object.assign(model.hero, { x: m.x + 0.95, z: m.z });
  if (pick) model.hero.bag[pick as 'copperPick'] = 1;
  skillOf(model.hero, 'mining').level = VEINS[model.mining.veinOf(rock)].needs;
  return { model, rock };
}

// The model on `seconds`, standing still, a tenth at a time.
const run = (model: GameModel, seconds: number) => {
  for (let t = 0; t < seconds; t += 0.1) model.update(0, 0, 0.1);
};

describe('the veins', () => {
  const worlds = [1, 2, 3].map((seed) => new GameModel(seed, TEST_MAP_SIZE));
  const rocks = worlds.flatMap((model) => model.scenery.filter(isRock).map((rock) => ({ model, rock })));

  it('seam every boulder and outcrop, by where it lies; star-iron only on the high ground', () => {
    expect(rocks.length).toBeGreaterThan(10);
    for (const { model, rock } of rocks) {
      const vein = veinOf(rock, model.seed, model.tiles);
      expect(vein).toBe(model.mining.veinOf(rock));
      if (vein === 'starIron') expect(upland(model.tiles, rock)).toBe(true);
    }
    expect(STAR_IRON).toBeLessThan(1); // (the high ground's rocks not all star-iron)
    expect(worlds[0].scenery.filter((s) => !isRock(s)).every((s) => s.kind !== 'boulder' && s.kind !== 'outcrop')).toBe(true);
  });

  it('give a boulder 12 to 18 strikes, an outcrop 24 to 36', () => {
    for (const { model, rock } of rocks) {
      const n = strikesIn(rock, model.seed);
      expect(n).toBeGreaterThanOrEqual(rock.kind === 'boulder' ? 12 : 24);
      expect(n).toBeLessThanOrEqual(rock.kind === 'boulder' ? 18 : 36);
    }
  });

  it('are all of them real loot, ore and finds', () => {
    for (const ore of Object.values(VEINS)) {
      expect(LOOT_IDS).toContain(ore.ore);
      for (const find of ore.finds ?? []) expect(LOOT_IDS).toContain(find.item);
    }
    for (const pick of ['copperPick', 'ironPick', 'steelPick', 'starIronPick']) expect(LOOT_IDS).toContain(pick);
  });

  it('teach the surer the harder they are: orange or yellow at every level to 290, iron and harder never grey', () => {
    for (let level = 1; level < 290; level++) expect((Object.keys(VEINS) as Array<keyof typeof VEINS>).some((v) => VEINS[v].needs <= level && riseOf(v, level).chance >= 0.6)).toBe(true);
    expect(riseOf('copper', 1)).toBe(RISE[0]);
    expect(riseOf('copper', 200)).toBe(RISE[3]); // (grey as ever)
    for (const vein of ['iron', 'silver', 'gold', 'starIron'] as const) expect(riseOf(vein, 299)).toBe(RISE[2]);
  });

  it('are told, each at its level, in the skill\'s unlocks', () => {
    const at = SKILLS.mining.unlocks.map((u) => u.at);
    for (const ore of Object.values(VEINS)) expect(at).toContain(ore.needs);
    expect(SKILLS.mining.kind).toBe('main');
  });
});

describe('mining', () => {
  it('wants a pickaxe in the bag, and the skill for the richer veins', () => {
    expect(byARock(null).model.mining.action).toMatchObject({ kind: 'cannot', why: 'pick' });
    const { model, rock } = byARock();
    expect(model.mining.action).toMatchObject({ kind: 'mine', rock });
    const needs = VEINS[model.mining.veinOf(rock)].needs;
    if (needs > 1) {
      skillOf(model.hero, 'mining').level = needs - 1;
      expect(model.mining.action).toMatchObject({ kind: 'cannot', why: 'skill', needs });
    }
  });

  it('is only in reach close by, outdoors', () => {
    const { model, rock } = byARock();
    const m = middleOf(rock);
    Object.assign(model.hero, { x: m.x + 3, z: m.z });
    expect(model.mining.rockInReach).toBeNull();
  });

  it('goes on on its own: ore on the ground at every strike, the skill toward its next level, some of the hero\'s own experience', () => {
    const { model, rock } = byARock();
    const ore = VEINS[model.mining.veinOf(rock)].ore;
    const skill = skillOf(model.hero, 'mining');
    const level = skill.level;
    skill.toward = stepsOf('mining', level) - 1; // (a strike short of the next level)
    const xp = model.hero.xp;
    expect(interactionOf(model)?.kind).toBe('mine');
    expect(model.mining.use()).toBe(true);
    run(model, model.mining.strikeSeconds + 0.05);
    expect(model.mining.mined.get(`${rock.x},${rock.z}`)).toBe(1);
    expect(model.loot.filter((l) => l.item === ore).length).toBeGreaterThanOrEqual(1);
    const m = middleOf(rock);
    for (const lump of model.loot) expect(Math.hypot(lump.x - m.x, lump.z - m.z)).toBeLessThan(1.2); // (beside the rock)
    expect(skill.level).toBe(level + 1);
    expect(model.hero.xp).toBeGreaterThan(xp);
    expect(model.takeEvents()).toContainEqual({ kind: 'skillUp', skill: 'Mining', level: level + 1 });
    expect(model.mining.striking).not.toBeNull();
    expect(interactionOf(model)?.kind).toBe('stopMine');
    expect(model.attackProgress).not.toBeNull(); // (the pick swung)
    expect(castOf(model)?.label).toMatch(/^\d+ strikes? left$/);
    expect(statusOf(model, 'mining')).toMatch(/^Mining [a-z-]+ · \d+ strikes? left$/);
  });

  it('works the vein out at its last strike: the rock left standing, in the way still, no more to mine', () => {
    const { model, rock } = byARock();
    const strikes = strikesIn(rock, model.seed);
    model.mining.use();
    run(model, (model.mining.strikeSeconds + 0.1) * strikes + 0.5); // (a tick over, each strike)
    expect(model.mining.workedOut(rock)).toBe(true);
    expect(model.mining.striking).toBeNull();
    expect(model.scenery).toContain(rock);
    expect(model.isBlocked(rock.x, rock.z, 0.1)).toBe(true);
    expect(model.mining.rockInReach).not.toBe(rock);
  });

  it('stops when they walk off, press E again, or take up another trade', () => {
    const { model, rock } = byARock();
    model.mining.use();
    model.update(1, 0, 0.1);
    expect(model.mining.striking).toBeNull();
    const m = middleOf(rock);
    Object.assign(model.hero, { x: m.x + 0.95, z: m.z });
    expect(model.mining.use()).toBe(true);
    expect(model.mining.use()).toBe(true); // (E again: stopped)
    expect(model.mining.striking).toBeNull();
    model.mining.use();
    model.woodworking.making = { recipe: 'birchPlank', left: 1, of: 1, t: 0 } as never;
    run(model, 0.2);
    expect(model.mining.striking).toBeNull();
  });

  it('strikes quicker each tier on, and with a better pick', () => {
    const { model } = byARock();
    skillOf(model.hero, 'mining').level = 1;
    const first = model.mining.strikeSeconds;
    skillOf(model.hero, 'mining').level = 160;
    expect(model.mining.strikeSeconds).toBeLessThan(first);
    const plain = model.mining.strikeSeconds;
    model.hero.bag.ironPick = 1;
    expect(model.mining.pickKey).toBe('ironPick');
    expect(PICK_BONUS.ironPick?.swings).toBe(-1);
    expect(model.mining.strikeSeconds).toBeLessThan(plain);
    const iron = model.mining.strikeSeconds;
    model.hero.bag.starIronPick = 1;
    expect(model.mining.pickKey).toBe('starIronPick');
    expect(model.mining.strikeSeconds).toBeLessThan(iron);
    expect(model.mining.secondOreChance(99)).toBe(PICK_BONUS.starIronPick?.secondOre); // (the star-iron pick's own, from the start)
    expect(model.mining.secondOreChance(300)).toBeGreaterThan(0.4);
  });
});

describe('mined rocks', () => {
  it('are kept so in the save: a worked-out one worked out, a part-mined one still part-mined', () => {
    const { model, rock } = byARock();
    model.mining.use();
    run(model, (model.mining.strikeSeconds + 0.1) * strikesIn(rock, model.seed) + 0.5);
    const other = model.scenery.find((s): s is Rock => isRock(s) && s !== rock)!;
    model.mining.mined.set(`${other.x},${other.z}`, 1);
    const again = new GameModel(2, TEST_MAP_SIZE);
    restore(again, parseSave(JSON.stringify(snapshot(model)), 2)!);
    expect(again.mining.workedOut(again.scenery.find((s): s is Rock => isRock(s) && s.x === rock.x && s.z === rock.z)!)).toBe(true);
    expect(again.mining.left(other)).toBe(strikesIn(other, again.seed) - 1);
  });

  it("an older save's (none) none mined, and a broken save's made sound", () => {
    const { model } = byARock();
    model.mining.restore(undefined);
    expect(model.mining.saved()).toEqual({});
    model.mining.restore({ '3,4': 2, nonsense: 4, '5,6': -1, '7,8': 'x', '9,10': 99, '1.5,2': 1 });
    expect(model.mining.saved()).toEqual({ '3,4': 2, '9,10': 36 });
    expect(model.mining.savedTimes()).toEqual({ '3,4': model.minutes, '9,10': model.minutes }); // (none saved: from now)
    model.mining.restore({ '3,4': 2, '5,6': 1 }, { '3,4': model.minutes - 100, '5,6': 'soon' });
    expect(model.mining.savedTimes()).toEqual({ '3,4': model.minutes - 100, '5,6': model.minutes });
  });

  it('come back whole a day after they were last struck at, the vein drawn again', () => {
    const { model, rock } = byARock();
    model.mining.use();
    run(model, (model.mining.strikeSeconds + 0.1) * strikesIn(rock, model.seed) + 0.5);
    expect(model.mining.workedOut(rock)).toBe(true);
    const version = model.mining.version;
    model.minutes += REGROW - 30; // (the run's last few seconds a few minutes on the clock already)
    run(model, 0.1);
    expect(model.mining.workedOut(rock)).toBe(true);
    model.minutes += 30;
    run(model, 0.1);
    expect(model.mining.workedOut(rock)).toBe(false);
    expect(model.mining.left(rock)).toBe(strikesIn(rock, model.seed));
    expect(model.mining.version).toBeGreaterThan(version);
    expect(model.mining.saved()).toEqual({});
  });

  it("an older save's worked-out rocks (counts alone) come back a day after it's loaded", () => {
    const { model, rock } = byARock();
    const data = JSON.parse(JSON.stringify(snapshot(model)));
    data.rocks = { [`${rock.x},${rock.z}`]: strikesIn(rock, model.seed) };
    delete data.rocksStruck;
    const again = new GameModel(2, TEST_MAP_SIZE);
    restore(again, parseSave(JSON.stringify(data), 2)!);
    const there = again.scenery.find((s): s is Rock => isRock(s) && s.x === rock.x && s.z === rock.z)!;
    expect(again.mining.workedOut(there)).toBe(true);
    again.minutes += REGROW;
    run(again, 0.1);
    expect(again.mining.workedOut(there)).toBe(false);
  });
});

describe("the smith's pickaxe", () => {
  it('is on every smith\'s shelf, at its worth; any pickaxe bought back at half', () => {
    const shop = smithShopAt(new Map(), 2, 0);
    expect(shop.stock.copperPick).toBe(1);
    expect(pickPrice('copperPick', false)).toBe(TOOL_ITEMS.copperPick.value);
    expect(pickPrice('starIronPick', true)).toBe(Math.floor(TOOL_ITEMS.starIronPick.value / 2));
    const { model } = byARock(null);
    model.hero.money = 1000;
    expect(buyGear(shop, model.hero, 'copperPick')).toBe('bought');
    expect(model.hero.bag.copperPick).toBe(1);
    expect(model.mining.pick).toBe(true);
    expect(sellGear(shop, model.hero, 'copperPick')).toBe('sold');
  });
});

describe('the prompt over a rock', () => {
  it('says what E would do (how many strikes it has), or why not; striking, how to stop', () => {
    const { model, rock } = byARock();
    const name = VEINS[model.mining.veinOf(rock)].name;
    expect(minePrompt(model)).toMatchObject({ label: `Mine the ${name} · ${strikesIn(rock, model.seed)} strikes`, ...middleOf(rock) });
    model.mining.use();
    expect(minePrompt(model)?.label).toMatch(/^Stop mining · \d+ strikes? left$/);
    expect(minePrompt(byARock(null).model)).toMatchObject({ label: 'Needs a pickaxe', muted: true });
    // A copper or tin vein, to a master: grey (iron and richer never are).
    const worlds = [1, 2, 3].map((seed) => new GameModel(seed, TEST_MAP_SIZE));
    const at = worlds.flatMap((m) => m.scenery.filter(isRock).map((r) => ({ m, r }))).find(({ m, r }) => ['copper', 'tin'].includes(m.mining.veinOf(r)))!;
    const middle = middleOf(at.r);
    Object.assign(at.m.hero, { x: middle.x + (at.r.kind === 'outcrop' ? 1.3 : 0.95), z: middle.z });
    at.m.hero.bag.copperPick = 1;
    skillOf(at.m.hero, 'mining').level = 299;
    const near = at.m.mining.teachingNear; // (an iron vein or richer, a walk away: pointed to)
    expect(minePrompt(at.m)?.label).toMatch(near ? new RegExp(` · teaches you nothing now; an? [a-z-]+ vein does, \\d+ paces [a-z-]+$`) : / · teaches you nothing now$/);
    if (near) expect(VEINS[at.m.mining.veinOf(near)].needs).toBeGreaterThanOrEqual(VEINS.iron.needs);
    skillOf(at.m.hero, 'mining').level = 10;
    expect(minePrompt(at.m)?.label).not.toMatch(/teaches you nothing/);
  });
});

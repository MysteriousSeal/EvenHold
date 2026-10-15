// Mining (model/skills/mining.ts): every boulder and outcrop of the wilds seamed with a vein of its own, by where it lies
// (star-iron only on the high ground); E by one with a pickaxe in the bag strikes at it on its own, a lump of ore on the
// ground at each strike, till its vein's worked out (the rock left standing). The veins want the skill, which rises as
// they strike, the surer the harder the vein; walking off stops them. Kept in the save; the prompt says what E would do.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { PICK_BONUS, STAR_IRON, VEINS, isRock, middleOf, riseOf, strikesIn, upland, veinOf, type Rock } from '../src/model/skills/mining';
import { RISE, SKILLS, skillOf, stepsOf } from '../src/model/skills/skills';
import { LOOT_IDS } from '../src/model/loot/loot';
import { parseSave, restore, snapshot } from '../src/model/save';
import { minePrompt } from '../src/controller/skills/minePrompt';
import { castOf } from '../src/controller/skills/castOf';
import { statusOf } from '../src/controller/skills/skillsPanel';
import { interactionOf } from '../src/model/hero/interaction';
import { TEST_MAP_SIZE } from './support/testWorld';

// A model, the hero stood by a rock (a pickaxe in the bag, unless told not), skilled enough for its vein; and the rock.
function byARock(pick: string | null = 'pickaxe', seed = 2) {
  const model = new GameModel(seed, TEST_MAP_SIZE);
  const rock = model.scenery.find((s): s is Rock => isRock(s) && s.kind === 'boulder')!;
  const m = middleOf(rock);
  Object.assign(model.hero, { x: m.x + 0.95, z: m.z });
  if (pick) model.hero.bag[pick as 'pickaxe'] = 1;
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

  it('give a boulder 4 to 6 strikes, an outcrop 8 to 12', () => {
    for (const { model, rock } of rocks) {
      const n = strikesIn(rock, model.seed);
      expect(n).toBeGreaterThanOrEqual(rock.kind === 'boulder' ? 4 : 8);
      expect(n).toBeLessThanOrEqual(rock.kind === 'boulder' ? 6 : 12);
    }
  });

  it('are all of them real loot, ore and finds', () => {
    for (const ore of Object.values(VEINS)) {
      expect(LOOT_IDS).toContain(ore.ore);
      for (const find of ore.finds ?? []) expect(LOOT_IDS).toContain(find.item);
    }
    for (const pick of ['pickaxe', 'ironPickaxe', 'starIronPickaxe']) expect(LOOT_IDS).toContain(pick);
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
    expect(castOf(model)?.label).toMatch(/^\d strikes? left$/);
    expect(statusOf(model, 'mining')).toMatch(/^Mining [a-z-]+ · \d+ strikes? left$/);
  });

  it('works the vein out at its last strike: the rock left standing, in the way still, no more to mine', () => {
    const { model, rock } = byARock();
    const strikes = strikesIn(rock, model.seed);
    model.mining.use();
    run(model, model.mining.strikeSeconds * strikes + 0.5);
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
    model.hero.bag.ironPickaxe = 1;
    expect(model.mining.pickKey).toBe('ironPickaxe');
    expect(PICK_BONUS.ironPickaxe?.swings).toBe(-1);
    expect(model.mining.strikeSeconds).toBeLessThan(plain);
    expect(model.mining.secondOreChance(99)).toBe(0);
    expect(model.mining.secondOreChance(300)).toBeGreaterThan(0.4);
  });
});

describe('mined rocks', () => {
  it('are kept so in the save: a worked-out one worked out, a part-mined one still part-mined', () => {
    const { model, rock } = byARock();
    model.mining.use();
    run(model, model.mining.strikeSeconds * strikesIn(rock, model.seed) + 0.5);
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
    expect(model.mining.saved()).toEqual({ '3,4': 2, '9,10': 12 });
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
  });
});

// Old saves load (model/save.ts): saves as 0.7.0 and 0.6.0 wrote them (tests/fixtures/saves: made by those versions'
// own snapshot, at a18a2d3c and 933aa71f, seed 1 at the test worlds' size, a hero well under way: gear worn and worn down, a bag with a fitted sack, skills, a job's record,
// stat points spent and not, charms known, an action bar, a quest taken, a tree cut, indoors at an inn) read into
// this version with nothing of theirs lost: every field the old save had, back as it was; what's new since (the
// crafted mark, the strongbox, the fallen purse) as an older save's should be (gear found, nothing kept, none
// dropped). And the game plays on from it, and saves and loads again the same.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { parseSave, restore, snapshot, type SaveData } from '../src/model/save';
import { doorNumber } from '../src/model/interiors/interiors';
import { isCrafted } from '../src/model/skills/salvage';
import { skillOf } from '../src/model/skills/skills';
import { TEST_MAP_SIZE } from './support/testWorld';

const VERSIONS = ['0.7.0', '0.6.0'];
const fixture = (version: string) => readFileSync(new URL(`./fixtures/saves/save-${version}.json`, import.meta.url), 'utf8');

describe.each(VERSIONS)('a save from %s', (version) => {
  const raw = fixture(version);
  const old = JSON.parse(raw) as SaveData;
  const load = () => {
    const data = parseSave(raw, old.seed);
    expect(data, 'refused').not.toBeNull();
    const model = new GameModel(old.seed, old.size ?? TEST_MAP_SIZE);
    restore(model, data!);
    return model;
  };

  it('loads with nothing of the hero lost', () => {
    const was = old.hero;
    const model = load();
    const h = model.hero;
    expect([h.name, h.money, h.level, h.xp, h.statPoints, h.facing]).toEqual([was.name, was.money, was.level, was.xp, was.statPoints, was.facing]);
    expect(h.look).toEqual(was.look);
    expect(h.equipment).toEqual(was.equipment);
    expect(h.bag).toEqual(was.bag);
    expect(h.bagOrder).toEqual(was.bagOrder);
    expect(h.bagCounts).toEqual(was.bagCounts);
    expect(h.bags).toEqual(was.bags);
    expect(h.trained).toMatchObject(was.trained!);
    expect(h.skills).toEqual(was.skills);
    expect(h.jobs).toEqual(was.jobs);
    expect(h.wear).toEqual(was.wear);
    expect(h.spells).toEqual(was.spells);
    expect(h.actionBar).toEqual(was.actionBar);
    expect(h.blessings).toEqual(was.blessings);
    expect([h.hp, Math.round(h.energy)]).toEqual([was.hp, was.energy]);
  });

  it('loads with nothing of the world lost: where they are, their inn, the day, their quest, the tree they cut', () => {
    const model = load();
    expect(model.inside && doorNumber(model.inside.entrance)).toBe(old.hero.inside);
    expect(model.lastInn && doorNumber(model.lastInn)).toBe(old.hero.lastInn);
    expect([model.hero.x, model.hero.z]).toEqual([old.hero.x, old.hero.z]);
    expect(model.minutes).toBe(old.minutes);
    const quests = model.quests.save();
    expect(quests.completed).toEqual(old.quests!.completed);
    expect(quests.taken.map(({ key, kills, tracked }) => ({ key, kills, tracked }))).toEqual(old.quests!.taken.map(({ key, kills, tracked }) => ({ key, kills, tracked })));
    for (const [i, t] of quests.taken.entries()) expect(t.gathered).toBeGreaterThanOrEqual(old.quests!.taken[i].gathered ?? 0); // (its foes gathered anew on loading: the next ones)
    expect(model.lumber.saved()).toEqual(old.trees);
  });

  it('takes what is new since as an older save should be: its gear found, nothing in the strongbox, no purse dropped, no herbs picked, alchemy at 1', () => {
    const model = load();
    expect(old.hero.crafted).toBeUndefined(); // (0.7.0 had no crafted mark)
    expect(isCrafted(model.hero, 'leatherCap')).toBe(false);
    expect(model.hero.stash).toEqual({});
    expect(model.purse).toBeNull();
    expect(model.herbs.saved()).toEqual({ picked: {}, at: {} }); // (0.9's alchemy: skills/herbalism.ts)
    expect(skillOf(model.hero, 'alchemy')).toEqual({ level: 1 });
  });

  it('plays on, and saves and loads again the same', () => {
    const model = load();
    for (let i = 0; i < 120; i++) model.update(i % 2 ? 0.4 : -0.4, 0.2, 1 / 30);
    const saved = snapshot(model);
    const again = new GameModel(old.seed, old.size ?? TEST_MAP_SIZE);
    restore(again, parseSave(JSON.stringify(saved), old.seed)!);
    expect(snapshot(again).hero).toEqual(JSON.parse(JSON.stringify(saved.hero)));
  });
});

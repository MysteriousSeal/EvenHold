// QA: a save, broken (model/save.ts). A real save of a game well under way (gear, money, a quest, skills, jobs, trees
// cut) broken hundreds of ways, as a damaged file or an older game's could be: a field set to the wrong kind of thing
// (nothing, a negative or huge number, text, a list, an object), or taken away. Every one either refused, or read back
// without the game falling over, the hero left sound: somewhere on the map, a whole purse, health within their most,
// a level, what they carry in whole numbers, each skill within its range. Rolled from a seed: any failure plays again.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { parseSave, restore, snapshot } from '../src/model/save';
import { maxHpOf } from '../src/model/hero/attributes';
import { SKILL_IDS, SKILL_MAX } from '../src/model/skills/skills';
import { mulberry32 } from '../src/util/random';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const SEED = TEST_SEEDS[0];
const TRIES = Number(process.env.QA_TRIES ?? 300);
const JUNK: unknown[] = [null, -1, 0, 1e12, -1e12, 'x', '', [], [1, 'a'], {}, { a: 1 }, true, 0.5];

// A game well under way: gear, money, a skill or two, a job's record, a tree part-cut, a quest taken.
function played(): GameModel {
  const model = new GameModel(SEED, TEST_MAP_SIZE);
  Object.assign(model.hero, { money: 345, level: 4, xp: 120 });
  model.hero.equipment.head = 'leatherCap';
  model.hero.bag.wolfFang = 3;
  model.hero.skills = { lumberjacking: { level: 40 }, woodworking: { level: 12 } };
  model.hero.jobs = { innServer: { xp: 9, shifts: 1, served: 9, best: 9, earned: 60 } };
  model.lumber.cut.set(`${model.trees[0].x},${model.trees[0].z}`, 1);
  const offer = model.quests.offersAt(0)[0];
  if (offer) model.quests.accept(offer);
  for (let i = 0; i < 30; i++) model.update(0.3, 0.2, 1 / 30);
  return model;
}

// Every path to a field in a saved game (objects and lists, a few deep).
function paths(value: unknown, at: Array<string | number> = [], out: Array<Array<string | number>> = [], depth = 0): Array<Array<string | number>> {
  if (depth > 4 || value === null || typeof value !== 'object') return out;
  for (const [key, inner] of Object.entries(value).slice(0, 40)) {
    const path = [...at, Array.isArray(value) ? Number(key) : key];
    out.push(path);
    paths(inner, path, out, depth + 1);
  }
  return out;
}

// The hero as the game needs them, whatever the save said.
function sound(model: GameModel): string | null {
  const h = model.hero;
  const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  if (![h.x, h.z, h.y, h.facing].every(finite)) return `position: ${h.x}, ${h.z}, ${h.y}, facing ${h.facing}`;
  if (!Number.isInteger(h.money) || h.money < 0) return `money: ${h.money}`;
  if (!Number.isInteger(h.level) || h.level < 1) return `level: ${h.level}`;
  if (!finite(h.hp) || h.hp < 1 || h.hp > maxHpOf(h)) return `health: ${h.hp} of ${maxHpOf(h)}`;
  if (!finite(h.energy) || h.energy < 0) return `energy: ${h.energy}`;
  if (!finite(h.xp) || h.xp < 0) return `experience: ${h.xp}`;
  for (const [item, n] of Object.entries(h.bag)) if (!Number.isInteger(n) || (n as number) < 1) return `bag: ${item} × ${n}`;
  for (const id of SKILL_IDS) {
    const level = h.skills?.[id]?.level;
    if (level !== undefined && (!Number.isInteger(level) || level < 1 || level > SKILL_MAX)) return `skill: ${id} ${level}`;
  }
  if (typeof h.name !== 'string') return `name: ${String(h.name)}`;
  if (!h.look || typeof h.look !== 'object' || typeof h.look.build !== 'string') return `look: ${JSON.stringify(h.look)}`;
  return null;
}

describe('a save, broken', () => {
  const good = JSON.parse(JSON.stringify(snapshot(played())));
  const fields = paths(good);

  it('is read back as it was, unbroken (the hero sound)', () => {
    const again = new GameModel(SEED, TEST_MAP_SIZE);
    restore(again, parseSave(JSON.stringify(good), SEED)!);
    expect(sound(again)).toBeNull();
    expect(again.hero.money).toBe(345);
  });

  it(`any of ${TRIES} ways (a field the wrong kind of thing, or gone): refused, or read back with the hero sound, never falling over`, () => {
    const rng = mulberry32(Number(process.env.QA_SEED ?? 20261007));
    const failures: string[] = [];
    let read = 0;
    for (let i = 0; i < TRIES; i++) {
      const save = JSON.parse(JSON.stringify(good));
      const path = fields[Math.floor(rng() * fields.length)];
      let at = save;
      for (const key of path.slice(0, -1)) at = at[key];
      const last = path[path.length - 1];
      const junk = rng() < 0.15 ? undefined : JUNK[Math.floor(rng() * JUNK.length)];
      if (junk === undefined) delete at[last];
      else at[last] = junk;
      const what = `${path.join('.')} = ${junk === undefined ? '(gone)' : JSON.stringify(junk)}`;
      try {
        const data = parseSave(JSON.stringify(save), SEED);
        if (!data) continue; // (refused: the game starts afresh)
        const model = new GameModel(SEED, TEST_MAP_SIZE);
        restore(model, data);
        model.update(0, 0, 1 / 30); // (and played on a moment)
        read++;
        const wrong = sound(model);
        if (wrong) failures.push(`${what}: ${wrong}`);
      } catch (e) {
        failures.push(`${what}: fell over (${(e as Error).message})`);
      }
    }
    expect(failures, failures.slice(0, 12).join('\n')).toEqual([]);
    expect(read).toBeGreaterThan(TRIES / 3); // (most read back: not all refused)
  }, 240_000);
});

// @vitest-environment happy-dom
// Keeping the hero safe (model/saveFile.ts, controller/storage/backups.ts, heroFiles.ts): a hero exported as a file
// and read back whole; a file from anywhere read with care (anything unsound refused with a word why, never thrown,
// nothing kept); the last three saves of a world kept behind the scenes, the newest first, one taken as the game
// opens; a backup or a file's hero put in place of the save, the save it replaces backed up first.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { HERO_FILE, heroFile, readHeroFile } from '../src/model/saveFile';
import { parseSave, restore, snapshot } from '../src/model/save';
import { BACKUPS, backupsOf, keepBackup } from '../src/controller/storage/backups';
import { MAX_WORLDS, forgetWorld, keepSave, startAutoSave } from '../src/controller/storage/saveGame';
import { heroFiles } from '../src/controller/storage/heroFiles';
import { mulberry32 } from '../src/util/random';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const SEED = TEST_SEEDS[0];
const played = () => {
  const model = new GameModel(SEED, TEST_MAP_SIZE);
  Object.assign(model.hero, { name: 'Aelric', money: 345, level: 4 });
  model.hero.bag.honeycomb = 6;
  model.hero.stash = { woodenBowl: 3 };
  return model;
};
const saveText = (model: GameModel, money = model.hero.money) => JSON.stringify({ ...snapshot(model), hero: { ...snapshot(model).hero, money } });

beforeEach(() => localStorage.clear());

describe('a hero as a file', () => {
  it('is read back whole', () => {
    const model = played();
    const { text, name } = heroFile(snapshot(model), '0.8.0');
    expect(name).toBe(`Aelric-world-${SEED}.evenhold.json`);
    expect(JSON.parse(text)).toMatchObject({ kind: HERO_FILE, game: '0.8.0' });
    const read = readHeroFile(text);
    if ('error' in read) throw new Error(read.error);
    expect([read.seed, read.name, read.level]).toEqual([SEED, 'Aelric', 4]);
    const again = new GameModel(SEED, TEST_MAP_SIZE);
    restore(again, parseSave(read.raw, SEED)!);
    expect([again.hero.name, again.hero.money, again.hero.bag.honeycomb, again.hero.stash]).toEqual(['Aelric', 345, 6, { woodenBowl: 3 }]);
    expect('error' in readHeroFile(JSON.stringify(snapshot(model)))).toBe(false); // (a bare save, as the browser keeps it)
  });

  it('refuses what is not one, saying why, and never throws', () => {
    const good = JSON.parse(heroFile(snapshot(played()), '0.8.0').text);
    const changed = (f: (file: any) => void) => {
      const file = structuredClone(good);
      f(file);
      return JSON.stringify(file);
    };
    const bad: unknown[] = [
      undefined, 42, '', 'x'.repeat(9 * 1024 * 1024), '{nope', '[]', 'null', '"text"',
      changed((f) => (f.save = [])),
      changed((f) => (f.save.seed = 'one')),
      changed((f) => (f.save.seed = -4)),
      changed((f) => (f.save.seed = 1.5)),
      changed((f) => (f.save.size = { width: 1e9, depth: 1e9 })),
      changed((f) => (f.save.size = { width: 0, depth: 96 })),
      changed((f) => (f.save.hero.name = 'A'.repeat(500))),
      changed((f) => (f.save.hero.name = '   ')),
      changed((f) => (f.save.hero.money = 'lots')),
      changed((f) => (f.save.version = 99)),
      changed((f) => delete f.save.hero),
      changed((f) => (f.save.enemies = null)),
    ];
    for (const text of bad) {
      const read = readHeroFile(text);
      expect('error' in read, String(text).slice(0, 80)).toBe(true);
      if ('error' in read) expect(read.error.length).toBeGreaterThan(5);
    }
    // Broken any which way: refused, or read as a save the game takes (restore lets go of the rest).
    const rng = mulberry32(7);
    const JUNK = [null, -1, 1e15, 'x', [], {}, true, { __proto__: { money: 1 } }];
    for (let i = 0; i < 150; i++) {
      const file = structuredClone(good);
      let at: any = file.save;
      const keys = ['hero', 'stash', 'purse', 'bag', 'equipment', 'look', 'skills', 'loot', 'coins', 'npcs', 'minutes', 'lets'];
      const key = keys[Math.floor(rng() * keys.length)];
      if (key in at.hero && rng() < 0.5) at = at.hero;
      at[key] = JUNK[Math.floor(rng() * JUNK.length)];
      const read = readHeroFile(JSON.stringify(file));
      if ('error' in read) continue;
      const model = new GameModel(SEED, TEST_MAP_SIZE);
      expect(() => restore(model, parseSave(read.raw, read.seed)!)).not.toThrow();
      expect(Number.isInteger(model.hero.money) && model.hero.money >= 0).toBe(true);
    }
  });
});

describe('backups', () => {
  it('keeps the last three, the newest first, never the same twice running, nor one that is no save', () => {
    const model = played();
    for (let money = 1; money <= 5; money++) keepBackup(SEED, saveText(model, money), money * 1000);
    keepBackup(SEED, saveText(model, 5), 9000);
    keepBackup(SEED, '{broken', 9500);
    keepBackup(SEED, null);
    const kept = backupsOf(SEED);
    expect(kept.map((b) => [b.at, JSON.parse(b.raw).hero.money])).toEqual([[5000, 5], [4000, 4], [3000, 3]]);
    expect(kept.length).toBe(BACKUPS);
    expect(kept[0]).toMatchObject({ level: 4, day: 1 });
    localStorage.setItem(`evenhold.backups.${SEED}`, JSON.stringify([{ at: 1, raw: 'no' }, 'x', { at: 2, level: 4, day: 1, raw: saveText(model) }, { at: 3, level: 'x', day: 1, raw: '' }]));
    expect(backupsOf(SEED).map((b) => b.at)).toEqual([2]); // (what can't be read, left out)
    forgetWorld(SEED);
    expect(backupsOf(SEED)).toEqual([]);
  });

  it("full storage: the other worlds' backups let go first, then its own oldest; a damaged one is never put back", () => {
    const model = played();
    const raw = saveText(model, 5);
    const quota = raw.length * 4.5; // (room, in characters, for about four saves)
    const setItem = localStorage.setItem.bind(localStorage);
    const stored = () => Array.from({ length: localStorage.length }, (_, i) => localStorage.getItem(localStorage.key(i)!)!.length).reduce((a, b) => a + b, 0);
    const full = vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
      const was = localStorage.getItem(key)?.length ?? 0;
      if (stored() - was + value.length > quota) throw new DOMException('full', 'QuotaExceededError');
      setItem(key, value);
    });
    try {
      for (let money = 1; money <= 2; money++) keepBackup(77, JSON.stringify({ ...JSON.parse(saveText(model, money)), seed: 77 }), money);
      expect(backupsOf(77).length).toBe(2);
      for (let money = 1; money <= 3; money++) keepBackup(SEED, saveText(model, money), money);
      expect(backupsOf(77)).toEqual([]); // (the other world's, let go for this one's)
      expect(backupsOf(SEED).map((b) => JSON.parse(b.raw).hero.money)).toEqual([3, 2, 1]);
      keepBackup(SEED, saveText(model, 4), 4);
      expect(backupsOf(SEED).length).toBeGreaterThan(0);
      expect(backupsOf(SEED)[0].at).toBe(4);
    } finally {
      full.mockRestore();
    }
    const files = heroFiles(model, () => ({ save() {}, forget() {}, stop() {} }), () => {}, '0.8.0');
    expect(files.restore({ at: 1, level: 1, day: 1, raw: '{broken' })).toMatch(/damaged/);
  });

  it('takes one as the game opens: the save as it stood before', () => {
    const model = played();
    localStorage.setItem(`evenhold.save.${SEED}`, saveText(model, 77));
    const auto = startAutoSave(model);
    auto.stop();
    expect(backupsOf(SEED).map((b) => JSON.parse(b.raw).hero.money)).toEqual([77]);
  });

  it('a save put in place backs up the one it replaces; no room for a ninth world', () => {
    const model = played();
    localStorage.setItem(`evenhold.save.${SEED}`, saveText(model, 10));
    expect(keepSave(SEED, saveText(model, 20))).toBe(true);
    expect(JSON.parse(localStorage.getItem(`evenhold.save.${SEED}`)!).hero.money).toBe(20);
    expect(backupsOf(SEED).map((b) => JSON.parse(b.raw).hero.money)).toEqual([10]);
    for (let s = 100; s < 100 + MAX_WORLDS; s++) localStorage.setItem(`evenhold.save.${s}`, JSON.stringify({ ...JSON.parse(saveText(model)), seed: s }));
    expect(keepSave(999, JSON.stringify({ ...JSON.parse(saveText(model)), seed: 999 }))).toBe(false);
  });
});

describe('the pause menu\'s "Your hero"', () => {
  it('imports a file of another world (played at once), asks before replacing this one, and puts a backup back', () => {
    const model = played();
    let played_: number | null = null;
    let stopped = false;
    const auto = { save() {}, forget() {}, stop: () => void (stopped = true) };
    const files = heroFiles(model, () => auto, (seed) => void (played_ = seed), '0.8.0');
    const other = { ...snapshot(model), seed: 4242 };
    expect(files.importHero(heroFile(other, '0.8.0').text, false).said).toContain('coming');
    expect([played_, JSON.parse(localStorage.getItem('evenhold.save.4242')!).seed]).toEqual([4242, 4242]);
    played_ = null;
    const same = files.importHero(heroFile(snapshot(model), '0.8.0').text, false);
    expect([same.ask, played_]).toEqual(['Replace this hero with them', null]);
    files.importHero(heroFile(snapshot(model), '0.8.0').text, true);
    expect([played_, stopped]).toEqual([SEED, true]);
    expect(files.backups().length).toBe(1); // (the hero as they were, kept)
    expect(files.importHero('{nope', true).said).toMatch(/isn't an EvenHold hero/);
  });
});

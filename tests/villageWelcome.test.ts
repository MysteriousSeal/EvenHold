// A village's name (model/villages/villageNames.ts) and the hero coming into it (villageWelcome.ts): its name the
// same every time, and unlike its neighbours'; told once as they come in (its name and level), again only once
// they've gone out of it; the village they're in (its name and level), for the place's bar, and its board's quests
// counted there.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { VILLAGE_NAMES, villageName } from '../src/model/villages/villageNames';
import { VillageWelcome } from '../src/model/villages/villageWelcome';
import { zoneLevel } from '../src/model/enemies/enemyLevels';
import { spawnOf } from '../src/model/map/grid';
import type { GameEvent, Village } from '../src/model/types';
import { FRAME, TEST_MAP_SIZE } from './support/testWorld';

describe('a village\'s name', () => {
  it('is the same every time, an old country name (no word twice), and seldom a neighbour\'s', () => {
    const names: string[] = [];
    for (let x = 0; x < 2000; x += 37) for (let z = 0; z < 2000; z += 41) names.push(villageName({ x, z }, 5));
    for (let x = 0; x < 2000; x += 37) for (let z = 0; z < 2000; z += 41) expect(villageName({ x, z }, 5)).toBe(names[(x / 37) * 49 + z / 41]);
    expect(new Set(names).size).toBeGreaterThan(names.length * 0.8);
    const qualified = names.filter((n) => n.includes(' '));
    expect(qualified.length).toBeGreaterThan(names.length * 0.1);
    expect(qualified.length).toBeLessThan(names.length * 0.3);
    for (const name of names) {
      expect(name).toMatch(/^[A-Z][a-z]+( [A-Z][a-z]+)?$/);
      const [last, before] = name.split(' ').reverse();
      if (before) expect(last.startsWith(before)).toBe(false); // (not "Kings Kingsford")
      expect(VILLAGE_NAMES.stems.some((stem) => last.startsWith(stem))).toBe(true);
      expect(last.toLowerCase()).not.toMatch(/^(\w+)\1$/); // (not "Fordford")
    }
  });
});

describe('coming into a village', () => {
  const village: Village = { x: 100, z: 100, groundTier: 0 };
  const world = { villages: [village], houses: [], buildings: [], seed: 9, size: TEST_MAP_SIZE };
  const walk = (welcome: VillageWelcome, path: Array<[number, number]>) => {
    const told: GameEvent[] = [];
    for (const [x, z] of path) welcome.update({ x, z }, (e) => told.push(e));
    return told;
  };

  it('tells its name and level once, as the hero comes in; again only once they\'ve gone out of it', () => {
    const welcome = new VillageWelcome(() => world);
    expect(walk(welcome, [[130, 100], [120, 100]])).toEqual([]);
    expect(welcome.village()).toBeNull();
    const level = zoneLevel(spawnOf(TEST_MAP_SIZE), village);
    expect(walk(welcome, [[111, 100], [105, 100], [100, 100]])).toEqual([{ kind: 'village', name: villageName(village, 9), level }]);
    expect(welcome.village()).toEqual({ village, name: villageName(village, 9), level });
    expect(walk(welcome, [[113, 100], [111, 100], [114, 100], [110, 100]])).toEqual([]); // (about its edge: not told over and over)
    expect(walk(welcome, [[118, 100]])).toEqual([]);
    expect(welcome.village()).toBeNull();
    expect(walk(welcome, [[111, 100]])).toHaveLength(1);
  });

  it('in a game: told as the hero comes into one of the world\'s villages', () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    const v = model.villages[0];
    model.teleport(v.x + 40, v.z);
    model.update(0, 0, FRAME);
    model.takeEvents();
    model.teleport(v.x + 1.5, v.z + 1.5);
    model.update(0, 0, FRAME);
    expect(model.takeEvents().filter((e) => e.kind === 'village')).toEqual([{ kind: 'village', name: villageName(v, model.seed), level: zoneLevel(spawnOf(model.size), v) }]);
    expect(model.welcome.village()).toEqual({ village: v, name: villageName(v, model.seed), level: zoneLevel(spawnOf(model.size), v) });
  });
});

describe("a village's notice board, counted (for the place's bar)", () => {
  it('its quests done for good, of its six (taken or abandoned, not)', () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    const board = model.boardOf(model.villages[0]);
    expect(model.quests.tallyAt(board)).toEqual({ completed: 0, of: 6 });
    const [first, second] = model.quests.offersAt(board);
    model.quests.accept(first);
    model.quests.accept(second);
    expect(model.quests.tallyAt(board)).toEqual({ completed: 0, of: 6 }); // (taken: not done yet)
    const taken = model.quests.takenOf(first.key)!;
    if (first.kind === 'kill') taken.kills = first.count;
    else model.hero.bag[first.item!] = first.count;
    expect(model.quests.handIn(first.key)).toBe(true);
    expect(model.quests.tallyAt(board)).toEqual({ completed: 1, of: 6 });
    model.quests.abandon(second.key);
    expect(model.quests.tallyAt(board)).toEqual({ completed: 1, of: 6 });
  });
});

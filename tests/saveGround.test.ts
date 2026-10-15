// A save's things where they were (model/save.ts): what lies on the ground far off, on its ground once its region's
// made (not buried at the height of the land unmade).
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { MAX_LEVEL, parseSave, restore, snapshot } from '../src/model/save';
import { POINTS_PER_LEVEL } from '../src/model/hero/training';
import { STREAMED_SIZE } from '../src/model/worldgen/regions';
import { spawnOf } from '../src/model/map/grid';
import { LOOT_IDS } from '../src/model/loot/loot';
import { fresh } from './support/testWorld';
import { HERO_RADIUS } from '../src/model/constants';

const SEED = 7;

describe("a save's loot far off", () => {
  it('sits on the ground once its region is made', () => {
    const model = new GameModel(SEED, STREAMED_SIZE);
    const spawn = spawnOf(model.size);
    model.makeAround(spawn.x + 700, spawn.z);
    let x = spawn.x + 700;
    while (model.getGroundY(x, spawn.z) <= 0) x++; // (a spot on higher ground)
    const [z, y] = [spawn.z, model.getGroundY(x, spawn.z)];
    model.ground.drop(LOOT_IDS[0], x, z);
    model.ground.dropCoins(5, x, z);
    const again = new GameModel(SEED, STREAMED_SIZE);
    restore(again, parseSave(JSON.stringify(snapshot(model)), SEED)!);
    again.makeAround(x, z);
    expect(again.getGroundY(x, z)).toBe(y);
    expect(again.ground.loot.find((l) => l.x === x)?.y).toBe(y);
    expect(again.ground.coins.find((c) => c.x === x)?.y).toBe(y);
  });
});

describe("a hero file's level past all", () => {
  it('gives no more stat points than the highest level earns', () => {
    const model = fresh();
    for (const statPoints of [undefined, 1e300]) {
      const data = snapshot(model);
      Object.assign(data.hero, { level: 1e300, statPoints });
      const again = fresh();
      restore(again, parseSave(JSON.stringify(data), again.seed)!);
      expect(again.hero.level).toBe(MAX_LEVEL);
      expect(again.hero.statPoints).toBe(POINTS_PER_LEVEL * (MAX_LEVEL - 1)); // (all to spend: none trained)
    }
  });
});

describe('a hero saved against a tree', () => {
  it('stays where they stood', () => {
    const model = fresh();
    const spots = model.trees.flatMap((t) => [-0.45, 0.45].flatMap((dx) => [-0.45, 0.45].map((dz) => ({ x: Math.round(t.x) + dx, z: Math.round(t.z) + dz }))));
    const at = spots.find(({ x, z }) => x > 1 && z > 1 && x < model.size.width - 1 && z < model.size.depth - 1 && !model.isOpenTile(Math.round(x), Math.round(z)) && !model.isBlocked(x, z, HERO_RADIUS))!; // (in a tree's tile, clear of its trunk)
    Object.assign(model.hero, at);
    const again = fresh();
    restore(again, parseSave(JSON.stringify(snapshot(model)), again.seed)!);
    expect([again.hero.x, again.hero.z]).toEqual([at.x, at.z]);
  });
});

describe('a save made in the furniture yard', () => {
  it('keeps the villagers near where the hero came from', () => {
    const model = new GameModel(SEED, STREAMED_SIZE);
    const village = model.villages.reduce((a, b) => (Math.hypot(b.x - model.hero.x, b.z - model.hero.z) < Math.hypot(a.x - model.hero.x, a.z - model.hero.z) ? b : a));
    model.teleport(village.x, village.z);
    const npc = model.npcs.find((n) => n.village === village && model.story.markOf(n) === null)!; // (none that something hangs on: kept anyway)
    npc.x = village.x + 1; // (about their day: changed from the seed's)
    model.toggleFurnitureYard();
    expect(snapshot(model).npcs.map((n) => n.id)).toContain(npc.id);
  });
});

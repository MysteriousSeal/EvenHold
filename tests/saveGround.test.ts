// A save's things where they were (model/save.ts): what lies on the ground far off, on its ground once its region's
// made (not buried at the height of the land unmade).
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { parseSave, restore, snapshot } from '../src/model/save';
import { STREAMED_SIZE } from '../src/model/worldgen/regions';
import { spawnOf } from '../src/model/map/grid';
import { LOOT_IDS } from '../src/model/loot/loot';

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

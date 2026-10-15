// An older save in the cathedral town's spot (model/save.ts restore): a hero saved where its walls now stand, or
// inside a house it stood in place of, loads on open ground near there (never in a wall, never at the world's corner);
// quests and bounties taken at a village it stood in place of are let go, but told.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { restore, snapshot, type SaveData } from '../src/model/save';
import { townSite } from '../src/model/town/townSite';
import { STREAMED_SIZE } from '../src/model/worldgen/regions';

const SEED = 7;
const site = townSite(SEED, STREAMED_SIZE)!;
const older = (change: (data: SaveData) => void): GameModel => {
  const data = JSON.parse(JSON.stringify(snapshot(new GameModel(SEED, STREAMED_SIZE)))) as SaveData;
  change(data);
  const model = new GameModel(SEED, STREAMED_SIZE);
  restore(model, data);
  return model;
};
const near = (model: GameModel, x: number, z: number) => Math.hypot(model.hero.x - x, model.hero.z - z);

describe('an older save in the town\'s spot', () => {
  it('a hero saved where its wall now stands loads on open ground beside it', () => {
    const model = older((d) => Object.assign(d.hero, { x: 7746, z: 7820, inside: null, upstairs: false }));
    expect(model.isOpenTile(Math.round(model.hero.x), Math.round(model.hero.z))).toBe(true);
    expect(near(model, 7746, 7820)).toBeLessThan(40);
  });

  it('a hero saved inside a house the town replaced loads outdoors by where its door was', () => {
    const model = older((d) => Object.assign(d.hero, { x: 6, z: 7, inside: 8093989458, upstairs: false }));
    expect(model.inside).toBeNull();
    expect(model.isOpenTile(Math.round(model.hero.x), Math.round(model.hero.z))).toBe(true);
    expect(near(model, site.x, site.z)).toBeLessThan(200);
  });

  it('a quest and a bounty taken at a village the town replaced are let go, told', () => {
    const board = (site.x + 1) * STREAMED_SIZE.depth + site.z; // (a village by its well let go: none there now)
    const model = older((d) => {
      d.quests = { completed: [], taken: [{ key: `${board}:0`, kills: 0, gathered: 0, tracked: true }] } as SaveData['quests'];
      d.bounties = { taken: [{ key: `${board}:0:0`, slain: false }] } as SaveData['bounties'];
    });
    expect(model.quests.save().taken).toEqual([]);
    expect(model.takeEvents().some((e) => e.kind === 'banner')).toBe(true);
  });
});

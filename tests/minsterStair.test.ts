// The way down to the bishop's ossuary from the Minster, in a streamed world as the game makes it: the stair in its aisle
// leads to the reliquary (reliquary/reliquary.ts), registered as the town's region is made (world/liveWorld.ts).

import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { STREAMED_SIZE } from '../src/model/worldgen/regions';
import { townSite } from '../src/model/town/townSite';
import { RELIQUARY_STAIR } from '../src/model/cathedral/cathedralLayout';
import { restore, snapshot } from '../src/model/save';

const SEED = 3;

describe("the Minster's stair", () => {
  it('leads down to the reliquary from inside the Minster', () => {
    const site = townSite(SEED, STREAMED_SIZE)!;
    const model = new GameModel(SEED, STREAMED_SIZE);
    model.teleport(site.x, site.z + 3);
    const minster = model.entrances.find((e) => e.type === 'cathedral');
    expect(minster).toBeTruthy();
    model.enterRoom(minster!);
    expect(model.inside?.entrance).toBe(minster);
    Object.assign(model.hero, { x: RELIQUARY_STAIR[0] + 0.6, z: RELIQUARY_STAIR[1] + 1.9 });
    expect(model.doorInReach?.type).toBe('reliquary');
  });

  it('a save made in the ossuary loads in the ossuary, not in the Minster', () => {
    const site = townSite(SEED, STREAMED_SIZE)!;
    const model = new GameModel(SEED, STREAMED_SIZE);
    model.teleport(site.x, site.z + 3);
    const minster = model.entrances.find((e) => e.type === 'cathedral')!;
    model.enterRoom(minster);
    Object.assign(model.hero, { x: RELIQUARY_STAIR[0] + 0.6, z: RELIQUARY_STAIR[1] + 1.9 });
    const down = model.doorInReach!;
    model.enterRoom(down);
    expect(model.inside?.entrance.type).toBe('reliquary');
    const data = snapshot(model);
    const again = new GameModel(SEED, STREAMED_SIZE);
    restore(again, data);
    expect(again.inside?.entrance.type).toBe('reliquary');
  });
});

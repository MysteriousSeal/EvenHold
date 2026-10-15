// The hedge-witch never displaces anyone the story has a part for (model/witch/witchHomes.ts, npcs.ts): the house she
// takes is never that of a village's two villagers who give its quests (story/storyCast.ts: villagerA, the first;
// villagerB, the first after who works a field, else the second), so every older save's quests keep their people.
import { describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { spawnNpcs, type Npc } from '../src/model/npcs/npcs';
import { castOf } from '../src/model/story/storyCast';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

let witches = true;
vi.mock('../src/model/witch/witchHomes', async (original) => {
  const real = await original<typeof import('../src/model/witch/witchHomes')>();
  return { ...real, hasWitch: (...a: Parameters<typeof real.hasWitch>) => witches && real.hasWitch(...a), witchHomeIn: (...a: Parameters<typeof real.witchHomeIn>) => (witches ? real.witchHomeIn(...a) : null) };
});

const SIZES = [TEST_MAP_SIZE, { width: 256, depth: 256 }];
const parts = (model: GameModel, npcs: Npc[]) => castOf({ ...model, villages: model.villages, npcs, scenery: model.scenery, ruins: model.ruins, camps: model.camps, caves: model.caves, seed: model.seed, size: model.size, boardOf: (v) => model.boardOf(v) }).villages.map((s) => [(s.who.villagerA as Npc | undefined)?.id, (s.who.villagerB as Npc | undefined)?.id]);

describe('the hedge-witch spares the story', () => {
  it("never takes the house of a village's quest-giving villagers: their parts the same as with no witch at all", () => {
    let housed = 0;
    for (const size of SIZES) {
      for (const seed of TEST_SEEDS) {
        const model = new GameModel(seed, size);
        const spawn = () => spawnNpcs(seed, model.entrances, model.villages, model.fields);
        witches = false;
        const without = parts(model, spawn());
        witches = true;
        const npcs = spawn();
        housed += npcs.filter((n) => n.role === 'witch').length;
        expect(parts(model, npcs), `seed ${seed}, ${size.width}`).toEqual(without);
      }
    }
    expect(housed).toBeGreaterThan(3);
  });
});

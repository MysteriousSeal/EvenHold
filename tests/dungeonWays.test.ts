// Every dungeon of every test world (a crypt, a cave, a stronghold), all its foes slain: its boss's chest and its
// way out at the far end come to on foot from the way in, round its rock, what stands solid in it and the chest
// itself (the hero's own walls: model.inside.walls), not merely there on the plan.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { HERO_RADIUS, INDOOR_SCALE } from '../src/model/constants';
import { atWayOut } from '../src/model/interiors/indoors';
import type { Entrance } from '../src/model/interiors/interiors';
import { FRAME, TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

// Down it with every foe there slain, for good (its boss risen, if it rises, and slain too).
function cleared(model: GameModel, entrance: Entrance): void {
  model.teleport(entrance.x, entrance.z);
  model.useDoor();
  for (let round = 0; round < 3; round++) {
    for (const foe of model.foes) if (foe.state !== 'dead') [(foe.hp = 0), (foe.state = 'dead'), model.slayGuard(foe)];
    model.update(0, 0, FRAME);
  }
}

// The spots on the floor (half a tile apart) the hero could walk to from the foot of the way in.
function walkable(model: GameModel): Array<{ x: number; z: number }> {
  const { room, walls } = model.inside!;
  const r = HERO_RADIUS * INDOOR_SCALE;
  const start = [room.door * 2, (room.depth - 1) * 2];
  const seen = new Set([start.join()]);
  const todo = [start];
  while (todo.length > 0) {
    const [x, z] = todo.pop()!;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const [nx, nz] = [x + dx, z + dz];
      if (seen.has(`${nx},${nz}`) || nx < 0 || nz < 0 || nx > room.width * 2 || nz > room.depth * 2 || walls!(nx / 2, nz / 2, r)) continue;
      seen.add(`${nx},${nz}`);
      todo.push([nx, nz]);
    }
  }
  return [...seen].map((k) => k.split(',').map((n) => Number(n) / 2)).map(([x, z]) => ({ x, z }));
}

describe('every dungeon, cleared', () => {
  for (const seed of TEST_SEEDS) {
    it(`seed ${seed}: its boss's chest and its way out come to from the way in`, { timeout: 60_000 }, () => {
      const model = new GameModel(seed, TEST_MAP_SIZE);
      const places = [...model.crypts, ...model.caves, ...model.strongholds];
      expect(places.length).toBeGreaterThan(0);
      for (const { entrance } of places) {
        cleared(model, entrance);
        const run = model.dungeon!;
        expect(run.share, entrance.type).toBe(1);
        const spots = walkable(model);
        const chest = run.chest!;
        expect(spots.some((s) => run.chestInReach(s)), `${entrance.type}'s chest at ${chest.x},${chest.z}`).toBe(true);
        expect(spots.some((s) => atWayOut(model.inside!, s)), `${entrance.type}'s way out at ${JSON.stringify(run.exitOpen)}`).toBe(true);
        model.teleport(entrance.x, entrance.z);
      }
    });
  }
});

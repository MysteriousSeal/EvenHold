// Every ruin has its crypt's way down, over 50 random seeds: a world of
// 2 x 2 ruin regions (1024 tiles a side: model/ruins/ruins.ts, one ruin to
// RUIN_REGION) stands 4 ruins, and each of the 4 has its tomb, four tiles
// inside it (its stairs two side by side), level, blocked, the ground before
// them open, its way in a crypt's (model/crypts/crypts.ts). Only the world and
// what stands in it (its obstacles, the ruins', the camps', the crypts': laid
// as the game model lays them, in that order), not the whole game. Each world
// takes a second or so to make: the 50 are split over five files
// (tests/cryptEntrances/), so they're made side by side.
import { describe, expect, it } from 'vitest';
import { RUIN_REGION, addRuinObstacles } from '../../src/model/ruins/ruins';
import { mulberry32 } from '../../src/util/random';
import { generateWorld, solidCells } from '../../src/model/worldgen/world';
import { worldObstacles } from '../../src/model/map/blockers';
import { addCampObstacles } from '../../src/model/camps/camps';
import { addCryptObstacles, placeCrypts } from '../../src/model/crypts/crypts';

const SIZE = { width: 2 * RUIN_REGION, depth: 2 * RUIN_REGION };
const SEEDS = Array.from({ length: 50 }, (_, i) => Math.floor(mulberry32(9100 + i)() * 2 ** 31));
export const PARTS = 5;

// The world of `seed`, its crypts placed and everything that blocks the way laid, as GameModel does.
function cryptWorld(seed: number) {
  const world = generateWorld(seed, SIZE);
  const obstacles = worldObstacles({ ...world, seed }, solidCells(world));
  addRuinObstacles(obstacles, world.ruins);
  addCampObstacles(obstacles, world.camps);
  const isOpenTile = (x: number, z: number) => obstacles.isOpenTile(x, z);
  const crypts = placeCrypts({ seed, size: SIZE, ruins: world.ruins, heightMap: world.heightMap, isOpenTile });
  addCryptObstacles(obstacles, crypts);
  return { ruins: world.ruins, crypts, heightMap: world.heightMap, isOpenTile };
}

// The seeds of `part` (0 up to PARTS), checked.
export function checkCryptEntrances(part: number): void {
  describe(`crypt entrances: 4 ruins out of 4 (seeds part ${part + 1} of ${PARTS})`, () => {
    for (const seed of SEEDS.filter((_, i) => i % PARTS === part)) {
      it(`seed ${seed}`, () => {
        const model = cryptWorld(seed);
        expect(model.ruins).toHaveLength(4);
        expect(model.crypts).toHaveLength(4);
        for (const ruin of model.ruins) {
          const crypt = model.crypts.find((c) => c.ruin === ruin);
          expect(crypt, `a way down in the ruin at ${ruin.x},${ruin.z}`).toBeDefined();
          const { tiles, steps, entrance } = crypt!;
          expect(tiles).toHaveLength(4);
          for (const t of tiles) {
            expect(t.x > ruin.x && t.x < ruin.x + ruin.w - 1 && t.z > ruin.z && t.z < ruin.z + ruin.d - 1).toBe(true); // inside it
            expect(model.isOpenTile(t.x, t.z)).toBe(false); // blocked: down with E
            expect(model.heightMap[t.x][t.z]).toBe(model.heightMap[tiles[0].x][tiles[0].z]); // level
          }
          for (const t of steps) expect(model.isOpenTile(t.x + entrance.outX, t.z + entrance.outZ)).toBe(true); // the ground before the stairs open
          expect(entrance.type).toBe('crypt');
        }
      }, 30_000);
    }
  });
}

// Every ruin has its crypt's way down, over 50 random seeds: a world of
// 2 x 2 ruin regions (1024 tiles a side: model/ruins/ruins.ts, one ruin to
// RUIN_REGION) stands 4 ruins, and each of the 4 has its tomb, four tiles
// inside it (its stairs two side by side), level, blocked, the ground before
// them open, its way in a crypt's (model/crypts/crypts.ts).
//
// A light world, not the whole one: made as generateWorld makes it (the same
// dice thrown in the same order, so the very same terrain, lakes and
// villages), but without what a crypt doesn't stand on: the roads between the
// villages (two thirds of a world's making), the fields, trees, bushes and
// camps. Its ruins are placed as the game places them, on that land, its
// crypts likewise, among the same obstacles (what's left of them: the lakes,
// the villages', the ruins'). (Its ruins may stand where a road would have
// turned one aside: a ruin all the same, and its crypt found the same way.)
// About a third of a whole world's time; the 50 still split over five files
// (tests/cryptEntrances/), made side by side.
import { describe, expect, it } from 'vitest';
import { createNoise2D } from 'simplex-noise';
import { RUIN_REGION, addRuinObstacles, placeRuins } from '../../src/model/ruins/ruins';
import { mulberry32 } from '../../src/util/random';
import { solidCells } from '../../src/model/worldgen/world';
import { generateHeightMap, smoothHeightMap } from '../../src/model/worldgen/terrain';
import { generateLakeMap } from '../../src/model/worldgen/lakes';
import { generateVillages } from '../../src/model/worldgen/villages';
import { LAKE_THRESHOLD_MAX, LAKE_THRESHOLD_MIN } from '../../src/model/constants';
import { cellKey, spawnOf } from '../../src/model/map/grid';
import type { Surface } from '../../src/model/types';
import { worldObstacles } from '../../src/model/map/blockers';
import { addCryptObstacles, placeCrypts } from '../../src/model/crypts/crypts';

const SIZE = { width: 2 * RUIN_REGION, depth: 2 * RUIN_REGION };
const SEEDS = Array.from({ length: 50 }, (_, i) => Math.floor(mulberry32(9100 + i)() * 2 ** 31));
export const PARTS = 5;

// The light world of `seed` (above): its land as generateWorld makes it, its ruins on it, their crypts placed and
// what blocks the way laid, as GameModel lays them.
function cryptWorld(seed: number) {
  const spawn = spawnOf(SIZE);
  const rng = mulberry32(seed);
  const noise2D = createNoise2D(rng);
  const lakeThreshold = LAKE_THRESHOLD_MIN + rng() * (LAKE_THRESHOLD_MAX - LAKE_THRESHOLD_MIN);
  const heightMap = generateHeightMap(noise2D, SIZE);
  smoothHeightMap(heightMap);
  const lakeMap = generateLakeMap(heightMap, noise2D, lakeThreshold, spawn.x, spawn.z);
  const surfaceMap: Surface[][] = heightMap.map((row) => row.map((): Surface => 'natural'));
  const { villages, houses, buildings } = generateVillages(heightMap, lakeMap, surfaceMap, rng, spawn.x, spawn.z);
  const solid = solidCells({ houses, buildings, villages });
  const ruins = placeRuins({ seed, size: SIZE, heightMap, surfaceMap, villages, isOpenTile: (x, z) => !lakeMap[x][z] && !solid.has(cellKey(x, z)) });
  const obstacles = worldObstacles({ seed, size: SIZE, lakeMap, surfaceMap, villages, houses, buildings, fields: [], trees: [], bushes: [] }, solid);
  addRuinObstacles(obstacles, ruins);
  const isOpenTile = (x: number, z: number) => obstacles.isOpenTile(x, z);
  const crypts = placeCrypts({ seed, size: SIZE, ruins, heightMap, isOpenTile });
  addCryptObstacles(obstacles, crypts);
  return { ruins, crypts, heightMap, isOpenTile };
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

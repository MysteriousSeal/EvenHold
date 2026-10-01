// Every ruin has its crypt's way down, over 50 random seeds: a world of
// 2 x 2 ruin regions (1024 tiles a side: model/ruins/ruins.ts, one ruin to
// RUIN_REGION) stands 4 ruins, and each of the 4 has its stairs, two tiles
// side by side inside it, level, blocked, the ground before them open, the
// way down in the world's doors (model/crypts/crypts.ts). (About a second a
// seed: the world's whole.)
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { RUIN_REGION } from '../src/model/ruins/ruins';
import { mulberry32 } from '../src/util/random';

const SIZE = { width: 2 * RUIN_REGION, depth: 2 * RUIN_REGION };
const seeds = Array.from({ length: 50 }, (_, i) => Math.floor(mulberry32(9100 + i)() * 2 ** 31));

describe('crypt entrances: 4 ruins out of 4, on 50 seeds', () => {
  for (const seed of seeds) {
    it(`seed ${seed}`, () => {
      const model = new GameModel(seed, SIZE);
      expect(model.ruins).toHaveLength(4);
      expect(model.crypts).toHaveLength(4);
      for (const ruin of model.ruins) {
        const crypt = model.crypts.find((c) => c.ruin === ruin);
        expect(crypt, `a way down in the ruin at ${ruin.x},${ruin.z}`).toBeDefined();
        const { tiles, entrance } = crypt!;
        for (const t of tiles) {
          expect(t.x > ruin.x && t.x < ruin.x + ruin.w - 1 && t.z > ruin.z && t.z < ruin.z + ruin.d - 1).toBe(true); // inside it
          expect(model.isOpenTile(t.x, t.z)).toBe(false); // blocked: down with E
          expect(model.isOpenTile(t.x + entrance.outX, t.z + entrance.outZ)).toBe(true); // the ground before it open
          expect(model.heightMap[t.x][t.z]).toBe(model.heightMap[tiles[0].x][tiles[0].z]);
        }
        expect(model.entrances).toContain(entrance);
      }
    }, 30_000);
  }
});

import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { spawnOf } from '../src/model/grid';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const worlds = TEST_SEEDS.map((seed) => new GameModel(seed, TEST_MAP_SIZE));

describe('bandit camps in every test world', () => {
  it('have one a short walk from spawn', () => {
    for (const model of worlds) {
      const spawn = spawnOf(model.size);
      expect(model.camps.length, `seed ${model.seed}`).toBeGreaterThan(0);
      expect(Math.hypot(model.camps[0].x - spawn.x, model.camps[0].z - spawn.z)).toBeLessThan(25);
    }
  });

  it('have their fire, tents, rack, crates, loot and a palisade (open at the way in), on level grass', () => {
    for (const model of worlds) {
      for (const camp of model.camps) {
        const kinds = camp.pieces.map((p) => p.kind);
        for (const kind of ['fire', 'rack', 'crates', 'loot'] as const) expect(kinds.filter((k) => k === kind)).toHaveLength(1);
        expect(kinds.filter((k) => k === 'tent')).toHaveLength(2);
        expect(kinds.filter((k) => k === 'palisade')).toHaveLength(19);
        const tier = model.heightMap[camp.x][camp.z];
        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
          expect(model.heightMap[camp.x + dx][camp.z + dz]).toBe(tier);
          expect(model.surfaceMap[camp.x + dx][camp.z + dz]).toBe('natural');
        }
      }
    }
  });

  it('stand in a clearing of their own, clear of the ruins and of each other', () => {
    for (const model of worlds) {
      for (const [i, camp] of model.camps.entries()) {
        const near = (x: number, z: number) => Math.abs(x - camp.x) <= 3 && Math.abs(z - camp.z) <= 3;
        expect(model.trees.some((t) => near(Math.round(t.x), Math.round(t.z)))).toBe(false);
        expect(model.bushes.some((b) => near(b.x, b.z))).toBe(false);
        for (const r of model.ruins) expect(camp.x + 3 < r.x || camp.x - 3 >= r.x + r.w || camp.z + 3 < r.z || camp.z - 3 >= r.z + r.d, 'a camp in a ruin').toBe(true);
        for (const other of model.camps.slice(i + 1)) expect(Math.max(Math.abs(other.x - camp.x), Math.abs(other.z - camp.z))).toBeGreaterThan(4);
      }
    }
  });

  it('can be walked into by their way in, and have their bandits inside', () => {
    for (const model of worlds) {
      for (const camp of model.camps) {
        expect(model.isOpenTile(camp.way.x, camp.way.z)).toBe(true);
        expect(Math.max(Math.abs(camp.way.x - camp.x), Math.abs(camp.way.z - camp.z))).toBe(3); // just outside
        const bandits = model.enemies.filter((e) => e.kind === 'bandit' && Math.max(Math.abs(e.x - camp.x), Math.abs(e.z - camp.z)) <= 2);
        expect(bandits.length).toBeGreaterThanOrEqual(Math.min(2, camp.bandits));
      }
    }
  });

  it('are the same every time for a world, and differ from one world to the next', () => {
    expect(new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE).camps).toEqual(worlds[0].camps);
    const layouts = new Set(worlds.map((m) => JSON.stringify(m.camps.map((c) => [c.x, c.z, c.quarterTurns]))));
    expect(layouts.size).toBe(worlds.length); // each world's camps its own
  });
});

describe('a bandit away from its camp', () => {
  it('walks home round the palisade, in through the gate, not stuck against the back of it', () => {
    const problems: string[] = [];
    for (const seed of TEST_SEEDS) {
      const model = new GameModel(seed, TEST_MAP_SIZE);
      model.godMode = true;
      const camp = model.camps[0];
      const bandit = model.enemies.find((e) => e.kind === 'bandit' && e.homeX === camp.x && e.homeZ === camp.z)!;
      // Just behind the palisade, on the side away from the gate; the hero well out of its sight and hearing.
      const [bx, bz] = [2 * camp.x - camp.way.x, 2 * camp.z - camp.way.z];
      if (!model.isOpenTile(bx, bz)) continue; // (nowhere to stand there)
      Object.assign(bandit, { x: bx, z: bz, state: 'wander', target: { x: camp.x, z: camp.z }, restFor: 0, path: null });
      // Alone (its mates could stand in the gate, and it'd rightly go elsewhere).
      model.enemies.splice(0, model.enemies.length, bandit);
      model.teleport(camp.x + (camp.way.x - camp.x) * 4, camp.z + (camp.way.z - camp.z) * 4);
      for (let t = 0; t < 30 && !(Math.abs(bandit.x - camp.x) <= 2 && Math.abs(bandit.z - camp.z) <= 2); t += 1 / 30) model.update(0, 0, 1 / 30);
      if (!(Math.abs(bandit.x - camp.x) <= 2 && Math.abs(bandit.z - camp.z) <= 2)) problems.push(`seed ${seed}: still outside at ${bandit.x.toFixed(1)},${bandit.z.toFixed(1)} (${bandit.state})`);
    }
    expect(problems).toEqual([]);
  });
});

describe("a camp's bandits, left alone", () => {
  it('wander only inside their palisade, never out through the gate to crowd it', () => {
    const problems: string[] = [];
    for (const seed of TEST_SEEDS) {
      const model = new GameModel(seed, TEST_MAP_SIZE);
      model.godMode = true;
      const camp = model.camps[0];
      const mine = model.enemies.filter((e) => e.kind === 'bandit' && e.homeX === camp.x && e.homeZ === camp.z);
      // Well out of their sight and hearing, still near enough that they think.
      model.teleport(camp.x + (camp.way.x - camp.x) * 5, camp.z + (camp.way.z - camp.z) * 5);
      for (let t = 0; t < 120; t += 1 / 30) {
        model.update(0, 0, 1 / 30);
        for (const b of mine) {
          if (b.state === 'wander' && (Math.abs(b.x - camp.x) > 2.5 || Math.abs(b.z - camp.z) > 2.5)) problems.push(`seed ${seed}: bandit ${b.id} out at ${b.x.toFixed(1)},${b.z.toFixed(1)}`);
        }
        if (problems.length) break;
      }
    }
    expect(problems).toEqual([]);
  });
});

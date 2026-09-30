import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { layoutOf } from '../src/model/interiors/indoors';
import { ordersAt } from '../src/model/inn/barOrders';
import { NPC_RADIUS } from '../src/model/npcs/npcs';
import { MAX_ENERGY } from '../src/model/hero/heroStats';
import { ENEMY_ACTIVE_RADIUS } from '../src/model/constants';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const FRAME = 1 / 30;
const GAME_MINUTES = 180; // three hours of the day (three real minutes)
const finite = (...xs: number[]) => xs.every(Number.isFinite);

describe('a world left to run', () => {
  for (const seed of TEST_SEEDS) {
    it(`keeps sound for three hours of the day (seed ${seed})`, () => {
      const model = new GameModel(seed, TEST_MAP_SIZE);
      model.godMode = true; // (not to fall and be carried off meanwhile)
      const start = model.minutes;
      const moved = new Set<number>();
      const from = new Map(model.npcs.map((n) => [n.id, [n.x, n.z, n.where] as const]));
      const problems: string[] = [];
      const note = (p: string) => problems.length < 5 && problems.push(p);
      // The world runs round the hero (villages and foes near them): they go
      // round the villages in turn, each its share of the time.
      const { villages } = model;
      const visited = new Set<number>();
      const perVillage = GAME_MINUTES / villages.length;
      for (let step = 0; step * FRAME < GAME_MINUTES; step++) {
        const at = Math.floor((step * FRAME) / perVillage);
        if (!visited.has(at) && villages[at]) {
          visited.add(at);
          model.teleport(villages[at].x + 3, villages[at].z + 3);
        }
        model.update(0, 0, FRAME);
        if (step % 30 !== 0) continue; // a look each second
        const { hero } = model;
        if (!finite(hero.x, hero.y, hero.z, hero.hp, hero.energy, hero.money)) note(`hero: not a number (${hero.x}, ${hero.z})`);
        for (const e of model.enemies) {
          if (!finite(e.x, e.y, e.z, e.hp)) note(`foe ${e.id}: not a number`);
          if (e.state !== 'dead' && model.isBlocked(e.x, e.z, 0.05)) note(`foe ${e.kind} ${e.id} in a wall at ${e.x.toFixed(2)},${e.z.toFixed(2)}`);
        }
        for (const n of model.npcs) {
          if (!finite(n.x, n.y, n.z)) note(`villager ${n.name}: not a number`);
          const [x0, z0, w0] = from.get(n.id)!;
          if (Math.hypot(n.x - x0, n.z - z0) > 0.5 || n.where !== w0) moved.add(n.id);
          if (n.where) {
            const { room } = layoutOf(seed, n.where);
            if (n.x < -0.5 || n.z < -0.5 || n.x > room.width - 0.5 || n.z > room.depth - 0.5) note(`villager ${n.name} out of their room at ${n.x.toFixed(2)},${n.z.toFixed(2)}`);
          } else if (!n.seat && model.isBlocked(n.x, n.z, NPC_RADIUS * 0.3)) note(`villager ${n.name} (${n.role}) in a wall at ${n.x.toFixed(2)},${n.z.toFixed(2)}`);
        }
      }
      expect(problems).toEqual([]);
      expect(model.minutes - start).toBeCloseTo(GAME_MINUTES, 0);
      expect(model.hero.energy).toBeGreaterThanOrEqual(0);
      expect(model.hero.energy).toBeLessThanOrEqual(MAX_ENERGY);
      for (const inn of model.entrances.filter((e) => e.type === 'inn')) expect(ordersAt(inn).length, 'orders waiting at the bar').toBeLessThanOrEqual(4);
      const near = (v: { x: number; z: number }) => [...visited].some((i) => Math.abs(villages[i].x - v.x) <= ENEMY_ACTIVE_RADIUS && Math.abs(villages[i].z - v.z) <= ENEMY_ACTIVE_RADIUS);
      const villagers = model.npcs.filter((n) => n.role === 'villager' && near(n.village)); // (those whose village ran)
      expect(villagers.filter((n) => moved.has(n.id)).length / villagers.length, 'villagers who went about their day').toBeGreaterThan(0.6);
    });
  }
});

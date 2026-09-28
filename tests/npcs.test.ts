import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { layoutOf } from '../src/model/interiors/indoors';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const withVillage = () => TEST_SEEDS.map((seed) => new GameModel(seed, TEST_MAP_SIZE)).find((m) => m.houses.length > 2 && m.buildings.some((b) => b.kind === 'inn'))!;

describe('villagers', () => {
  it('live one to a house, each in their own, named, naked, the same for a seed', () => {
    const model = withVillage();
    const homes = model.entrances.filter((e) => e.type === 'house');
    expect(model.npcs).toHaveLength(homes.length);
    expect(new Set(model.npcs.map((n) => n.home)).size).toBe(homes.length);
    for (const npc of model.npcs) {
      expect(npc.name.length).toBeGreaterThan(2);
      expect(npc.equipment).toEqual({});
      expect(npc.where).toBe(npc.home); // at home, to begin with
    }
    const again = new GameModel(model.seed, TEST_MAP_SIZE);
    expect(again.npcs.map((n) => [n.name, n.look])).toEqual(model.npcs.map((n) => [n.name, n.look]));
  });

  it('go about their routine: home, the square, the inn, never two on one seat', () => {
    const model = withVillage();
    const village = model.npcs[0].village;
    model.teleport(village.x + 0.5, village.z + 0.5); // on the square, watching
    const seen = { square: false, inn: false, home: false };
    for (let t = 0; t < 600; t += 0.1) {
      model.update(0, 0, 0.1);
      for (const npc of model.npcs) {
        if (npc.where === null) {
          if (Math.max(Math.abs(npc.x - npc.village.x), Math.abs(npc.z - npc.village.z)) <= 3.5) seen.square = true;
          if (!npc.moving) continue;
          expect(model.isBlocked(npc.x, npc.z, 0.1)).toBe(false); // walking, never through walls
        } else if (npc.where.type === 'inn') seen.inn = true;
        else if (npc.where === npc.home && npc.stop > 2) seen.home = true;
        if (npc.where) {
          const { room } = layoutOf(model.seed, npc.where);
          expect(npc.x).toBeGreaterThan(-0.5);
          expect(npc.x).toBeLessThan(room.width - 0.5);
        }
      }
      const seats = model.npcs.filter((n) => n.seat).map((n) => n.seat!.piece);
      expect(new Set(seats).size).toBe(seats.length);
    }
    expect(seen).toEqual({ square: true, inn: true, home: true });
  });

  it('are solid to the hero, who can always step away', () => {
    const model = withVillage();
    const npc = model.npcs[0];
    npc.where = null;
    npc.steps = [{ kind: 'wait', for: 1000 }];
    // Two open tiles side by side on the square: the hero on one, facing the villager on the next.
    const { village } = npc;
    const spots = [];
    for (let dx = -3; dx < 3; dx++) for (let dz = -3; dz <= 3; dz++) spots.push([village.x + dx, village.z + dz]);
    const [x0, z0] = spots.find(([x, z]) => model.isOpenTile(x, z) && model.isOpenTile(x + 1, z))!;
    npc.x = x0 + 0.8;
    npc.z = z0;
    model.teleport(x0, z0);
    for (let t = 0; t < 1; t += 1 / 60) model.update(1, 0, 1 / 60); // walk into them
    expect(npc.x - model.hero.x).toBeGreaterThan(0.2);
    const x = model.hero.x;
    for (let t = 0; t < 0.2; t += 1 / 60) model.update(-1, 0, 1 / 60); // and back away
    expect(model.hero.x).toBeLessThan(x);
  });
});

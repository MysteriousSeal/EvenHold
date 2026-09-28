import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { layoutOf } from '../src/model/interiors/indoors';
import { spawnNpcs } from '../src/model/npcs/npcs';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const withVillage = () => TEST_SEEDS.map((seed) => new GameModel(seed, TEST_MAP_SIZE)).find((m) => m.houses.length > 2 && m.buildings.some((b) => b.kind === 'inn'))!;

describe('villagers', () => {
  it('live one to a house, each in their own, named, naked, the same for a seed', () => {
    const model = withVillage();
    const homes = model.entrances.filter((e) => e.type === 'house');
    const villagers = model.npcs.filter((n) => n.role === 'villager');
    expect(villagers).toHaveLength(homes.length);
    expect(new Set(villagers.map((n) => n.home)).size).toBe(homes.length);
    for (const npc of villagers) {
      expect(npc.name.length).toBeGreaterThan(2);
      expect(npc.equipment).toEqual({});
      expect(npc.where).toBe(npc.home); // at home, to begin with
    }
    const again = new GameModel(model.seed, TEST_MAP_SIZE);
    expect(again.npcs.map((n) => [n.name, n.look])).toEqual(model.npcs.map((n) => [n.name, n.look]));
  });

  it('are the world seed\'s own: the same houses on another seed hold other people', () => {
    const model = withVillage();
    const other = spawnNpcs(model.seed + 1, model.entrances, model.villages);
    const same = spawnNpcs(model.seed, model.entrances, model.villages);
    expect(same.map((n) => [n.name, n.look, n.salt])).toEqual(model.npcs.map((n) => [n.name, n.look, n.salt]));
    const renamed = other.filter((n, i) => n.name !== model.npcs[i].name).length;
    expect(renamed).toBeGreaterThan(model.npcs.length / 2);
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

  it('are solid to each other: one walking past another goes round, not through', () => {
    const model = withVillage();
    const [a, b] = model.npcs;
    // A clear row of three open tiles on the square: one stands in the middle, the other walks along it.
    const { village } = a;
    let row: [number, number] | null = null;
    for (let dx = -3; dx <= 1 && !row; dx++) {
      for (let dz = -3; dz <= 3 && !row; dz++) {
        const [x, z] = [village.x + dx, village.z + dz];
        if ([0, 1, 2].every((i) => model.isOpenTile(x + i, z))) row = [x, z];
      }
    }
    const [x, z] = row!;
    for (const npc of model.npcs) npc.steps = [{ kind: 'wait', for: 1000 }]; // everyone else stays put
    Object.assign(a, { where: null, x: x + 1, z, steps: [{ kind: 'wait', for: 1000 }] });
    Object.assign(b, { where: null, x, z, village, steps: [{ kind: 'go', to: { x: x + 2, z } }, { kind: 'wait', for: 1000 }], path: null });
    model.teleport(village.x + 0.5, village.z + 0.5 + 6); // watching from nearby
    let closest = Infinity;
    for (let t = 0; t < 3; t += 1 / 60) {
      model.update(0, 0, 1 / 60);
      closest = Math.min(closest, Math.hypot(a.x - b.x, a.z - b.z));
    }
    expect(closest).toBeGreaterThan(0.26); // never overlapping (two half-widths: 0.28)
    expect(Math.hypot(b.x - (x + 2), b.z - z)).toBeLessThan(0.1); // and got there
  });

  it('keep two barmaids in every inn: one behind the bar, one serving the tables; no one else goes behind the bar', () => {
    const model = withVillage();
    const inns = model.entrances.filter((e) => e.type === 'inn');
    for (const inn of inns) {
      const staff = model.npcs.filter((n) => n.home === inn && n.role !== 'villager');
      expect(staff.map((n) => n.role).sort()).toEqual(['barkeep', 'server']);
    }
    const inn = inns[0];
    const counter = layoutOf(model.seed, inn).furniture.find((f) => f.kind === 'counter')!;
    const barEnd = counter.z + counter.d - 1;
    model.teleport(inn.x, inn.z);
    model.useDoor(); // watching from inside
    const [barkeep, server] = ['barkeep', 'server'].map((role) => model.npcs.find((n) => n.home === inn && n.role === role)!);
    const serverSpots = new Set<string>();
    for (let t = 0; t < 180; t += 0.1) {
      model.update(0, 0, 0.1);
      expect(barkeep.where).toBe(inn);
      expect(server.where).toBe(inn);
      expect(barkeep.x).toBeLessThan(counter.x); // behind the counter
      expect(barkeep.z).toBeLessThanOrEqual(barEnd + 0.5);
      serverSpots.add(`${Math.round(server.x)},${Math.round(server.z)}`);
      for (const npc of model.npcs) {
        if (npc.where !== inn || npc.role !== 'villager' || npc.seat) continue;
        expect(npc.x < counter.x && npc.z < barEnd + 0.5).toBe(false);
      }
    }
    expect(serverSpots.size).toBeGreaterThan(2); // up and down between the counter and the tables
  });
});

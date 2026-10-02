import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { layoutOf } from '../src/model/interiors/indoors';
import { nameAt, randomName, spawnNpcs } from '../src/model/npcs/npcs';
import { randomLook } from '../src/model/human/humanoid';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

// The first test world (made one at a time, till one has) with a village of a few houses and its inn.
const firstWith = (has: (m: GameModel) => boolean) => {
  for (const seed of TEST_SEEDS) {
    const model = new GameModel(seed, TEST_MAP_SIZE);
    if (has(model)) return model;
  }
  throw new Error('no test world has it');
};
const withVillage = () => firstWith((m) => m.houses.length > 2 && m.buildings.some((b) => b.kind === 'inn'));

describe('villagers', () => {
  it('live one to a house, each in their own (a village\'s herbalist in theirs alone), named, naked, the same for a seed', () => {
    const model = withVillage();
    const homes = model.entrances.filter((e) => e.type === 'house');
    const villagers = model.npcs.filter((n) => n.role === 'villager');
    const herbalists = model.npcs.filter((n) => n.role === 'herbalist');
    expect(villagers.length + herbalists.length).toBe(homes.length);
    expect(new Set([...villagers, ...herbalists].map((n) => n.home)).size).toBe(homes.length); // (no house shared)
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
    const problems: string[] = []; // (every villager, every step: told once, at the end)
    for (let t = 0; t < 600; t += 0.1) {
      model.update(0, 0, 0.1);
      for (const npc of model.npcs) {
        if (npc.where === null) {
          if (Math.max(Math.abs(npc.x - npc.village.x), Math.abs(npc.z - npc.village.z)) <= 3.5) seen.square = true;
          if (!npc.moving) continue;
          if (model.isBlocked(npc.x, npc.z, 0.1)) problems.push(`${npc.name} in a wall at ${npc.x.toFixed(2)},${npc.z.toFixed(2)}`); // walking, never through walls
        } else if (npc.where.type === 'inn') seen.inn = true;
        else if (npc.where === npc.home && npc.stop > 2) seen.home = true;
        if (npc.where) {
          const { room } = layoutOf(model.seed, npc.where);
          if (npc.x <= -0.5 || npc.x >= room.width - 0.5) problems.push(`${npc.name} out of the room at x ${npc.x.toFixed(2)}`);
        }
      }
      for (const inn of model.entrances.filter((e) => e.type === 'inn')) {
        if (model.npcs.filter((n) => n.role === 'villager' && n.where === inn).length > 4) problems.push('an inn crowded'); // never crowded
      }
      const seats = model.npcs.filter((n) => n.seat).map((n) => n.seat!.piece);
      if (new Set(seats).size !== seats.length) problems.push('two on one seat');
    }
    expect(problems.slice(0, 10)).toEqual([]);
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
      expect(staff.map((n) => n.role).sort()).toEqual(['barkeep', 'bouncer', 'server']); // (and the bouncer, on the floor: bouncer.test.ts)
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

  it('name women and men each their own way, from the seed', () => {
    const model = withVillage();
    const villagers = model.npcs.filter((n) => n.role === 'villager');
    expect(villagers.some((n) => n.look.build === 'female')).toBe(true);
    expect(villagers.some((n) => n.look.build === 'male')).toBe(true);
    for (const npc of villagers) {
      expect(npc.name).toBe(nameAt(npc.home.x, npc.home.z, model.seed, npc.look.build)); // their house, the seed, and whether they're a woman
      expect(nameAt(npc.home.x, npc.home.z, model.seed, npc.look.build === 'female' ? 'male' : 'female')).not.toBe(npc.name); // a woman's ending, or a man's
    }
  });

  it('have farmers, who go out and work their field', () => {
    const model = firstWith((m) => m.npcs.some((n) => n.field));
    const farmer = model.npcs.find((n) => n.field)!;
    const field = farmer.field!;
    const inField = () => farmer.where === null && farmer.x > field.x0 - 0.5 && farmer.x < field.x0 + field.width - 0.5 && farmer.z > field.z0 - 0.5 && farmer.z < field.z0 + field.depth - 0.5;
    model.teleport(field.x0 + field.width / 2, field.z0 - 2); // watching from beside it
    let worked = false;
    for (let t = 0; t < 900 && !worked; t += 0.1) {
      model.update(0, 0, 0.1);
      if (farmer.working) {
        expect(inField()).toBe(true); // at work only in their field
        worked = true;
      }
    }
    expect(worked).toBe(true);
    expect(model.npcs.filter((n) => n.field).length).toBeLessThan(model.npcs.filter((n) => n.role === 'villager').length); // some, not all
  });

  it('give the hero a new random look and name each game: men and women, no two alike', () => {
    const looks = Array.from({ length: 200 }, () => randomLook());
    expect(looks.some((l) => l.build === 'female')).toBe(true);
    expect(looks.some((l) => l.build === 'male')).toBe(true);
    expect(looks.filter((l) => l.build === 'female').every((l) => !l.beard)).toBe(true);
    const names = new Set(looks.map((l) => randomName(l.build)));
    expect(names.size).toBeGreaterThan(150);
  });

  it('never stay in the hero: put down on them, they ease off; a door the hero stands in, they wait for', () => {
    const model = withVillage();
    const npc = model.npcs.find((n) => n.role === 'villager')!;
    // Right on top of the hero, outdoors: eased off within a moment.
    const { village } = npc;
    model.teleport(village.x + 2, village.z + 2);
    for (const n of model.npcs) n.steps = [{ kind: 'wait', for: 1000 }];
    Object.assign(npc, { where: null, x: model.hero.x, z: model.hero.z });
    for (let t = 0; t < 1; t += 1 / 60) model.update(0, 0, 1 / 60);
    expect(Math.hypot(npc.x - model.hero.x, npc.z - model.hero.z)).toBeGreaterThanOrEqual(0.27);
    // The hero just inside a house's door: a villager coming in waits.
    const door = npc.home;
    model.teleport(door.x, door.z);
    model.useDoor();
    Object.assign(npc, { where: null, x: door.x, z: door.z, steps: [{ kind: 'enter', entrance: door }, { kind: 'wait', for: 1000 }] });
    for (let t = 0; t < 1; t += 1 / 60) model.update(0, 0, 1 / 60);
    expect(npc.where).toBeNull();
    model.hero.z -= 1.5; // out of the doorway
    for (let t = 0; t < 0.2; t += 1 / 60) model.update(0, 0, 1 / 60);
    expect(npc.where).toBe(door);
  });

  it("don't wait on the hero: standing by the well, no one's held up for long", () => {
    const model = new GameModel(TEST_SEEDS[2], TEST_MAP_SIZE);
    const v = model.villages[0];
    const [x, z] = [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([dx, dz]) => [v.x + dx, v.z + dz]).find(([x, z]) => model.isOpenTile(x, z))!;
    model.teleport(x, z);
    const since = new Map<number, { x: number; z: number; t: number }>();
    let longest = 0;
    for (let t = 0; t < 300; t += 0.05) {
      model.update(0, 0, 0.05);
      for (const n of model.npcs) {
        const s = since.get(n.id);
        // Only while walking outdoors: waiting, or sitting, isn't being held up.
        if (n.where || n.steps[0]?.kind !== 'go' || !s || Math.hypot(s.x - n.x, s.z - n.z) > 0.6) since.set(n.id, { x: n.x, z: n.z, t });
        else longest = Math.max(longest, t - s.t);
      }
    }
    expect(longest).toBeLessThan(10);
  }, 60_000);
});

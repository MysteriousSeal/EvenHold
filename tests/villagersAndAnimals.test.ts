// Villagers on every test seed: where they go (npcPlaces.ts) and how they
// get there (npcWalk.ts); and how animals get about (wildlife/moving.ts, group.ts).
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { benchSeat, claimed, doorTile, fieldSpot, heroOnPiece, roll, settle, squareSpot } from '../src/model/npcs/npcPlaces';
import { easeOffHero, heroOn, place, roomFree, walk } from '../src/model/npcs/npcWalk';
import { layoutOf } from '../src/model/interiors/indoors';
import { distanceTo } from '../src/model/interiors/furniture';
import { squareBenches } from '../src/model/worldgen/benches';
import { VILLAGE_OUTER_RADIUS } from '../src/model/constants';
import { fleeTarget, rollAt, stepToward } from '../src/model/wildlife/moving';
import type { Wildlife } from '../src/model/wildlife/wildlife';
import { TEST_MAP_SIZE, TEST_SEEDS, fresh } from './support/testWorld';

describe.each(TEST_SEEDS.map((s) => [s]))('villagers, seed %i', (seed) => {
  const model = new GameModel(seed, TEST_MAP_SIZE);
  const villagers = model.npcs.filter((n) => n.role === 'villager') // (farmers among them);

  it('go to open ground on their own square', () => {
    for (const npc of villagers) {
      for (let k = 0; k < 3; k++) {
        const spot = squareSpot(npc, model, k);
        if (spot.x === npc.home.x && spot.z === npc.home.z) continue; // (nowhere found: home)
        expect(model.isOpenTile(Math.round(spot.x), Math.round(spot.z))).toBe(true);
        expect(Math.abs(spot.x - npc.village.x)).toBeLessThanOrEqual(VILLAGE_OUTER_RADIUS + 0.5);
        expect(Math.abs(spot.z - npc.village.z)).toBeLessThanOrEqual(VILLAGE_OUTER_RADIUS + 0.5);
      }
    }
  });

  it('work the wheat in a field, never its baled corner', () => {
    for (const npc of villagers) {
      for (const field of model.fields) {
        for (let k = 0; k < 4; k++) {
          const { x, z } = fieldSpot(npc, field, k);
          const inside = x >= field.x0 && x < field.x0 + field.width && z >= field.z0 && z < field.z0 + field.depth;
          expect(inside || (x === field.gate[0] && z === field.gate[1])).toBe(true);
          expect(x === field.corner[0] && z === field.corner[1]).toBe(false);
        }
      }
    }
  });

  it('come in at a door tile each room has free', () => {
    for (const entrance of model.entrances) {
      const at = doorTile(seed, entrance);
      expect(roomFree(seed, entrance)(at.x, at.z)).toBe(true);
    }
  });

  it("keep out from behind the inn's bar, which is the barmaids' (who go where they like)", () => {
    for (const inn of model.entrances.filter((e) => e.type === 'inn')) {
      const counter = layoutOf(seed, inn).furniture.find((f) => f.kind === 'counter')!;
      const behind = { x: counter.x - 0.6, z: counter.z };
      expect(roomFree(seed, inn)(behind.x, behind.z)).toBe(false);
      expect(roomFree(seed, inn, true)(behind.x, behind.z)).toBe(true);
    }
  });

  it('settle at home on a free seat (stepping to it from beside it), or stand somewhere free', () => {
    for (const npc of villagers) {
      npc.where = npc.home;
      const steps = settle(npc, model.npcs, model, 30);
      const free = roomFree(seed, npc.home);
      expect(steps[0].kind).toBe('go');
      const to = (steps[0] as { to: { x: number; z: number } }).to;
      expect(free(to.x, to.z)).toBe(true);
      const last = steps[steps.length - 1];
      expect(['sit', 'wait']).toContain(last.kind);
      if (last.kind === 'sit') expect(distanceTo(last.seat.piece, to.x, to.z)).toBeLessThanOrEqual(0.6); // beside it, to sit down from
      npc.where = null;
    }
  });

  it("take a bench seat on their own village's square, one not taken", () => {
    for (const npc of villagers) {
      const seat = benchSeat(npc, model.npcs, model);
      if (!seat) continue;
      const bench = squareBenches(model).find((b) => b.seats.includes(seat))!;
      expect(model.villages[bench.village]).toBe(npc.village);
      expect(claimed(seat.piece, npc, model.npcs, model, null)).toBe(false);
    }
  });
});

describe('villagers, one at a time', () => {
  it('roll the same at the same point of their routine, afresh at the next', () => {
    const npc = fresh().npcs[0];
    expect(roll(npc, 5)).toBe(roll(npc, 5));
    const first = roll(npc, 5);
    npc.stop++;
    expect(roll(npc, 5)).not.toBe(first);
  });

  it("know a seat's taken by the hero, by another villager, or by one on the way to it", () => {
    const model = fresh();
    const [a, b] = model.npcs;
    const seat = squareBenches(model)[0].seats[0];
    expect(claimed(seat.piece, a, model.npcs, model, null)).toBe(false);
    model.outdoors.seated = { seat, from: { x: seat.x, z: seat.z } };
    expect(heroOnPiece(model, null, seat.piece)).toBe(true);
    expect(claimed(seat.piece, a, model.npcs, model, null)).toBe(true);
    model.outdoors.seated = null;
    b.steps = [{ kind: 'sit', seat, for: 5 }];
    expect(claimed(seat.piece, a, model.npcs, model, null)).toBe(true);
    b.steps = [];
    b.seat = seat;
    expect(claimed(seat.piece, a, model.npcs, model, null)).toBe(true);
    expect(claimed(seat.piece, b, model.npcs, model, null)).toBe(false); // (not by themselves)
  });

  it('are put down on the ground outdoors, on the floor indoors', () => {
    const model = fresh();
    const npc = model.npcs[0];
    npc.where = null;
    place(npc, model, { x: npc.village.x + 2, z: npc.village.z });
    expect(npc.y).toBeCloseTo(model.getGroundY(npc.x, npc.z));
    npc.where = npc.home;
    place(npc, model, { x: 1, z: 1 });
    expect([npc.x, npc.z, npc.y]).toEqual([1, 1, 0]);
  });

  it('walk across open ground to where they are going, and arrive', () => {
    const model = fresh();
    const npc = model.npcs[0];
    Object.assign(npc, { where: null, path: null, waited: 0 });
    const v = npc.village;
    const from = { x: v.x + 1, z: v.z + 3 };
    const to = { x: v.x - 1, z: v.z + 3 };
    if (!model.isOpenTile(from.x, from.z) || !model.isOpenTile(to.x, to.z)) return; // (a seed where that's built on)
    place(npc, model, from);
    model.teleport(v.x + 30, v.z + 30); // the hero well out of the way
    let arrived = false;
    for (let t = 0; t < 20 && !arrived; t += 1 / 30) arrived = walk(npc, model.npcs, model, to, 1 / 30);
    expect(arrived).toBe(true);
    expect(Math.hypot(npc.x - to.x, npc.z - to.z)).toBeLessThan(0.3);
  });

  it('ease off the hero when on top of them, and not otherwise', () => {
    const model = fresh();
    const npc = model.npcs[0];
    Object.assign(npc, { where: null, seat: null });
    const v = npc.village;
    place(npc, model, { x: v.x + 1, z: v.z + 2 });
    model.teleport(v.x + 30, v.z + 30);
    expect(heroOn(model, null, npc.x, npc.z)).toBe(false);
    expect(easeOffHero(npc, model, 0.1)).toBe(false);
    Object.assign(model.hero, { x: npc.x + 0.05, z: npc.z });
    expect(heroOn(model, null, npc.x, npc.z)).toBe(true);
    const before = Math.hypot(npc.x - model.hero.x, npc.z - model.hero.z);
    expect(easeOffHero(npc, model, 0.1)).toBe(true);
    expect(Math.hypot(npc.x - model.hero.x, npc.z - model.hero.z)).toBeGreaterThanOrEqual(before);
  });
});

describe('animals getting about', () => {
  const animal = (x = 5, z = 5): Wildlife => ({ id: 1, kind: 'deer', variant: 'doe', x, z, y: 0, heading: 0, homeX: x, homeZ: z, pack: [], mother: null, target: null, restFor: 0, dabble: null, fleeing: false, speed: 0 });
  const open = () => true;

  it('step toward a spot at their pace, facing the way they go', () => {
    const deer = animal();
    const moved = stepToward(deer, open, 8, 5, 1, 0.5);
    expect(moved).toBeCloseTo(0.5);
    expect(deer.x).toBeCloseTo(5.5);
    expect(deer.heading).toBeCloseTo(Math.PI / 2);
  });

  it('stop right on it, never past', () => {
    const deer = animal();
    stepToward(deer, open, 5.2, 5, 10, 1);
    expect(deer.x).toBeCloseTo(5.2);
    expect(stepToward(deer, open, 5.2, 5, 10, 1)).toBe(0);
  });

  it('slide along what they cannot cross, axis by axis', () => {
    const deer = animal();
    const wallEast = (x: number) => x <= 5.1;
    stepToward(deer, wallEast, 8, 8, 1, 1);
    expect(deer.x).toBeCloseTo(5); // blocked going east…
    expect(deer.z).toBeGreaterThan(5.5); // …still going north
  });

  it('stand on the ground where given one (afloat, not)', () => {
    const deer = animal();
    stepToward(deer, open, 9, 5, 1, 1, () => 0.75);
    expect(deer.y).toBe(0.75);
    const duck = animal();
    stepToward(duck, open, 9, 5, 1, 1);
    expect(duck.y).toBe(0);
  });

  it('flee straight away from the hero where there is room, else turn, else nowhere', () => {
    const deer = animal();
    const spot = fleeTarget(deer, { x: 5, z: 3 }, 4, open)!;
    expect(spot.z).toBeGreaterThan(8); // away, the other side
    const eastOnly = (_x: number, z: number) => z <= 5.5;
    const turned = fleeTarget(deer, { x: 5, z: 3 }, 4, eastOnly)!;
    expect(turned).not.toBeNull();
    expect(turned.z).toBeLessThanOrEqual(5.5);
    expect(fleeTarget(deer, { x: 5, z: 3 }, 4, () => false)).toBeNull();
  });

  it('roll the same where they stand, differently elsewhere', () => {
    const [a, b] = [animal(), animal(7, 7)];
    expect(rollAt(a, 3)).toBe(rollAt(animal(), 3));
    expect(rollAt(a, 3)).not.toBe(rollAt(b, 3));
  });
});

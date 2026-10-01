import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { roomFor } from '../src/model/interiors/interiors';
import type { Furniture } from '../src/model/interiors/furniture';
import { FRAME, TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const withHouses = () => TEST_SEEDS.map((seed) => new GameModel(seed, TEST_MAP_SIZE)).find((m) => m.houses.length > 0)!;

describe('interiors', () => {
  it('gives every house, inn and smithy a door, and each door the same room for a given seed', () => {
    const model = withHouses();
    const doors = model.entrances.filter((e) => e.type !== 'crypt'); // (and a crypt's way down in each ruin: crypt.test.ts)
    expect(doors).toHaveLength(model.houses.length + model.buildings.length);
    for (const entrance of doors) {
      const room = roomFor(model.seed, entrance);
      expect(roomFor(model.seed, entrance)).toEqual(room);
      expect(room.door).toBeGreaterThanOrEqual(0);
      expect(room.door).toBeLessThan(room.width);
    }
    const rooms = new Set(doors.map((e) => JSON.stringify(roomFor(model.seed, e))));
    expect(rooms.size).toBeGreaterThan(1); // not all alike
  });

  it('goes in from the door spot, stays walled in, even at the doorway, and leaves with the door (E)', () => {
    const model = withHouses();
    const door = model.entrances[0];
    model.teleport(door.x, door.z);
    expect(model.doorInReach).toBe(door);
    expect(model.useDoor()).toBe(true);
    const { room } = model.inside!;
    // Walk into the far wall: stopped inside the room.
    for (let t = 0; t < 5; t += FRAME) model.update(0, -1, FRAME);
    expect(model.inside).not.toBeNull();
    expect(model.hero.z).toBeGreaterThan(-0.5);
    // Walking into the doorway: stopped there, the door in reach, still in.
    model.hero.x = room.door;
    for (let t = 0; t < 5; t += FRAME) model.update(0, 1, FRAME);
    expect(model.inside).not.toBeNull();
    expect(model.doorInReach).toBe(door);
    // Out with the door.
    expect(model.useDoor()).toBe(true);
    expect(model.inside).toBeNull();
    expect(Math.hypot(model.hero.x - door.x, model.hero.z - door.z)).toBeLessThan(0.01);
  });

  it('furnishes each room the same every time, never in the way of the door, nothing overlapping', async () => {
    const { furnish } = await import('../src/model/interiors/furnish');
    const model = withHouses();
    for (const entrance of model.entrances.filter((e) => e.type !== 'crypt')) {
      const room = roomFor(model.seed, entrance);
      const items = furnish(model.seed, entrance, room);
      expect(furnish(model.seed, entrance, room)).toEqual(items);
      expect(items.length).toBeGreaterThan(2);
      const taken = new Set<string>();
      for (const item of items.filter((i) => i.solid)) {
        for (let x = item.x; x < item.x + item.w; x++) {
          for (let z = item.z; z < item.z + item.d; z++) {
            expect(x === room.door && z > 0, `${item.kind} on the door's way`).toBe(false); // (its end, at the back wall, in no one's way)
            expect(x >= 0 && z >= 0 && x < room.width && z < room.depth).toBe(true);
            expect(taken.has(`${x},${z}`), `${item.kind} overlaps`).toBe(false);
            taken.add(`${x},${z}`);
          }
        }
      }
    }
  });

  it('lays out every inn with at least three tables', async () => {
    const { furnish } = await import('../src/model/interiors/furnish');
    let inns = 0;
    for (const seed of TEST_SEEDS) {
      const model = new GameModel(seed, TEST_MAP_SIZE);
      for (const entrance of model.entrances.filter((e) => e.type === 'inn')) {
        inns++;
        const items = furnish(model.seed, entrance, roomFor(model.seed, entrance));
        expect(items.filter((i) => i.kind === 'tavernTable').length).toBeGreaterThanOrEqual(3);
      }
    }
    expect(inns).toBeGreaterThan(0);
  });

  it('lets the hero past a chair behind its back, but not through it', async () => {
    const { bumpsFurniture } = await import('../src/model/interiors/furniture');
    const r = 0.25; // about the hero's half-width indoors
    // A chair on tile (3, 3) facing its table at (2, 3): it fills the half toward the table.
    const items: Furniture[] = [{ kind: 'chair', x: 3, z: 3, w: 1, d: 1, wall: 'none', solid: true, facing: [-1, 0] }];
    expect(bumpsFurniture(items, 2.9, 3, r)).toBe(true); // into the seat
    expect(bumpsFurniture(items, 3.5, 3, r)).toBe(false); // past its back, where it's not drawn
  });

  it('sits on a chair by it, facing its table, and gets up by walking off', () => {
    const model = withHouses();
    const inn = model.entrances.find((e) => e.type === 'inn')!;
    model.teleport(inn.x, inn.z);
    model.useDoor();
    const chair = model.inside!.furniture.find((f) => f.kind === 'chair')!;
    model.hero.x = chair.x;
    model.hero.z = chair.z + 0.6;
    const seat = model.seatInReach!;
    expect(seat).not.toBeNull();
    expect(model.sitOrStand()).toBe(true);
    expect(model.inside!.seated?.seat.piece).toBe(seat.piece);
    expect([model.hero.x, model.hero.z, model.hero.y]).toEqual([seat.x, seat.z, seat.y]);
    expect(model.startAttack()).toBe(false); // no swinging from a chair
    model.update(1, 0, FRAME); // walking gets them up, back where they stood
    expect(model.inside!.seated).toBeNull();
    expect(model.hero.y).toBe(0);
    expect(Math.hypot(model.hero.x - chair.x, model.hero.z - chair.z - 0.6)).toBeLessThan(0.1);
  });

  it('lies down in bed, head on the pillow by the headboard, and gets up again', () => {
    const model = withHouses();
    const house = model.entrances.find((e) => e.type === 'house')!;
    model.teleport(house.x, house.z);
    model.useDoor();
    const bed = model.inside!.furniture.find((f) => f.kind === 'bed')!;
    model.hero.x = bed.x + 0.8; // by its open side
    model.hero.z = bed.z + 0.5;
    const from = { x: model.hero.x, z: model.hero.z };
    expect(model.seatInReach?.lying).toBe(true);
    expect(model.sitOrStand()).toBe(true);
    expect(model.hero.x).toBe(bed.x); // down the middle of the bed
    expect(model.hero.facing).toBe(0); // feet toward +z, away from the headboard
    expect(model.sitOrStand()).toBe(true); // E again: up
    expect(model.inside!.seated).toBeNull();
    expect(model.hero).toMatchObject({ ...from, y: 0 });
  });
});

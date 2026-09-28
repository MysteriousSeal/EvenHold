import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { roomFor } from '../src/model/interiors/interiors';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const FRAME = 1 / 60;
const withHouses = () => TEST_SEEDS.map((seed) => new GameModel(seed, TEST_MAP_SIZE)).find((m) => m.houses.length > 0)!;

describe('interiors', () => {
  it('gives every house, inn and smithy a door, and each door the same room for a given seed', () => {
    const model = withHouses();
    expect(model.entrances).toHaveLength(model.houses.length + model.buildings.length);
    for (const entrance of model.entrances) {
      const room = roomFor(model.seed, entrance);
      expect(roomFor(model.seed, entrance)).toEqual(room);
      expect(room.door).toBeGreaterThanOrEqual(0);
      expect(room.door).toBeLessThan(room.width);
    }
    const rooms = new Set(model.entrances.map((e) => JSON.stringify(roomFor(model.seed, e))));
    expect(rooms.size).toBeGreaterThan(1); // not all alike
  });

  it('goes in from the door spot, stays walled in, and walks back out the door', () => {
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
    // Back to the doorway and out.
    model.hero.x = room.door;
    for (let t = 0; t < 5 && model.inside; t += FRAME) model.update(0, 1, FRAME);
    expect(model.inside).toBeNull();
    expect(Math.hypot(model.hero.x - door.x, model.hero.z - door.z)).toBeLessThan(0.01);
  });
});

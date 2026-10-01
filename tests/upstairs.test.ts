import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { layoutOf } from '../src/model/interiors/indoors';
import { bumpsFurniture, distanceTo, type Furniture } from '../src/model/interiors/furniture';
import { HALL, innerWalls, roomsOff, stairsInReach, upstairsInside } from '../src/model/interiors/upstairs';
import { HERO_RADIUS, INDOOR_SCALE } from '../src/model/constants';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const r = HERO_RADIUS * INDOOR_SCALE;

// Every inn's floor above, over the test worlds.
function floorsAbove() {
  return TEST_SEEDS.flatMap((seed) => {
    const model = new GameModel(seed, TEST_MAP_SIZE);
    return model.entrances
      .filter((e) => e.type === 'inn')
      .map((inn) => {
        const { room, furniture } = layoutOf(seed, inn);
        const stairs = furniture.find((f) => f.kind === 'stairs')!;
        return { seed, inn, room, stairs, up: upstairsInside(inn, room, stairs, seed) };
      });
  });
}

describe('the floor above', () => {
  const floors = floorsAbove();

  it('is there in every inn, the stairs in its front corner, the stairwell over them', () => {
    expect(floors.length).toBeGreaterThan(0);
    for (const { room, stairs, up } of floors) {
      expect([stairs.x, stairs.z]).toEqual([0, room.depth - 1]);
      const well = up.furniture.find((f) => f.kind === 'stairwell')!;
      expect([well.x, well.z, well.w, well.d]).toEqual([stairs.x, stairs.z, stairs.w, stairs.d]);
    }
  });

  it('has a hallway along the left and back walls, walled off from the rooms, nothing standing in it', () => {
    for (const { room, up } of floors) {
      const walls = up.furniture.filter((f) => f.kind === 'hallWall' || f.kind === 'hallDoor');
      for (let z = HALL; z < room.depth; z++) expect(walls.some((f) => f.wall === 'left' && f.x === HALL && z >= f.z && z < f.z + f.d), `left wall at z ${z}`).toBe(true);
      for (let x = HALL; x < room.width; x++) expect(walls.some((f) => f.wall === 'back' && f.z === HALL && f.x === x), `back wall at x ${x}`).toBe(true);
      // The hallway's floor free to walk (but for the stairwell).
      for (let x = 0; x < room.width; x++) for (let z = 0; z < room.depth; z++) {
        if (x >= HALL && z >= HALL) continue;
        const f = up.furniture.find((p) => p.solid && p.kind !== 'stairwell' && distanceTo(p, x, z) === 0 && p.kind !== 'hallWall' && p.kind !== 'hallDoor');
        expect(f, `${f?.kind} in the hallway at ${x},${z}`).toBeUndefined();
      }
    }
  });

  it('has a door into each back room off the hallway, and one into the front room, out of reach of the stairs', () => {
    for (const { up } of floors) {
      const doors = up.furniture.filter((f) => f.kind === 'hallDoor');
      expect(doors.filter((d) => d.wall === 'back').length).toBeGreaterThan(0);
      const front = doors.find((d) => d.wall === 'left')!;
      expect(front).toBeDefined();
      const before = { x: front.x - 0.8, z: front.z - 0.5 + front.d / 2 }; // in the hallway, before it
      expect(stairsInReach(up, { ...before, y: 0 } as never)).toBe(false);
    }
  });

  it('shuts its doors: closed, they block; open, the doorway lets the hero through', () => {
    for (const { up } of floors) {
      const door = up.furniture.find((f) => f.kind === 'hallDoor' && f.wall === 'back')!;
      const mid = { x: door.x - 0.5 + door.w / 2, z: door.z - 0.4 };
      expect(bumpsFurniture(up.furniture, mid.x, mid.z, r)).toBe(true);
      door.open = true;
      expect(bumpsFurniture(up.furniture, mid.x, mid.z, r)).toBe(false);
      door.open = false;
    }
  });

  it('has a bed in each room, a nightstand by each, and the bigger rooms a double, a wardrobe, a picture and a tub', () => {
    for (const { up } of floors) {
      const beds = up.furniture.filter((f) => f.kind === 'roomBed' || f.kind === 'doubleBed');
      const stands = up.furniture.filter((f) => f.kind === 'nightstand');
      expect(beds.length).toBeGreaterThan(1);
      expect(stands.length).toBe(beds.length);
      for (const bed of beds) expect(stands.some((s) => Math.abs(s.x - bed.x) <= bed.w && Math.abs(s.z - bed.z) <= bed.d + 1), `a nightstand by the ${bed.kind}`).toBe(true);
      const doubles = beds.filter((b) => b.kind === 'doubleBed').length;
      for (const kind of ['wardrobe', 'framedPicture', 'bathtub'] as const) expect(up.furniture.filter((f) => f.kind === kind).length).toBe(doubles);
      expect(beds.every((b) => typeof b.cloth === 'number' && b.cloth >= 0 && b.cloth < 4)).toBe(true);
    }
  });

  it('has nothing overlapping, and lanterns along the hallway every fourth tile', () => {
    for (const { up } of floors) {
      const taken = new Map<string, string>();
      for (const f of up.furniture.filter((p) => p.solid && p.kind !== 'hallWall' && p.kind !== 'hallDoor')) {
        for (let x = f.x; x < f.x + f.w; x++) for (let z = f.z; z < f.z + f.d; z++) {
          expect(taken.get(`${x},${z}`), `${f.kind} on ${taken.get(`${x},${z}`)} at ${x},${z}`).toBeUndefined();
          taken.set(`${x},${z}`, f.kind);
        }
      }
      const lanterns = up.furniture.filter((f) => f.kind === 'wallLantern');
      const back = lanterns.filter((l) => l.wall === 'back').map((l) => l.x).sort((a, b) => a - b);
      for (let i = 1; i < back.length; i++) expect(back[i] - back[i - 1]).toBe(4);
    }
  });

  it('raises its inner walls, and hangs its pictures, as the walls option says', () => {
    const { up } = floors[0];
    const tallable = (f: Furniture) => f.kind === 'hallWall' || f.kind === 'hallDoor' || f.kind === 'framedPicture';
    expect(up.furniture.filter(tallable).every((f) => !f.tall)).toBe(true);
    innerWalls(up.furniture, true);
    expect(up.furniture.filter(tallable).every((f) => f.tall)).toBe(true);
    expect(up.furniture.filter((f) => !tallable(f)).some((f) => f.tall)).toBe(false);
    innerWalls(up.furniture, false);
  });

  it('has exactly one door into each room, in every inn', () => {
    for (const { seed, room, up } of floors) {
      const rooms = roomsOff(up.furniture, room);
      expect(rooms.flatMap((r) => r.tiles).length).toBe((room.width - HALL) * (room.depth - HALL)); // (every tile past the hallway in one)
      expect(rooms.length, `seed ${seed}`).toBeGreaterThan(1);
      expect(rooms.map((r) => r.doors.length), `seed ${seed}: doors into each room`).toEqual(rooms.map(() => 1));
    }
  });

  it('is laid out the same for the same inn every time', () => {
    const { inn, room, stairs, seed } = floors[0];
    expect(upstairsInside(inn, room, stairs, seed).furniture).toEqual(upstairsInside(inn, room, stairs, seed).furniture);
  });
});

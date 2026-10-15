import { describe, expect, it } from 'vitest';
import { goesUnder } from '../src/model/dungeons/dungeonTypes';
import { GameModel } from '../src/model/GameModel';
import { furnish } from '../src/model/interiors/furnish';
import { roomFor, type BuildingType, type Entrance, type Room } from '../src/model/interiors/interiors';
import { distanceTo, type Furniture, type FurnitureKind } from '../src/model/interiors/furniture';
import { layoutOf } from '../src/model/interiors/indoors';
import { upstairsInside } from '../src/model/interiors/upstairs';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';
import { isCottage } from '../src/model/homestead/cottage';

// Every building's room across the test worlds, furnished.
const rooms: Array<{ seed: number; entrance: Entrance; room: Room; furniture: Furniture[] }> = TEST_SEEDS.flatMap((seed) => {
  const model = new GameModel(seed, TEST_MAP_SIZE);
  return model.entrances.filter((e) => !goesUnder(e)).map((entrance) => { // (buildings: a dungeon's its own, crypt.test.ts, caveLayout.test.ts)
    const room = roomFor(seed, entrance);
    return { seed, entrance, room, furniture: furnish(seed, entrance, room) };
  });
});

// Tiles taken by solid pieces (overlaps reported).
function tilesOf(furniture: readonly Furniture[], skip: (f: Furniture) => boolean = () => false): { taken: Set<string>; overlaps: string[] } {
  const taken = new Set<string>();
  const overlaps: string[] = [];
  for (const f of furniture.filter((p) => p.solid && !skip(p))) {
    for (let x = f.x; x < f.x + f.w; x++) for (let z = f.z; z < f.z + f.d; z++) {
      if (taken.has(`${x},${z}`)) overlaps.push(`${f.kind} at ${x},${z}`);
      taken.add(`${x},${z}`);
    }
  }
  return { taken, overlaps };
}

// Free floor no one could walk to from the doorway.
function walledIn(room: Room, taken: Set<string>): string[] {
  const seen = new Set<string>();
  const todo: Array<[number, number]> = [[room.door, room.depth - 1]];
  while (todo.length > 0) {
    const [x, z] = todo.pop()!;
    const k = `${x},${z}`;
    if (x < 0 || z < 0 || x >= room.width || z >= room.depth || seen.has(k) || taken.has(k)) continue;
    seen.add(k);
    todo.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
  }
  const shut: string[] = [];
  for (let x = 0; x < room.width; x++) for (let z = 0; z < room.depth; z++) if (!taken.has(`${x},${z}`) && !seen.has(`${x},${z}`)) shut.push(`${x},${z}`);
  return shut;
}

const REQUIRED: Record<BuildingType, FurnitureKind[]> = {
  house: ['bed'],
  inn: ['counter', 'keg', 'stairs', 'hearth', 'barStool', 'tavernTable'],
  smithy: ['forge', 'bellows', 'anvil', 'grindstone', 'trough', 'smithCounter', 'rack', 'coal', 'barrel', 'armorStand', 'weaponWall', 'toolBoard'],
  cathedral: ['altar', 'pillar', 'pew', 'candleStand', 'lectern', 'reliquaryStair', 'doubleBed'], // (none in a test world: cathedralTown.test.ts)
};

describe('every room in the test worlds', () => {
  it('covers homes, inns and smithies', () => {
    for (const type of ['house', 'inn', 'smithy'] as const) expect(rooms.some((r) => r.entrance.type === type)).toBe(true);
  });

  it('is furnished the same every time, with all its kind of building needs', () => {
    for (const { seed, entrance, room, furniture } of rooms) {
      expect(furnish(seed, entrance, room)).toEqual(furniture);
      if (isCottage(entrance)) continue; // (a cottage for sale or the hero's: its bed and all built only as they buy them, homestead/cottage.ts)
      for (const kind of REQUIRED[entrance.type as BuildingType]) expect(furniture.some((f) => f.kind === kind), `${entrance.type} (seed ${seed}) without a ${kind}`).toBe(true);
    }
  });

  it('has nothing overlapping, nothing out of the room, nothing on the way in', () => {
    for (const { seed, entrance, room, furniture } of rooms) {
      const { overlaps } = tilesOf(furniture);
      expect(overlaps, `${entrance.type} (seed ${seed})`).toEqual([]);
      for (const f of furniture.filter((p) => p.solid)) {
        expect(f.x >= 0 && f.z >= 0 && f.x + f.w <= room.width && f.z + f.d <= room.depth, `${f.kind} out of the room`).toBe(true);
        for (let x = f.x; x < f.x + f.w; x++) for (let z = f.z; z < f.z + f.d; z++) expect(x === room.door && z > 0, `${f.kind} on the way in`).toBe(false);
      }
    }
  });

  it('has no floor walled off from the door (a home, the smithy, the inn): its bed and every seat walked to', () => {
    for (const { seed, entrance, room, furniture } of rooms) {
      expect(walledIn(room, tilesOf(furniture).taken), `${entrance.type} (seed ${seed})`).toEqual([]);
    }
  });

  it('gives every smithy its work in reach: a free tile before its forge, anvil, grindstone and bench walked to from the door, the smith his own behind the anvil and his counter, all of it (and the door) out of his counter\'s reach', () => {
    const smithies = rooms.filter((r) => r.entrance.type === 'smithy');
    expect(smithies.length).toBeGreaterThan(0);
    for (const { seed, room, furniture } of smithies) {
      const { taken } = tilesOf(furniture);
      const seen = new Set<string>();
      const todo: Array<[number, number]> = [[room.door, room.depth - 1]];
      while (todo.length > 0) {
        const [x, z] = todo.pop()!;
        const k = `${x},${z}`;
        if (x < 0 || z < 0 || x >= room.width || z >= room.depth || seen.has(k) || taken.has(k)) continue;
        seen.add(k);
        todo.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
      }
      const counter = furniture.find((f) => f.kind === 'smithCounter')!;
      const behindCounter = (x: number, z: number) => z === counter.z - 1 && x >= counter.x && x < counter.x + counter.w;
      for (const f of furniture.filter((p) => ['forge', 'anvil', 'grindstone', 'salvageBench'].includes(p.kind))) {
        const front = f.kind === 'forge' ? [f.x, 1] : [f.x, f.z + f.d];
        const at = `smithy (seed ${seed}) ${f.kind} at ${f.x},${f.z}`;
        expect(seen.has(front.join(',')), `${at}: its front walked to`).toBe(true);
        expect(behindCounter(front[0], front[1]), `${at}: its front behind the counter`).toBe(false);
        if (f.kind === 'anvil' || f.kind === 'salvageBench') expect(distanceTo(counter, front[0], front[1]), `${at}: its front by the counter`).toBeGreaterThanOrEqual(2.5);
        if (f.kind === 'anvil') expect(seen.has(`${f.x},${f.z - 1}`), `${at}: the smith's tile behind it`).toBe(true);
      }
      expect(distanceTo(counter, room.door, room.depth - 1), `smithy (seed ${seed}): the counter by the door`).toBeGreaterThanOrEqual(2.5);
      for (let x = counter.x; x < counter.x + counter.w; x++) expect(seen.has(`${x},${counter.z - 1}`), `smithy (seed ${seed}): the smith's row behind his counter walked to`).toBe(true);
    }
  });

  it("has, over every inn, a floor above with nothing overlapping and a nightstand to every bed", () => {
    for (const { seed, entrance, room } of rooms.filter((r) => r.entrance.type === 'inn')) {
      const stairs = layoutOf(seed, entrance).furniture.find((f) => f.kind === 'stairs')!;
      const up = upstairsInside(entrance, room, stairs, seed).furniture;
      expect(tilesOf(up, (f) => f.kind === 'hallWall' || f.kind === 'hallDoor').overlaps, `inn (seed ${seed})`).toEqual([]);
      const beds = up.filter((f) => f.kind === 'roomBed' || f.kind === 'doubleBed').length;
      expect(up.filter((f) => f.kind === 'nightstand').length).toBe(beds);
    }
  });
});

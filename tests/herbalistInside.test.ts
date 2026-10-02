// A herbalist's house inside (herbalist/herbalistLayout.ts, herbalistWork.ts,
// view/interior/herbalistVoxels.ts): roomier than a house, as rustic as the
// hut outside (earth and rushes, daub over fieldstone), their shop and
// workroom and home in one (the counter, the hearth and its cauldron, the
// worktable, potions, herbs drying, their bed), the fronts they work from
// kept free; and the herbalist at their round, never stuck or wobbling,
// behind the counter when the hero's at it, standing still.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { layoutOf } from '../src/model/interiors/indoors';
import { buildRoomVoxels, ROOM_PALETTE } from '../src/view/interior/roomVoxels';
import { roomPlanner } from '../src/model/interiors/roomPlanner';
import { furnishHerbalist } from '../src/model/herbalist/herbalistLayout';
import type { Entrance, Room } from '../src/model/interiors/interiors';
import type { Furniture } from '../src/model/interiors/furniture';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const HERBALIST_KINDS = ['cauldron', 'herbCounter', 'herbTable', 'dryingRack', 'potionShelf'];
const worlds = TEST_SEEDS.map((seed) => new GameModel(seed, TEST_MAP_SIZE));
const herbalists = worlds.flatMap((m) => m.npcs.filter((n) => n.role === 'herbalist').map((h) => ({ m, h })));

describe("a herbalist's house inside", () => {
  it('roomy and rustic; the counter, the hearth and its cauldron, the worktable; nothing of theirs in other houses', () => {
    expect(herbalists.length).toBeGreaterThan(0);
    for (const { m, h } of herbalists) {
      const { room, furniture } = layoutOf(m.seed, h.home);
      expect([room.width, room.depth]).toEqual([7, 6]); // (just big enough: not an empty hall)
      expect([room.floor, room.wall]).toEqual(['earth', 'daub']);
      for (const kind of ['herbCounter', 'hearth', 'cauldron', 'herbTable']) expect(furniture.some((f) => f.kind === kind), kind).toBe(true);
      const bed = furniture.find((f) => f.kind === 'bed');
      expect(bed && [bed.x, bed.z, bed.wall], 'the bed: in the back corner, its head to the back wall').toEqual([0, 0, 'left']);
    }
    const m = worlds[0];
    const homes = new Set(m.npcs.filter((n) => n.role === 'herbalist').map((n) => n.home));
    for (const house of m.entrances.filter((e) => e.type === 'house' && !homes.has(e)).slice(0, 20)) {
      const { room, furniture } = layoutOf(m.seed, house);
      expect(furniture.some((f) => HERBALIST_KINDS.includes(f.kind))).toBe(false);
      expect(room.floor === 'earth' || room.wall === 'daub').toBe(false);
    }
  });

  it('the fronts they work from free of anything solid', () => {
    for (const { m, h } of herbalists) {
      const { furniture } = layoutOf(m.seed, h.home);
      for (const piece of furniture.filter((f) => ['cauldron', 'herbTable', 'dryingRack', 'potionShelf'].includes(f.kind))) {
        const fronts = piece.wall === 'left' ? Array.from({ length: piece.d }, (_, i) => [piece.x + piece.w, piece.z + i]) : Array.from({ length: piece.w }, (_, i) => [piece.x + i, piece.z + piece.d]);
        for (const [x, z] of fronts) {
          const blocker = furniture.find((f) => f.solid && x >= f.x && x < f.x + f.w && z >= f.z && z < f.z + f.d);
          expect(blocker?.kind, `${piece.kind}'s front`).toBeUndefined();
        }
      }
    }
  });

  it('drawn: every piece of theirs, on earth and daub', () => {
    const { m, h } = herbalists[0];
    const { room, furniture } = layoutOf(m.seed, h.home);
    const grid = buildRoomVoxels(room, furniture);
    const used = new Set(grid.cells);
    for (const hex of [0x7a6248, 0x8a7356]) expect(used.has(ROOM_PALETTE.indexOf(hex) + 1), hex.toString(16)).toBe(true); // (earth, daub)
    // In relief, as the crypts are: rushes standing up off the floor, a voxel up; plants hung high on the walls.
    const [sx, sy] = grid.size;
    const rush = ROOM_PALETTE.indexOf(0xb89a58) + 1;
    const layer = (y: number) => grid.cells.filter((c, i) => Math.floor(i / sx) % sy === y && c === rush).length;
    expect(layer(1)).toBeGreaterThan(0);
    const high = grid.cells.filter((c, i) => Math.floor(i / sx) % sy >= 26 && c === rush).length; // (the ties, up under the beam)
    expect(high).toBeGreaterThan(0);
  });

  it('at their round, never stuck or wobbling; at the counter when the hero is, standing still', () => {
    for (const { m, h } of herbalists.slice(0, 6)) {
      m.teleport(h.home.x, h.home.z);
      m.useDoor();
      const trail: Array<{ x: number; z: number; moving: boolean }> = [];
      for (let t = 0; t < 30; t += 1 / 30) {
        m.update(0, 0, 1 / 30);
        trail.push({ x: h.x, z: h.z, moving: h.moving });
        const a = trail[trail.length - 16];
        if (a && trail.slice(-15).every((p) => p.moving)) expect(Math.hypot(h.x - a.x, h.z - a.z), 'moving, getting nowhere').toBeGreaterThan(0.1);
      }
      const counter = layoutOf(m.seed, h.home).furniture.find((f) => f.kind === 'herbCounter')!;
      [m.hero.x, m.hero.z] = [counter.x + 0.5, counter.z + 1];
      for (let t = 0; t < 8; t += 1 / 30) m.update(0, 0, 1 / 30);
      expect(h.z).toBeLessThan(counter.z); // (behind it)
      const [x, z] = [h.x, h.z];
      for (let t = 0; t < 2; t += 1 / 30) m.update(0, 0, 1 / 30);
      expect(Math.hypot(h.x - x, h.z - z)).toBeLessThan(0.01); // (still)
      m.useDoor();
    }
  });
});

// Many herbalists' rooms, laid out as theirs are (7 x 6), the door at each place it can be: every piece there, and
// every one reachable from the door, its working front too.
describe("every herbalist's room, whatever its roll and door", () => {
  const ALL = ['herbCounter', 'bed', 'hearth', 'cauldron', 'dryingRack', 'potionShelf', 'herbTable'];
  const rooms: Array<{ room: Room; items: Furniture[] }> = [];
  for (let i = 0; i < 200; i++) {
    const entrance: Entrance = { type: 'house', x: 10 + i * 3.7, z: 20 + (i % 13) * 5.1, outX: 0, outZ: 1 };
    for (const door of [2, 3, 4]) {
      const room: Room = { width: 7, depth: 6, door, floor: 'earth', wall: 'daub' };
      const plan = roomPlanner(i * 7 + 3, entrance, room);
      furnishHerbalist(plan, room, i, entrance);
      rooms.push({ room, items: plan.items });
    }
  }
  // The floor walked to from the door, round what's solid.
  const reached = (room: Room, items: readonly Furniture[]) => {
    const solid = new Set<string>();
    for (const f of items) if (f.solid) for (let x = f.x; x < f.x + f.w; x++) for (let z = f.z; z < f.z + f.d; z++) solid.add(`${x},${z}`);
    const seen = new Set([`${room.door},${room.depth - 1}`]);
    const queue = [[room.door, room.depth - 1]];
    while (queue.length) {
      const [x, z] = queue.pop()!;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const [a, b] = [x + dx, z + dz];
        if (a < 0 || b < 0 || a >= room.width || b >= room.depth || solid.has(`${a},${b}`) || seen.has(`${a},${b}`)) continue;
        seen.add(`${a},${b}`);
        queue.push([a, b]);
      }
    }
    return seen;
  };

  it('every piece there, in every room', () => {
    for (const { items } of rooms) for (const kind of ALL) expect(items.some((f) => f.kind === kind), kind).toBe(true);
  });

  it('every piece reachable from the door (a floor tile beside it walked to), and the fronts they work from', () => {
    for (const { room, items } of rooms) {
      const seen = reached(room, items);
      for (const f of items.filter((p) => p.solid && p.kind !== 'barrel')) {
        const beside: string[] = [];
        for (let x = f.x; x < f.x + f.w; x++) beside.push(`${x},${f.z - 1}`, `${x},${f.z + f.d}`);
        for (let z = f.z; z < f.z + f.d; z++) beside.push(`${f.x - 1},${z}`, `${f.x + f.w},${z}`);
        expect(beside.some((t) => seen.has(t)), `${f.kind} at ${f.x},${f.z} (door ${room.door})`).toBe(true);
      }
      for (const f of items.filter((p) => ['cauldron', 'herbTable', 'dryingRack', 'potionShelf'].includes(p.kind))) {
        const front = f.wall === 'left' ? `${f.x + f.w},${f.z}` : `${f.x},${f.z + f.d}`;
        expect(seen.has(front), `${f.kind}'s front (door ${room.door})`).toBe(true);
      }
      expect(seen.has(`${items.find((f) => f.kind === 'herbCounter')!.x},${items.find((f) => f.kind === 'herbCounter')!.z + 1}`), 'before the counter').toBe(true);
    }
  });
});

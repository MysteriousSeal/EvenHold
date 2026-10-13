// @vitest-environment happy-dom
// Where a painting hangs (model/spells/hung.ts), in every building of every test world: each room filled with
// paintings till no more are taken (its own people, and villagers brought in, stood all over its floor), and every
// one of them looked at. The wall it's on is one of that room's two full walls, on a tile of that room's; nothing
// that stands against a wall or hangs on one is there, nor the stairs; no two share a stretch; the last one refused
// only when no stretch is free. They're seen on their own floor only, and are where they were after the hero's gone
// out and come back, and after a save and a load. And its size against the room's (view/meshes/turned/painting.ts,
// drawn at INDOOR_SCALE): no wider than the tile of wall it has.
import { describe, expect, it } from 'vitest';
import { goIn, reloaded } from './support/charmStage';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';
import { GameModel } from '../src/model/GameModel';
import { INDOOR_SCALE } from '../src/model/constants';
import { goesUnder } from '../src/model/dungeons/dungeonTypes';
import { stairsOf, takeStairs } from '../src/model/interiors/upstairs';
import { HUNG_FACING, hungAt, soundHung, type Hung } from '../src/model/spells/hung';
import { placeOf } from '../src/model/spells/turned';
import { HumanRig } from '../src/view/meshes/human/humanRig';
import { paintingOf } from '../src/view/meshes/turned/painting';

const key = (h: Hung) => `${h.wall}:${h.x},${h.z}`;

// Everyone hung who'll hang, in the room behind `door`: its own people first, then villagers brought in, each stood
// on the next of its floor's tiles; what was hung, and how many were refused.
function fill(model: GameModel, door: GameModel['entrances'][number]) {
  goIn(model, door);
  const { room, furniture } = model.inside!;
  const own = model.npcs.filter((n) => n.where === door && !n.led);
  const others = model.npcs.filter((n) => n.where !== door && n.role === 'villager' && !n.led);
  const tiles = Array.from({ length: room.width * room.depth }, (_, i) => ({ x: i % room.width, z: Math.floor(i / room.width) }));
  const hung: Hung[] = [];
  let refused = 0;
  for (const who of own) (model.chickens.turn(who, 'painting') ? hung.push(model.chickens.hens[model.chickens.hens.length - 1].hung!) : refused++);
  for (const [i, tile] of tiles.entries()) {
    const who = others[i];
    if (!who) break;
    Object.assign(who, { where: door, seat: null, x: tile.x, z: tile.z });
    if (model.chickens.turn(who, 'painting')) hung.push(model.chickens.hens[model.chickens.hens.length - 1].hung!);
    else refused++;
  }
  return { room, furniture, hung, refused };
}

describe('a painting, in every building', () => {
  it('hangs on a free stretch of its own room\'s back or left wall, alone on it, till none is left', () => {
    let [rooms, paintings, full] = [0, 0, 0];
    const behind = new Map<string, number>(); // (what stands free on the floor under one, by kind)
    for (const seed of TEST_SEEDS) {
      const doors = new GameModel(seed, TEST_MAP_SIZE).entrances.filter((e) => !goesUnder(e));
      for (const [d] of doors.entries()) {
        const model = new GameModel(seed, TEST_MAP_SIZE);
        const door = model.entrances.filter((e) => !goesUnder(e))[d];
        const said = `seed ${seed}, ${door.type} at ${door.x},${door.z}`;
        const { room, furniture, hung, refused } = fill(model, door);
        rooms++;
        paintings += hung.length;
        const covered = (h: Hung) => furniture.some((f) => (f.wall !== 'none' || f.kind === 'stairs' || f.kind === 'stairwell') && h.x >= f.x && h.x < f.x + f.w && h.z >= f.z && h.z < f.z + f.d);
        for (const h of hung) {
          expect(soundHung(h), said).toBe(true);
          expect(h.wall === 'back' ? h.z === 0 && h.x < room.width : h.x === 0 && h.z < room.depth, `${said}: ${key(h)}`).toBe(true); // (a tile of this room's)
          expect(covered(h), `${said}: ${key(h)} behind what's against the wall`).toBe(false);
          for (const f of furniture) if (f.wall === 'none' && f.solid && h.x >= f.x && h.x < f.x + f.w && h.z >= f.z && h.z < f.z + f.d) behind.set(f.kind, (behind.get(f.kind) ?? 0) + 1);
        }
        expect(new Set(hung.map(key)).size, said).toBe(hung.length); // (no two on a stretch)
        // Every free stretch taken, before any's refused.
        const stretches: Hung[] = [...Array.from({ length: room.width }, (_, x): Hung => ({ wall: 'back', x, z: 0 })), ...Array.from({ length: room.depth }, (_, z): Hung => ({ wall: 'left', x: 0, z }))];
        const free = stretches.filter((s) => !covered(s));
        if (refused > 0) [expect(hung.map(key).sort(), said).toEqual(free.map(key).sort()), full++];
        else expect(hung.length, said).toBeLessThanOrEqual(free.length);
        // Each where it hangs, facing out from its wall; all of them here, none out of doors.
        const here = model.chickens.here;
        expect(here.length, said).toBe(hung.length);
        for (const one of here) expect([one.x, one.z, one.y, one.facing, one.at], said).toEqual([hungAt(one.hung!).x, hungAt(one.hung!).z, 0, HUNG_FACING[one.hung!.wall], placeOf(door)]);
        // Upstairs (where there's any): none of them seen; back down, all of them.
        if (stairsOf(model.inside!)) {
          const stairs = stairsOf(model.inside!)!;
          Object.assign(model.hero, { x: stairs.x + stairs.w, z: stairs.z });
          expect(takeStairs(model), said).toBe(true);
          expect(model.chickens.here, said).toEqual([]);
          Object.assign(model.hero, { x: stairsOf(model.inside!)!.x, z: stairsOf(model.inside!)!.z - 1 });
          expect(takeStairs(model), said).toBe(true);
          expect(model.chickens.here.length, said).toBe(hung.length);
        }
        // Out of the door: none seen; back in, as they were; and after a save.
        const was = here.map((h) => [h.kind, h.x, h.z, h.facing, h.hung, h.stone]);
        model.inside = null; // (out, as the door puts them)
        model.teleport(door.x, door.z);
        expect(model.chickens.here, said).toEqual([]);
        for (let t = 0; t < 2; t += 0.1) model.update(0, 0, 0.1);
        goIn(model, door);
        expect(model.chickens.here.map((h) => [h.kind, h.x, h.z, h.facing, h.hung, h.stone]), said).toEqual(was);
        if ((d + seed) % 4 === 0) {
          const again = reloaded(model);
          expect(again.chickens.here.map((h) => [h.kind, h.x, h.z, h.facing, h.hung, h.stone]), said).toEqual(JSON.parse(JSON.stringify(was)));
        }
      }
    }
    expect(rooms).toBeGreaterThan(150);
    expect(paintings).toBeGreaterThan(rooms * 3);
    expect(full).toBeGreaterThan(0); // (some room filled to the last stretch)
    expect([...behind.keys()].sort()).toEqual(['barStool', 'barrel', 'chair', 'herbTable']); // (what stands free against a wall with one over it: all there is of that)
  });

  it('is no wider than its tile of wall, whoever it is of (every villager and keeper of every test world, as they dress)', () => {
    let widest = 0;
    for (const seed of TEST_SEEDS) {
      for (const one of new GameModel(seed, TEST_MAP_SIZE).npcs) {
        const rig = new HumanRig(one.look);
        rig.wear(one.equipment);
        rig.update(0, 0, 0, 0, null, 0, 'stand');
        const made = paintingOf(rig.root);
        widest = Math.max(widest, made.layout.size.x * INDOOR_SCALE);
        made.dispose();
      }
    }
    expect(widest).toBeGreaterThan(0.5);
    expect(widest).toBeLessThanOrEqual(1); // (a tile: its neighbour's its own)
  });
});

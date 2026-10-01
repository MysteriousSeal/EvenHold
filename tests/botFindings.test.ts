// What the bots' playtest (tests/bots/) found wrong in the game, kept fixed:
// a spawn on an islet, inn corners walled off by chairs, the server sent
// onto a table, a villager and the hero holding each other up, quest spots
// out of reach, and foes led off across the map.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { ENEMY_LEASH, HERO_RADIUS, WATER_LEVEL } from '../src/model/constants';
import { generateLakeMap } from '../src/model/worldgen/lakes';
import { layoutOf } from '../src/model/interiors/indoors';
import { bumpsFurniture, type Furniture } from '../src/model/interiors/furniture';
import type { Room } from '../src/model/interiors/interiors';
import { questAt } from '../src/model/quests/quests';
import { NPC_RADIUS } from '../src/model/npcs/npcs';
import { easeOffHero } from '../src/model/npcs/npcWalk';
import { FRAME, TEST_SEEDS, nearest, testModel } from './support/testWorld';

const MID = { width: 512, depth: 512 };
// Worlds where the bots ran into each of these (at 512 by 512), and the test worlds.
const midModel = new Map<number, GameModel>();
const mid = (seed: number) => midModel.get(seed) ?? (midModel.set(seed, new GameModel(seed, MID)), midModel.get(seed)!);
const worlds = (seeds: number[]) => [...TEST_SEEDS.map((seed) => ({ name: `test seed ${seed}`, model: testModel(seed) })), ...seeds.map((seed) => ({ name: `seed ${seed} (512)`, model: mid(seed) }))];

// Tiles the hero can walk to on the map from (x, z) (as pathfinding.ts steps), as x * depth + z.
function walkableFrom(model: GameModel, x: number, z: number): Uint8Array {
  const { width, depth } = model.size;
  const free = (px: number, pz: number) => !model.isBlocked(px, pz, HERO_RADIUS);
  const seen = new Uint8Array(width * depth);
  const todo = [x * depth + z];
  seen[todo[0]] = 1;
  while (todo.length > 0) {
    const cell = todo.pop()!;
    const [cx, cz] = [Math.floor(cell / depth), cell % depth];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const [nx, nz] = [cx + dx, cz + dz];
      if (nx < 1 || nz < 1 || nx >= width - 1 || nz >= depth - 1 || seen[nx * depth + nz] || !free(nx, nz) || !free(cx + dx / 2, cz + dz / 2)) continue;
      seen[nx * depth + nz] = 1;
      todo.push(nx * depth + nz);
    }
  }
  return seen;
}

// Floor tiles walkable from a room's doorway (solid pieces in the way).
function reachableFloor(room: Room, furniture: readonly Furniture[]): Set<string> {
  const taken = new Set<string>();
  for (const f of furniture) if (f.solid) for (let x = f.x; x < f.x + f.w; x++) for (let z = f.z; z < f.z + f.d; z++) taken.add(`${x},${z}`);
  const seen = new Set<string>();
  const todo: Array<[number, number]> = [[room.door, room.depth - 1]];
  while (todo.length > 0) {
    const [x, z] = todo.pop()!;
    if (x < 0 || z < 0 || x >= room.width || z >= room.depth || seen.has(`${x},${z}`) || taken.has(`${x},${z}`)) continue;
    seen.add(`${x},${z}`);
    todo.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
  }
  return seen;
}

describe('the spawn', () => {
  it('is never on an islet: lakes ringing it are drained till there is land to walk out on', () => {
    // Low ground everywhere but the spawn tile, all of it flooding.
    const size = 60;
    const heights = Array.from({ length: size }, () => new Array<number>(size).fill(WATER_LEVEL));
    heights[30][30] = WATER_LEVEL + 1;
    const lakes = generateLakeMap(heights, () => 1, -1, 30, 30);
    expect([lakes[29][30], lakes[31][30], lakes[30][29], lakes[30][31]]).toEqual([false, false, false, false]);
  });

  it('leaves lakes be when there is land enough round the spawn', () => {
    const size = 60;
    const heights = Array.from({ length: size }, (_, x) => new Array<number>(size).fill(x < 45 ? WATER_LEVEL + 1 : WATER_LEVEL));
    const lakes = generateLakeMap(heights, () => 1, -1, 20, 30);
    expect(lakes[55][30]).toBe(true);
  });

  it('has the whole map before it, on the worlds the bots found stranded (seed 4)', () => {
    const model = mid(4);
    const seen = walkableFrom(model, Math.round(model.hero.x), Math.round(model.hero.z));
    expect(seen.reduce((n, v) => n + v, 0)).toBeGreaterThan(10_000);
  });
});

describe('inns', () => {
  const inns = worlds([11, 12]).flatMap(({ name, model }) => model.entrances.filter((e) => e.type === 'inn').map((entrance) => ({ name, model, entrance })));

  it('keep the end of the bar and the stairs up reachable from the door (no chairs walling the corner off)', () => {
    expect(inns.length).toBeGreaterThan(8);
    for (const { name, model, entrance } of inns) {
      const { room, furniture } = layoutOf(model.seed, entrance);
      const floor = reachableFloor(room, furniture);
      const counter = furniture.find((f) => f.kind === 'counter')!;
      const stairs = furniture.find((f) => f.kind === 'stairs')!;
      expect(floor.has(`${counter.x},${counter.z + counter.d}`), `${name}: the bar's end`).toBe(true);
      const byStairs = [...Array(stairs.w).keys()].some((i) => floor.has(`${stairs.x + i},${stairs.z - 1}`)) || floor.has(`${stairs.x + stairs.w},${stairs.z}`);
      expect(byStairs, `${name}: the stairs`).toBe(true);
    }
  });

  it('have their staff and patrons never walk into the furniture, the hero looking on', () => {
    for (const { name, model, entrance } of inns.filter((i) => i.name.includes('512'))) {
      model.teleport(entrance.x, entrance.z);
      expect(model.useDoor()).toBe(true);
      const { furniture } = layoutOf(model.seed, entrance);
      for (let t = 0; t < 90; t += FRAME * 4) {
        model.update(0, 0, FRAME * 4);
        for (const n of model.npcs) if (n.where === entrance && !n.seat) expect(bumpsFurniture(furniture, n.x, n.z, 0.05), `${name}: ${n.role} ${n.name} at ${n.x.toFixed(2)},${n.z.toFixed(2)}`).toBe(false);
      }
      model.useDoor();
    }
  });
});

// A villager out of doors, on open ground by the hero (at spawn).
function outdoorsBy() {
  const model = testModel(TEST_SEEDS[0]);
  const npc = model.npcs[0];
  Object.assign(npc, { where: null, seat: null, x: model.hero.x, z: model.hero.z });
  return { model, npc };
}

describe('villagers and the hero', () => {
  it('a villager just touching the hero gets on with its walk (neither holds the other up)', () => {
    const { model, npc } = outdoorsBy();
    const reach = NPC_RADIUS + HERO_RADIUS;
    npc.x = model.hero.x + reach - 0.005;
    expect(easeOffHero(npc, model, FRAME)).toBe(false);
    npc.x = model.hero.x + reach - 0.1;
    const before = npc.x;
    expect(easeOffHero(npc, model, FRAME)).toBe(true);
    expect(npc.x).toBeGreaterThan(before);
  });

  it('a villager overlapping the hero with no room to ease off gets on with its walk', () => {
    const { model, npc } = outdoorsBy();
    npc.x = model.hero.x + 0.05;
    const blocked = model.isBlocked.bind(model);
    model.isBlocked = (x, z, r) => (Math.hypot(x - npc.x, z - npc.z) > 1e-6 ? true : blocked(x, z, r)); // walled in all round
    expect(easeOffHero(npc, model, FRAME)).toBe(false);
  });
});

describe('quests', () => {
  it('send the hero only where they can walk from the village (seeds where some were cut off)', () => {
    for (const { name, model } of worlds([24, 28])) {
      for (const [b, village] of model.villages.entries()) {
        const seen = walkableFrom(model, ...openBy(model, village.x, village.z));
        for (let n = 0; n < 6; n++) {
          const quest = questAt(model, b, n);
          expect(seen[quest.x * model.size.depth + quest.z], `${name}: quest ${quest.key} at ${quest.x},${quest.z}`).toBe(1);
        }
      }
    }
  });
});

describe('foes led away', () => {
  it('give up past their leash, healed, go home, and pay the hero no heed till most of the way back', () => {
    const model = testModel(TEST_SEEDS[0]);
    const wolf = nearest(model);
    model.godMode = true;
    // Chasing, hurt, far out from home with the hero right by it.
    Object.assign(wolf, { state: 'chase', hp: 1, x: wolf.homeX + ENEMY_LEASH + 1, z: wolf.homeZ });
    model.teleport(wolf.x + 0.6, wolf.z);
    model.update(0, 0, FRAME);
    expect(wolf.state).toBe('wander');
    expect(wolf.hp).toBe(wolf.maxHp);
    for (let i = 0; i < 30; i++) {
      model.teleport(wolf.x + 0.6, wolf.z); // the hero dogging it
      model.update(0, 0, FRAME);
      expect(wolf.state).toBe('wander');
    }
    expect(Math.hypot(wolf.x - wolf.homeX, wolf.z - wolf.homeZ)).toBeLessThan(ENEMY_LEASH + 1); // on its way back
  });
});

// The open tile nearest (x, z) (a village's middle has its well on it).
function openBy(model: GameModel, x: number, z: number): [number, number] {
  for (let ring = 1; ring <= 3; ring++) for (let dx = -ring; dx <= ring; dx++) for (let dz = -ring; dz <= ring; dz++) if (!model.isBlocked(x + dx, z + dz, HERO_RADIUS)) return [x + dx, z + dz];
  return [x, z];
}

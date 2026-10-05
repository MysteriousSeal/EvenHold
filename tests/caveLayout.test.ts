// The caves (model/caves/): their mouths out in the hills, placed in the
// wilds where the ground rises behind them, open and level before them, their
// knolls of rock blocked; inside, a burrow dug from the seed (caveLayout.ts):
// all of it reached from the way in, a straight throat two wide at the door,
// chambers and dens on the way, the nest the greatest and the last; what's in
// it (caveProps.ts) never sealing any floor off, the crack in the nest's far
// wall in its rock with floor before it; its beasts' posts (caveFoes.ts) on
// open floor, clear of the way up and the nest, bats nearer the mouth and
// worms deeper in, none past the silk walling the nest off (a cut across the
// way into it). The same every time, from the seed.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { planCave } from '../src/model/caves/caveLayout';
import { caveExit, furnishCave, nestSeal, reaches, solidTiles } from '../src/model/caves/caveProps';
import { caveAt, caveInside, caveKey } from '../src/model/caves/caves';
import { cavePosts } from '../src/model/caves/caveFoes';
import { isFloor } from '../src/model/dungeons/floorPlan';
import { FACINGS } from '../src/model/map/grid';
import { mulberry32 } from '../src/util/random';
import { floorReached } from './support/cryptChecks';
import { mapsOf } from './support/testWorld';

const MID = { width: 512, depth: 512 };
const seeds = Array.from({ length: 30 }, (_, i) => Math.floor(mulberry32(6600 + i)() * 2 ** 31));
const mouthOf = (i: number) => ({ x: 40 + i * 11, z: 60 + i * 17 });

describe('the caves\' mouths', () => {
  const model = new GameModel(1, MID);

  it('are in the hills, one to a stretch of the wilds: the ground before each open and level with it, its knoll\'s rock blocked and never lower, the hill rising behind; each known by its way in, the same every time', () => {
    expect(model.caves.length).toBeGreaterThan(0);
    for (const cave of model.caves) {
      const [ox, oz] = FACINGS[cave.quarterTurns];
      const level = mapsOf(model).heightMap[cave.mouth.x][cave.mouth.z];
      expect(cave.rock).toHaveLength(9);
      for (const t of cave.rock) {
        expect(model.isOpenTile(t.x, t.z)).toBe(false);
        expect(mapsOf(model).heightMap[t.x][t.z]).toBeGreaterThanOrEqual(level);
      }
      const before = { x: cave.mouth.x + ox, z: cave.mouth.z + oz };
      expect(mapsOf(model).heightMap[before.x][before.z]).toBe(level);
      expect(model.isOpenTile(before.x, before.z)).toBe(true);
      expect(Math.hypot(cave.entrance.x - (cave.mouth.x + ox), cave.entrance.z - (cave.mouth.z + oz))).toBeLessThan(0.5);
      expect(model.entrances).toContain(cave.entrance);
      expect(caveAt(cave.entrance)).toBe(cave);
      expect(caveKey(cave)).toMatch(/^cave:\d+,\d+$/);
      expect(cave.name.length).toBeGreaterThan(3);
    }
    const again = new GameModel(1, MID);
    expect(again.caves.map((c) => [c.mouth, c.name, c.level])).toEqual(model.caves.map((c) => [c.mouth, c.name, c.level]));
  });

  it('are offered at their way in: going in, the hero\'s down in its burrow, at the foot of its way up', () => {
    const cave = model.caves[0];
    model.teleport(cave.entrance.x, cave.entrance.z);
    expect(model.doorInReach).toBe(cave.entrance);
    model.useDoor();
    const { plan } = caveInside(model.seed, cave.entrance);
    expect(model.inside?.entrance).toBe(cave.entrance);
    expect(model.cave).not.toBeNull();
    expect(model.crypt).toBeNull();
    expect(isFloor(plan, Math.round(model.hero.x), Math.round(model.hero.z))).toBe(true);
    expect(model.hero.z).toBeGreaterThan(plan.depth - 3);
  });
});

describe('a cave\'s burrow', () => {
  it('is all reached from its way in; its throat straight and two wide at the door; chambers, dens and the nest, apart, the nest the greatest and the last; the same every time (30 seeds)', () => {
    for (const [i, seed] of seeds.entries()) {
      const plan = planCave(seed, mouthOf(i));
      expect(planCave(seed, mouthOf(i))).toEqual(plan);
      const reached = floorReached(plan, new Set());
      let floor = 0;
      for (let x = 0; x < plan.width; x++) for (let z = 0; z < plan.depth; z++) if (isFloor(plan, x, z)) floor++;
      expect(reached.size).toBe(floor);
      expect(floor).toBeGreaterThan(400);
      for (let z = plan.depth - 4; z < plan.depth; z++) for (const x of [plan.door, plan.door + 1]) expect(isFloor(plan, x, z)).toBe(true);
      expect(isFloor(plan, plan.door - 1, plan.depth - 1) || isFloor(plan, plan.door + 2, plan.depth - 1)).toBe(false);
      const nest = plan.hollows.at(-1)!;
      expect(nest.kind).toBe('nest');
      expect(plan.hollows.filter((h) => h.kind === 'chamber').length).toBeGreaterThanOrEqual(3);
      for (const h of plan.hollows) {
        expect(isFloor(plan, Math.round(h.x), Math.round(h.z))).toBe(true);
        if (h !== nest) expect(nest.r).toBeGreaterThan(h.r);
      }
      // No straight wall in it: its edge never runs straight for long.
      let longest = 0;
      for (let z = 1; z < plan.depth - 6; z++) {
        let run = 0;
        for (let x = 0; x < plan.width; x++) {
          run = isFloor(plan, x, z) && !isFloor(plan, x, z - 1) ? run + 1 : 0;
          longest = Math.max(longest, run);
        }
      }
      expect(longest).toBeLessThan(14);
    }
  });

  it('has in it what never seals any floor off (stalagmites, crystals, egg sacs standing), egg sacs in the nest, nothing solid on the way up; its crack in the nest\'s far wall, rock, the floor before it (30 seeds)', () => {
    for (const [i, seed] of seeds.entries()) {
      const plan = planCave(seed, mouthOf(i));
      const props = furnishCave(seed, mouthOf(i), plan);
      expect(furnishCave(seed, mouthOf(i), plan)).toEqual(props);
      const solid = solidTiles(props);
      let open = 0;
      for (let x = 0; x < plan.width; x++) for (let z = 0; z < plan.depth; z++) if (isFloor(plan, x, z) && !solid.has(`${x},${z}`)) open++;
      expect(floorReached(plan, solid).size).toBe(open);
      const nest = plan.hollows.at(-1)!;
      const sacs = props.filter((p) => p.kind === 'eggSac');
      expect(sacs.length).toBeGreaterThanOrEqual(3);
      for (const s of sacs) expect(Math.hypot(s.x - nest.x, s.z - nest.z)).toBeLessThan(nest.r * 1.5 + 1); // (round its lobes' edge)
      for (const p of props) {
        expect(isFloor(plan, p.x, p.z)).toBe(true);
        if (p.solid) expect(Math.hypot(p.x - plan.door, p.z - (plan.depth - 1)) > 4).toBe(true);
      }
      const exit = caveExit(plan);
      expect(isFloor(plan, exit.spot.x, exit.spot.z)).toBe(true);
      expect(isFloor(plan, exit.rock.x, exit.rock.z)).toBe(false);
      expect(Math.hypot(exit.spot.x - nest.x, exit.spot.z - nest.z)).toBeLessThan(nest.r * 1.5 + 1);
    }
  });
});

describe('the silk walling a cave\'s nest off', () => {
  it('is a cut across the way into it, a few tiles, on the floor: shut, the nest can\'t be reached from the way in; open, it can; the same every time (30 seeds)', () => {
    for (const [i, seed] of seeds.entries()) {
      const plan = planCave(seed, mouthOf(i));
      const seal = nestSeal(plan)!;
      expect(seal).not.toBeNull();
      expect(nestSeal(plan)).toEqual(seal);
      expect(seal.length).toBeGreaterThan(0);
      expect(seal.length).toBeLessThanOrEqual(40);
      for (const t of seal) expect(isFloor(plan, t.x, t.z)).toBe(true);
      const nest = plan.hollows.at(-1)!;
      const [nx, nz] = [Math.round(nest.x), Math.round(nest.z)];
      expect(reaches(plan, new Set(seal.map((t) => `${t.x},${t.z}`)), nx, nz)).toBe(false);
      expect(reaches(plan, new Set(), nx, nz)).toBe(true);
      expect(seal.every((t) => Math.hypot(t.x - plan.door, t.z - (plan.depth - 1)) > 10)).toBe(true); // (deep in, not by the way up)
    }
  });
});

describe('a cave\'s beasts\' posts', () => {
  it('are on open floor reached from the way in, clear of the way up and of the nest (hers alone), apart; bats nearer the mouth, worms deeper in; the same every time (30 seeds)', () => {
    const depthOf: Record<string, number[]> = { caveBat: [], caveSpider: [], caveWorm: [] };
    for (const [i, seed] of seeds.entries()) {
      const mouth = mouthOf(i);
      const plan = planCave(seed, mouth);
      const props = furnishCave(seed, mouth, plan);
      const seal = nestSeal(plan)!;
      const sealKeys = new Set(seal.map((t) => `${t.x},${t.z}`));
      const inside = { cave: { mouth, level: 4 }, plan, props, exit: caveExit(plan), seal, sealKeys, sealed: true } as unknown as Parameters<typeof cavePosts>[1];
      const posts = cavePosts(seed, inside);
      expect(cavePosts(seed, inside)).toEqual(posts);
      expect(posts.length).toBeGreaterThan(8);
      const solid = solidTiles(props);
      const reached = floorReached(plan, new Set([...solid, ...sealKeys])); // (none walled in with her)
      const nest = plan.hollows.at(-1)!;
      expect(new Set(posts.map((p) => `${p.x},${p.z}`)).size).toBe(posts.length);
      for (const p of posts) {
        expect(reached.has(`${p.x},${p.z}`)).toBe(true);
        expect(Math.hypot(p.x - plan.door, p.z - (plan.depth - 1))).toBeGreaterThan(6);
        expect(Math.hypot(p.x - nest.x, p.z - nest.z)).toBeGreaterThan(nest.r);
        depthOf[p.kind].push(1 - p.z / plan.depth);
      }
    }
    const mean = (list: number[]) => list.reduce((a, b) => a + b, 0) / list.length;
    for (const list of Object.values(depthOf)) expect(list.length).toBeGreaterThan(20);
    expect(mean(depthOf.caveBat)).toBeLessThan(mean(depthOf.caveSpider));
    expect(mean(depthOf.caveSpider)).toBeLessThan(mean(depthOf.caveWorm));
  });
});

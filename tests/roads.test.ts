// The roads between the villages (worldgen/roads.ts): the villages joined, each to two others at least, each road leaving
// one village's square or lanes for another's, over dry, open ground, paved; the same for the same seed.

import { describe, expect, it } from 'vitest';
import { generateWorld } from '../src/model/worldgen/world';
import { MAX_LINK, MIN_ROADS } from '../src/model/worldgen/roads';
import { solidCells } from '../src/model/worldgen/world';
import { cellKey } from '../src/model/map/grid';
import { LANE_LENGTH_MAX, VILLAGE_OUTER_RADIUS } from '../src/model/constants';
import type { World } from '../src/model/types';
import { buildRoadTile } from '../src/view/meshes/road/roadVoxels';
import { colorAt } from '../src/view/meshes/voxel/voxelShapes';

const MID = { width: 512, depth: 512 };
const SEEDS = [1, 2, 3];
const worlds = new Map<number, World>();
const world = (seed: number) => worlds.get(seed) ?? worlds.set(seed, generateWorld(seed, MID)).get(seed)!;
const REACH = VILLAGE_OUTER_RADIUS + LANE_LENGTH_MAX + 2;
const within = (v: { x: number; z: number }, [x, z]: [number, number], r: number) => Math.max(Math.abs(x - v.x), Math.abs(z - v.z)) <= r;

describe('the roads between the villages', () => {
  it.each(SEEDS)('seed %i: join the villages, the nearest first: never the same two twice, none further than MAX_LINK apart', (seed) => {
    const w = world(seed);
    expect(w.villages.length).toBeGreaterThan(10);
    expect(w.roads.length).toBeGreaterThanOrEqual(w.villages.length - 1);
    const pairs = new Set<string>();
    for (const r of w.roads) {
      const key = [r.from, r.to].sort((a, b) => a - b).join('-');
      expect(pairs.has(key), `twice: ${key}`).toBe(false);
      pairs.add(key);
      const [a, b] = [w.villages[r.from], w.villages[r.to]];
      expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThanOrEqual(MAX_LINK);
    }
  });

  it.each(SEEDS)('seed %i: every village joined to at least two others (as many as it has in reach, if fewer)', (seed) => {
    const w = world(seed);
    for (let i = 0; i < w.villages.length; i++) {
      const v = w.villages[i];
      const inReach = w.villages.filter((o, j) => j !== i && Math.hypot(o.x - v.x, o.z - v.z) <= MAX_LINK).length;
      const joined = new Set(w.roads.filter((r) => r.from === i || r.to === i).map((r) => (r.from === i ? r.to : r.from)));
      expect(joined.size, `village ${i} at ${v.x},${v.z}`).toBeGreaterThanOrEqual(Math.min(MIN_ROADS, inReach));
    }
  });

  it.each(SEEDS)('seed %i: one network: every village reaches the rest by road (those with a neighbour in reach)', (seed) => {
    const w = world(seed);
    const next = w.villages.map(() => [] as number[]);
    for (const r of w.roads) [next[r.from], next[r.to]] = [[...next[r.from], r.to], [...next[r.to], r.from]];
    const seen = new Set([0]);
    const todo = [0];
    while (todo.length > 0) for (const n of next[todo.pop()!]) if (!seen.has(n)) (seen.add(n), todo.push(n));
    const linked = w.villages.filter((_, i) => next[i].length > 0).length;
    expect(seen.size).toBe(linked);
  });

  it.each(SEEDS)('seed %i: each runs unbroken, tile by tile, from one village to the other', (seed) => {
    const w = world(seed);
    for (const r of w.roads) {
      expect(within(w.villages[r.from], r.route[0], REACH), 'leaves its first village').toBe(true);
      expect(within(w.villages[r.to], r.route[r.route.length - 1], REACH), 'arrives at its second').toBe(true);
      for (let i = 1; i < r.route.length; i++) {
        const [[x0, z0], [x1, z1]] = [r.route[i - 1], r.route[i]];
        expect(Math.abs(x1 - x0) + Math.abs(z1 - z0), 'a step to the next tile over').toBe(1);
      }
    }
  });

  it.each(SEEDS)('seed %i: over dry ground, round houses and wells, paved (path or the squares)', (seed) => {
    const w = world(seed);
    const solid = solidCells(w);
    for (const r of w.roads) {
      for (const [x, z] of r.route) {
        expect(w.lakeMap[x][z], `water at ${x},${z}`).toBe(false);
        expect(solid.has(cellKey(x, z)), `a building at ${x},${z}`).toBe(false);
        expect(['path', 'plaza']).toContain(w.surfaceMap[x][z]);
      }
    }
  });

  it.each(SEEDS)('seed %i: no tree or bush on a road', (seed) => {
    const w = world(seed);
    const onRoads = new Set(w.roads.flatMap((r) => r.route.map(([x, z]) => cellKey(x, z))));
    expect(w.trees.filter((t) => onRoads.has(cellKey(Math.round(t.x), Math.round(t.z))))).toEqual([]);
    expect(w.bushes.filter((b) => onRoads.has(cellKey(b.x, b.z)))).toEqual([]);
  });

  it('leave a village from the end of a lane, not beside one: most set out off the square itself', () => {
    const w = world(1);
    const offSquare = w.roads.filter((r) => !within(w.villages[r.from], r.route[0], VILLAGE_OUTER_RADIUS));
    expect(offSquare.length).toBeGreaterThan(w.roads.length / 3); // (from a lane's end, where one leads the way)
  });

  it('are the same for the same seed', () => {
    expect(generateWorld(2, MID).roads).toEqual(world(2).roads);
  });
});

describe('a road\'s tiles', () => {
  const RUT_FLOOR = 4; // (the palette's rut floor, stored one up)
  const ruts = (mask: number) => {
    const grid = buildRoadTile(mask, 0);
    const cells: Array<[number, number]> = [];
    for (let i = 0; i < 25; i++) for (let k = 0; k < 25; k++) if (colorAt(grid, i, 0, k) === RUT_FLOOR + 0 && colorAt(grid, i, 1, k) === 0) cells.push([i, k]);
    return cells;
  };
  const inMiddle = ([i, k]: [number, number]) => Math.abs(i - 12) <= 6 && Math.abs(k - 12) <= 6;
  const [E, W, S, N] = [1, 2, 4, 8];

  it('a road straight through keeps its ruts across the middle', () => {
    expect(ruts(E | W).filter(inMiddle).length).toBeGreaterThan(0);
  });

  const rut = (cells: Array<[number, number]>, i: number, k: number) => cells.some(([a, b]) => a === i && b === k);

  it('a crossroads: every arm\'s ruts join their neighbours\' at the four corners of the middle, none crossing', () => {
    const cells = ruts(E | W | N | S);
    for (const [i, k] of [[9, 9], [15, 9], [9, 15], [15, 15]]) expect(rut(cells, i, k), `corner ${i},${k}`).toBe(true);
    for (const [i, k] of [[12, 9], [12, 15], [9, 12], [15, 12], [12, 12]]) expect(rut(cells, i, k), `across ${i},${k}`).toBe(false);
    for (const edge of [0, 24]) expect(cells.some(([i, k]) => i === edge || k === edge)).toBe(true);
  });

  it('a T: the through road\'s far rut straight across, the near one open where the branch joins it, in two L\'s', () => {
    const cells = ruts(E | W | S); // (through east-west, the branch south: +k)
    for (let i = 0; i < 25; i++) expect(rut(cells, i, 9), `the far rut at ${i}`).toBe(true);
    expect(rut(cells, 12, 15)).toBe(false); // (the near rut open across the branch's mouth)
    for (const i of [9, 15]) {
      expect(rut(cells, i, 15), `the corner at ${i}`).toBe(true); // (the branch's rut meeting the near one)
      expect(rut(cells, i, 14)).toBe(false); // (and not on past it)
      expect(rut(cells, i, 24)).toBe(true); // (out to the edge)
    }
    const turned = ruts(N | S | E); // (through north-south, the branch east: +i)
    for (let k = 0; k < 25; k++) expect(rut(turned, 9, k), `the far rut at ${k}`).toBe(true);
    expect(rut(turned, 15, 12)).toBe(false);
  });
});

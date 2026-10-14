// The roads on from region to region (worldgen/borderRoads.ts): each border's crossing found the same from either
// side, a road on each side running straight in from it and on to that region's roads or a village, over dry, open
// ground; nothing left standing on them.

import { describe, expect, it } from 'vitest';
import { REGION, STREAMED_SIZE, crossingsOf, generateRegionLand, type RegionLand } from '../src/model/worldgen/regions';
import { cellKey } from '../src/model/map/grid';
import { solidCells } from '../src/model/worldgen/world';

const lands = new Map<string, RegionLand>();
const land = (seed: number, rx: number, rz: number) => {
  const key = `${seed}:${rx},${rz}`;
  return lands.get(key) ?? lands.set(key, generateRegionLand(seed, rx, rz)).get(key)!;
};
const SEEDS = [1, 7];

describe('the roads on from region to region', () => {
  it.each(SEEDS)('seed %i: each border crossed once, at the same spot from either side', (seed) => {
    const [a, b, c] = [land(seed, 16, 16), land(seed, 17, 16), land(seed, 16, 17)];
    const [X, Z] = [17 * REGION, 17 * REGION];
    const east = (l: RegionLand, x: number) => Array.from({ length: REGION }, (_, i) => 16 * REGION + i).filter((z) => l.tiles.surface(x, z) === 'path');
    const south = (l: RegionLand, z: number) => Array.from({ length: REGION }, (_, i) => 16 * REGION + i).filter((x) => l.tiles.surface(x, z) === 'path');
    expect(east(a, X - 1)).toHaveLength(1);
    expect(east(b, X)).toEqual(east(a, X - 1));
    expect(south(a, Z - 1)).toHaveLength(1);
    expect(south(c, Z)).toEqual(south(a, Z - 1));
  });

  it('the world\'s own edges never crossed', () => {
    expect(crossingsOf(1, 0, 0, REGION, REGION, STREAMED_SIZE).every(([x, z]) => x === REGION - 1 || z === REGION - 1)).toBe(true);
    const last = STREAMED_SIZE.width / REGION - 1;
    expect(crossingsOf(1, last, last, REGION, REGION, STREAMED_SIZE).every(([x, z]) => x === 0 || z === 0)).toBe(true);
  });

  it.each(SEEDS)('seed %i: each runs unbroken from its border, straight in a way, to the region\'s roads or a village', (seed) => {
    const l = land(seed, 16, 16);
    const paved = new Set([...l.roads.flatMap((r) => r.route), ...l.villages.flatMap((v) => [[v.x, v.z] as [number, number]])].map(([x, z]) => cellKey(x, z)));
    const ways = l.trails.filter((t) => {
      const [x, z] = t[0];
      if (x === STREAMED_SIZE.width / 2 && z === STREAMED_SIZE.depth / 2) return false; // (the hero's trail, from where they set out: on this region's corner)
      return x === l.x0 || z === l.z0 || x === l.x0 + REGION - 1 || z === l.z0 + REGION - 1;
    });
    expect(ways.length).toBeGreaterThanOrEqual(3);
    for (const way of ways) {
      for (let i = 1; i < way.length; i++) expect(Math.abs(way[i][0] - way[i - 1][0]) + Math.abs(way[i][1] - way[i - 1][1])).toBe(1);
      const [[x0, z0], [x1, z1]] = [way[0], way[3]];
      expect(x0 === x1 || z0 === z1, 'straight in from the border').toBe(true);
      const [ex, ez] = way[way.length - 1];
      const end = paved.has(cellKey(ex, ez)) || l.villages.some((v) => Math.max(Math.abs(v.x - ex), Math.abs(v.z - ez)) <= 12);
      expect(end, `ends at a road or a village: ${ex},${ez}`).toBe(true);
    }
  });

  it.each(SEEDS)('seed %i: over dry, open ground, off the fields, nothing standing on them', (seed) => {
    const l = land(seed, 16, 16);
    const solid = solidCells(l);
    const onWays = new Set(l.trails.flat().map(([x, z]) => cellKey(x, z)));
    for (const [x, z] of l.trails.flat()) {
      expect(l.tiles.lake(x, z), `water at ${x},${z}`).toBe(false);
      expect(solid.has(cellKey(x, z)), `a building at ${x},${z}`).toBe(false);
      expect(['path', 'plaza']).toContain(l.tiles.surface(x, z));
    }
    expect(l.trees.filter((t) => onWays.has(cellKey(Math.round(t.x), Math.round(t.z))))).toEqual([]);
    expect(l.bushes.filter((b) => onWays.has(cellKey(b.x, b.z)))).toEqual([]);
  });
});

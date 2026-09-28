import { describe, it, expect } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { TILE_HEIGHT } from '../src/model/constants';
import { cellKey } from '../src/model/grid';
import { solidCells } from '../src/model/worldgen/world';
import { scatterGroundCover, type ScatterItem } from '../src/view/meshes/ground/groundCoverScatter';
import { ROAD_WIDTH } from '../src/view/constants';

const models = [1, 2, 3, 7, 42].map((seed) => [seed, new GameModel(seed)] as const);

function tileOf(item: ScatterItem): [number, number] {
  return [Math.round(item.x), Math.round(item.z)];
}

describe('ground cover scatter', () => {
  it.each(models)('seed %i: never on water, squares or buildings, and at ground height', (_, model) => {
    const solid = solidCells(model.houses, model.villages);
    const { tufts, flowers, pebbles } = scatterGroundCover(model);
    expect(tufts.length).toBeGreaterThan(0);

    for (const item of [...tufts, ...flowers, ...pebbles]) {
      const [x, z] = tileOf(item);
      expect(model.lakeMap[x][z]).toBe(false);
      expect(model.surfaceMap[x][z]).not.toBe('plaza');
      expect(solid.has(cellKey(x, z))).toBe(false);
      expect(item.y).toBeCloseTo(model.heightMap[x][z] * TILE_HEIGHT, 10);
    }
    // Flowers and pebbles stay on plain grass; only grass lines the roads.
    for (const item of [...flowers, ...pebbles]) expect(model.surfaceMap[tileOf(item)[0]][tileOf(item)[1]]).toBe('natural');
  });

  it.each(models)('seed %i: grass lines the roads without growing on the dirt', (_, model) => {
    const { tufts } = scatterGroundCover(model);
    // The dirt strip is the union of the trail's tile-to-tile segments,
    // ROAD_WIDTH wide with square ends.
    const onDirt = (px: number, pz: number) =>
      model.trails.some((route) =>
        route.slice(1).some(([bx, bz], i) => {
          const [ax, az] = route[i];
          const half = ROAD_WIDTH / 2;
          return (
            px >= Math.min(ax, bx) - half && px <= Math.max(ax, bx) + half && pz >= Math.min(az, bz) - half && pz <= Math.max(az, bz) + half
          );
        }),
      );
    const lining = tufts.filter((t) => model.surfaceMap[tileOf(t)[0]][tileOf(t)[1]] === 'path');
    if (model.trails.length > 0) expect(lining.length).toBeGreaterThan(20);
    for (const t of lining) expect(onDirt(t.x, t.z)).toBe(false);
  });

  it.each(models)('seed %i: flowers and pebbles avoid tree tiles', (_, model) => {
    const treeCells = new Set(model.trees.map((t) => cellKey(t.x, t.z)));
    const { flowers, pebbles } = scatterGroundCover(model);
    for (const item of [...flowers, ...pebbles]) expect(treeCells.has(cellKey(...tileOf(item)))).toBe(false);
  });

  it.each(models)('seed %i: grass grows in patches, with bare ground and dense meadows', (_, model) => {
    const perTile = new Map<string, number>();
    for (const t of scatterGroundCover(model).tufts) {
      const key = cellKey(...tileOf(t));
      perTile.set(key, (perTile.get(key) ?? 0) + 1);
    }
    let bareGrassTiles = 0;
    for (let x = 0; x < model.heightMap.length; x++) {
      for (let z = 0; z < model.heightMap[x].length; z++) {
        const plainGrass = !model.lakeMap[x][z] && model.surfaceMap[x][z] === 'natural';
        if (plainGrass && !perTile.has(cellKey(x, z))) bareGrassTiles++;
      }
    }
    const denseTiles = [...perTile.values()].filter((n) => n >= 3).length;
    expect(bareGrassTiles).toBeGreaterThan(200);
    expect(denseTiles).toBeGreaterThan(200);
  });

  it.each(models)('seed %i: clumps are bigger in dense meadows than at their edges', (_, model) => {
    const { tufts } = scatterGroundCover(model);
    const perTile = new Map<string, ScatterItem[]>();
    for (const t of tufts) {
      const key = cellKey(...tileOf(t));
      perTile.set(key, [...(perTile.get(key) ?? []), t]);
    }
    const averageScale = (items: ScatterItem[]) => items.reduce((sum, t) => sum + t.scale, 0) / items.length;
    const groups = [...perTile.values()];
    const sparse = groups.filter((g) => g.length === 1).flat();
    const dense = groups.filter((g) => g.length >= 4).flat();
    expect(averageScale(dense)).toBeGreaterThan(averageScale(sparse) + 0.2);
  });

  it('is deterministic', () => {
    const model = new GameModel(5);
    expect(scatterGroundCover(model)).toEqual(scatterGroundCover(model));
  });
});

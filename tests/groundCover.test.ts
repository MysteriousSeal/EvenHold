import { describe, it, expect } from 'vitest';
import type { GameModel } from '../src/model/GameModel';
import { TEST_SEEDS, testModel } from './support/testWorld';
import { ROAD_WIDTH, TILE_HEIGHT } from '../src/model/constants';
import { cellKey } from '../src/model/grid';
import { solidCells } from '../src/model/worldgen/world';
import * as THREE from 'three';
import { scatterGroundCover, type ScatterItem } from '../src/view/meshes/cover/groundCoverScatter';
import { buildFlowerGeometry, buildPebbleGeometry, buildTuftGeometry, tuftSize } from '../src/view/meshes/cover/groundCoverMesh';
import { TUFT_SIZES } from '../src/view/meshes/cover/groundCoverVoxels';

// Small test worlds (see support/testWorld.ts), scattered once per seed.
const models = TEST_SEEDS.slice(0, 4).map((seed) => [seed, testModel(seed)] as const);
const scattered = new Map<GameModel, ReturnType<typeof scatterGroundCover>>();
function cover(model: GameModel) {
  let result = scattered.get(model);
  if (!result) {
    result = scatterGroundCover(model);
    scattered.set(model, result);
  }
  return result;
}

function tileOf(item: ScatterItem): [number, number] {
  return [Math.round(item.x), Math.round(item.z)];
}

describe('ground cover scatter', () => {
  it.each(models)('seed %i: never on water, squares or buildings, and at ground height', (_, model) => {
    const solid = solidCells(model.houses, model.villages);
    const { tufts, flowers, pebbles } = cover(model);
    expect(tufts.length).toBeGreaterThan(0);

    const misplaced = [...tufts, ...flowers, ...pebbles].filter((item) => {
      const [x, z] = tileOf(item);
      return (
        model.lakeMap[x][z] ||
        model.surfaceMap[x][z] === 'plaza' ||
        solid.has(cellKey(x, z)) ||
        Math.abs(item.y - model.heightMap[x][z] * TILE_HEIGHT) > 1e-9
      );
    });
    expect(misplaced).toEqual([]);
    // Flowers and pebbles stay on plain grass; only grass lines the roads.
    expect([...flowers, ...pebbles].filter((item) => model.surfaceMap[tileOf(item)[0]][tileOf(item)[1]] !== 'natural')).toEqual([]);
  });

  it.each(models)('seed %i: grass lines the roads without growing on the dirt', (_, model) => {
    const { tufts } = cover(model);
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
    // A steady line: on average at least one lining clump per trail tile.
    const trailTiles = model.trails.reduce((sum, route) => sum + route.length, 0);
    expect(lining.length).toBeGreaterThanOrEqual(trailTiles);
    expect(lining.filter((t) => onDirt(t.x, t.z))).toEqual([]);
  });

  it.each(models)('seed %i: flowers and pebbles avoid tree tiles', (_, model) => {
    const treeCells = new Set(model.trees.map((t) => cellKey(t.x, t.z)));
    const { flowers, pebbles } = cover(model);
    expect([...flowers, ...pebbles].filter((item) => treeCells.has(cellKey(...tileOf(item))))).toEqual([]);
  });

  it.each(models)('seed %i: grass grows in patches, with bare ground and dense meadows', (_, model) => {
    const perTile = new Map<string, number>();
    for (const t of cover(model).tufts) {
      const key = cellKey(...tileOf(t));
      perTile.set(key, (perTile.get(key) ?? 0) + 1);
    }
    let grassTiles = 0;
    let bareGrassTiles = 0;
    for (let x = 0; x < model.size.width; x++) {
      for (let z = 0; z < model.size.depth; z++) {
        if (model.lakeMap[x][z] || model.surfaceMap[x][z] !== 'natural') continue;
        grassTiles++;
        if (!perTile.has(cellKey(x, z))) bareGrassTiles++;
      }
    }
    const denseTiles = [...perTile.values()].filter((n) => n >= 3).length;
    // Shares of the grass, so the check holds at any world size.
    expect(bareGrassTiles / grassTiles).toBeGreaterThan(0.05);
    expect(denseTiles / grassTiles).toBeGreaterThan(0.05);
  });

  it.each(models)('seed %i: clumps are bigger in dense meadows than at their edges', (_, model) => {
    const { tufts } = cover(model);
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
    const model = testModel(TEST_SEEDS[0]);
    expect(scatterGroundCover(model)).toEqual(scatterGroundCover(model));
  });
});

describe('voxel ground cover models', () => {
  const box = (g: THREE.BufferGeometry) => {
    g.computeBoundingBox();
    return g.boundingBox!;
  };

  it.each([0, 1, 2].flatMap((size) => [0, 1, 2].map((shape) => [size, shape])))('tuft %i/%i: taller with size, small footprint', (size, shape) => {
    const b = box(buildTuftGeometry(size, shape));
    expect(Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z)).toBeLessThanOrEqual(0.141);
    expect(b.max.y).toBeLessThanOrEqual(TUFT_SIZES[size] * 0.04);
    expect(b.max.y).toBeGreaterThan(0.05);
  });

  it('builds every flower and pebble model', () => {
    for (let color = 0; color < 3; color++) for (let h = 0; h < 2; h++) expect(box(buildFlowerGeometry(color, h)).max.y).toBeGreaterThan(0.1);
    for (let shape = 0; shape < 6; shape++) expect(box(buildPebbleGeometry(shape)).max.y).toBeLessThan(0.1);
  });

  it('maps scatter scale to tuft size classes', () => {
    expect([0.5, 0.9, 1.3].map(tuftSize)).toEqual([0, 1, 2]);
  });
});

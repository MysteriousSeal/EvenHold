import { describe, it, expect } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import {
  BUSH_COLLISION_HALF,
  HERO_RADIUS,
  HOP_HEIGHT,
  MAP_WIDTH,
  MAP_DEPTH,
  ROAD_SURFACE_HEIGHT,
  TILE_HEIGHT,
  TREE_COLLISION_HALF,
} from '../src/model/constants';
import { cellKey } from '../src/model/grid';
import { solidCells } from '../src/model/worldgen/world';

const FRAME = 1 / 60;

// Tiles to keep the test path clear of: the game's solid-tile rule (water,
// houses, wells, bushes) plus trees, whose trunks block too.
function solidCellCheck(model: GameModel): (x: number, z: number) => boolean {
  const solid = solidCells(model.houses, model.villages, model.bushes);
  for (const t of model.trees) solid.add(cellKey(t.x, t.z));
  const inMap = (x: number, z: number) => x >= 0 && z >= 0 && x < model.heightMap.length && z < model.heightMap[0].length;
  return (x, z) => !inMap(x, z) || model.lakeMap[x][z] || solid.has(cellKey(x, z));
}

describe('hero collision', () => {
  // Walks the hero east into the west face of a house and checks its body
  // stops outside the house's cell rather than sinking into it.
  it('stops the hero body at the edge of a house cell', () => {
    const model = new GameModel(1);
    const isSolid = solidCellCheck(model);

    const house = model.houses.find((h) => !isSolid(h.x - 1, h.z) && !isSolid(h.x - 2, h.z));
    expect(house).toBeDefined();

    model.hero.x = house!.x - 2;
    model.hero.z = house!.z;

    for (let i = 0; i < 120; i++) model.update(1, 0, FRAME);

    const houseWestEdge = house!.x - 0.5;
    expect(model.hero.x + HERO_RADIUS).toBeLessThanOrEqual(houseWestEdge);
    expect(model.hero.x).toBeGreaterThan(house!.x - 1.5); // it did actually walk up to the house
  });

  it('ignores non-positive dt', () => {
    const model = new GameModel(1);
    const { x, y, z } = model.hero;
    model.update(1, 0, -0.01);
    model.update(1, 0, 0);
    expect(model.hero).toEqual({ x, y, z });
  });
});

describe('bush collision', () => {
  // Bushes block only their foliage, not their whole tile: the hero should
  // walk right up to the leaves.
  it('stops the hero at the bush foliage, not the tile edge', () => {
    const model = new GameModel(1);
    const isSolid = solidCellCheck(model);
    const bush = model.bushes.find((b) => !isSolid(b.x - 1, b.z) && !isSolid(b.x - 2, b.z));
    expect(bush).toBeDefined();

    model.hero.x = bush!.x - 2;
    model.hero.z = bush!.z;
    for (let i = 0; i < 120; i++) model.update(1, 0, FRAME);

    const foliageEdge = bush!.x - BUSH_COLLISION_HALF;
    expect(model.hero.x + HERO_RADIUS).toBeLessThanOrEqual(foliageEdge);
    expect(model.hero.x + HERO_RADIUS).toBeGreaterThan(foliageEdge - 0.1); // got right up to it
  });
});

describe('tree collision', () => {
  // Trees block only their trunk: the hero walks under the canopy up to the trunk.
  it('stops the hero at the trunk, not the tile edge', () => {
    const model = new GameModel(1);
    const isSolid = solidCellCheck(model);
    const tree = model.trees.find((t) => !isSolid(t.x - 1, t.z) && !isSolid(t.x - 2, t.z));
    expect(tree).toBeDefined();

    model.hero.x = tree!.x - 2;
    model.hero.z = tree!.z;
    for (let i = 0; i < 120; i++) model.update(1, 0, FRAME);

    const trunkEdge = tree!.x - TREE_COLLISION_HALF;
    expect(model.hero.x + HERO_RADIUS).toBeLessThanOrEqual(trunkEdge);
    expect(model.hero.x + HERO_RADIUS).toBeGreaterThan(trunkEdge - 0.1);
  });
});

describe('hero hop', () => {
  it('arcs above the upper tier when stepping up, and lands on it even after input stops', () => {
    const model = new GameModel(1);
    const isSolid = solidCellCheck(model);

    // Find open ground where the tile to the east is exactly one tier higher.
    let start: { x: number; z: number } | undefined;
    for (let x = 1; x < MAP_WIDTH - 2 && !start; x++) {
      for (let z = 1; z < MAP_DEPTH - 1 && !start; z++) {
        const stepsUp = model.heightMap[x + 1][z] === model.heightMap[x][z] + 1;
        if (stepsUp && !isSolid(x, z) && !isSolid(x + 1, z)) start = { x, z };
      }
    }
    expect(start).toBeDefined();

    model.hero.x = start!.x;
    model.hero.z = start!.z;
    model.hero.y = model.getGroundY(start!.x, start!.z);
    const upperY = (model.heightMap[start!.x][start!.z] + 1) * TILE_HEIGHT;

    let maxY = model.hero.y;
    // Walk just past the tile boundary, then release input mid-hop.
    for (let i = 0; i < 9; i++) {
      model.update(1, 0, FRAME);
      maxY = Math.max(maxY, model.hero.y);
    }
    for (let i = 0; i < 30; i++) {
      model.update(0, 0, FRAME);
      maxY = Math.max(maxY, model.hero.y);
    }

    expect(maxY).toBeGreaterThan(upperY);
    expect(model.hero.y).toBeCloseTo(upperY, 10);
  });
});

describe('road surface', () => {
  it('the hero stands on top of village cobbles, not sunk into them', () => {
    const model = new GameModel(1);
    const village = model.villages[0];
    const x = village.x + 1; // open square tile right next to the well
    const z = village.z;
    expect(model.getGroundY(x, z)).toBeCloseTo(village.groundTier * TILE_HEIGHT + ROAD_SURFACE_HEIGHT, 10);
  });

  it('stepping onto the road eases up gently, without the terrain-step hop arc', () => {
    const model = new GameModel(1);
    const [spawnX, spawnZ] = model.trails[0][0];
    const grassY = model.heightMap[spawnX][spawnZ] * TILE_HEIGHT;
    // Start on the grass margin of the spawn tile, then step onto the road band.
    model.hero.x = spawnX;
    model.hero.z = spawnZ - 0.4;
    model.hero.y = model.getGroundY(model.hero.x, model.hero.z);
    expect(model.hero.y).toBeCloseTo(grassY, 10);

    let maxY = model.hero.y;
    for (let i = 0; i < 40; i++) {
      model.update(0, 1, FRAME / 4);
      maxY = Math.max(maxY, model.hero.y);
    }
    for (let i = 0; i < 30; i++) model.update(0, 0, FRAME);

    expect(model.hero.y).toBeCloseTo(grassY + ROAD_SURFACE_HEIGHT, 10);
    expect(maxY).toBeLessThan(grassY + ROAD_SURFACE_HEIGHT + HOP_HEIGHT / 2); // no big arc
  });
});

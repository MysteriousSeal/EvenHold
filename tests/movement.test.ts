import { describe, it, expect } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { HERO_RADIUS, MAP_WIDTH, MAP_DEPTH, TILE_HEIGHT } from '../src/model/constants';
import { cellKey } from '../src/model/grid';
import { solidCells } from '../src/model/worldgen/world';

const FRAME = 1 / 60;

// Same solid-tile rule the game uses (water, houses, wells), so this can't drift from it.
function solidCellCheck(model: GameModel): (x: number, z: number) => boolean {
  const solid = solidCells(model.houses, model.villages);
  return (x, z) => model.lakeMap[x][z] || solid.has(cellKey(x, z));
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

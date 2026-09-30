// What blocks walking and sight (obstacles.ts), on a small map of its own,
// and the grid everything's laid out on (grid.ts).
import { describe, expect, it } from 'vitest';
import { Obstacles, clearLine } from '../src/model/obstacles';
import { NEIGHBORS_4, cellKey, cellLookup, inBounds, sizeOf, spawnOf, toCellX, toCellZ } from '../src/model/grid';

const SIZE = { width: 12, depth: 12 };
const R = 0.2; // a walker's half-width

// A map with a pond at (2, 2), a wall at (5, 5), a bush (a prop) at (8, 8), a low campfire at (8, 3).
function map(): Obstacles {
  const lakes = Array.from({ length: SIZE.width }, () => Array(SIZE.depth).fill(false));
  lakes[2][2] = true;
  const obstacles = new Obstacles(SIZE, lakes, new Set([cellKey(5, 5)]));
  obstacles.addProp(8, 8, 0.25);
  obstacles.addProp(8, 3, 0.2, true);
  return obstacles;
}

describe('the grid', () => {
  it('knows what is on the map', () => {
    expect(inBounds(SIZE, 0, 0)).toBe(true);
    expect(inBounds(SIZE, 11, 11)).toBe(true);
    for (const [x, z] of [[-1, 0], [0, -1], [12, 0], [0, 12]]) expect(inBounds(SIZE, x, z)).toBe(false);
  });

  it('starts the hero in the middle', () => {
    expect(spawnOf(SIZE)).toEqual({ x: 6, z: 6 });
    expect(spawnOf({ width: 7, depth: 9 })).toEqual({ x: 3, z: 4 });
  });

  it('measures a map', () => {
    expect(sizeOf([[1, 2, 3], [4, 5, 6]])).toEqual({ width: 2, depth: 3 });
    expect(sizeOf([])).toEqual({ width: 0, depth: 0 });
  });

  it('has four neighbours, one on each side', () => {
    expect(NEIGHBORS_4).toHaveLength(4);
    expect(new Set(NEIGHBORS_4.map(([x, z]) => `${x},${z}`)).size).toBe(4);
    for (const [x, z] of NEIGHBORS_4) expect(Math.abs(x) + Math.abs(z)).toBe(1);
  });

  it.each([
    [0.4, 0],
    [0.6, 1],
    [-3, 0],
    [99, 11],
    [5.5, 6],
  ])('puts x %f in column %i (on the map)', (x, column) => {
    expect(toCellX(SIZE, x)).toBe(column);
    expect(toCellZ(SIZE, x)).toBe(column);
  });

  it('looks cells up as a set would, off the map none', () => {
    const lookup = cellLookup(SIZE, ['1,2', '3,4', '50,50']);
    expect(lookup(1, 2)).toBe(true);
    expect(lookup(3, 4)).toBe(true);
    expect(lookup(2, 1)).toBe(false);
    expect(lookup(50, 50)).toBe(false);
    expect(lookup(-1, 2)).toBe(false);
  });
});

describe('obstacles', () => {
  it('keep water, walls and props from being stood on, open ground not', () => {
    const o = map();
    expect(o.isOpenTile(2, 2)).toBe(false); // the pond
    expect(o.isOpenTile(5, 5)).toBe(false); // the wall
    expect(o.isOpenTile(8, 8)).toBe(false); // the bush
    expect(o.isOpenTile(1, 1)).toBe(true);
    expect(o.isOpenTile(-1, 1)).toBe(false); // off the map
  });

  it('block a walker anywhere over water or a wall, even a corner of them', () => {
    const o = map();
    expect(o.isBlocked(2, 2, R)).toBe(true);
    expect(o.isBlocked(5, 5, R)).toBe(true);
    expect(o.isBlocked(5.5 + R - 0.01, 5, R)).toBe(true); // just its corner over the wall's edge
    expect(o.isBlocked(5.5 + R + 0.01, 5, R)).toBe(false); // just clear of it
  });

  it('block only the square a prop covers, not its whole tile', () => {
    const o = map();
    expect(o.isBlocked(8, 8, R)).toBe(true);
    expect(o.isBlocked(8 + 0.25 + R + 0.01, 8, R)).toBe(false); // beside the bush, in its tile
  });

  it('let the eye pass over water and a low fire, not a wall or a bush', () => {
    const o = map();
    expect(o.blocksSight(2, 2)).toBe(false);
    expect(o.blocksSight(8, 3)).toBe(false); // low
    expect(o.isBlocked(8, 3, R)).toBe(true); // …but still in the way
    expect(o.blocksSight(5, 5)).toBe(true);
    expect(o.blocksSight(8, 8)).toBe(true);
    expect(o.blocksSight(8.45, 8)).toBe(false); // beside the bush
  });

  it.each([0, 1, 2, 3])('put a fence along side %i of a tile, blocking that edge only', (side) => {
    const o = map();
    o.addFenceStrip(3, 8, side, 0.1);
    const [dx, dz] = NEIGHBORS_4[side];
    expect(o.isBlocked(3 + dx * 0.45, 8 + dz * 0.45, 0.05)).toBe(true); // at that edge
    expect(o.blocksSight(3 + dx * 0.45, 8 + dz * 0.45)).toBe(true);
    expect(o.isBlocked(3 - dx * 0.3, 8 - dz * 0.3, 0.05)).toBe(false); // the other side of the tile
    expect(o.isOpenTile(3, 8)).toBe(true); // (a fence leaves the tile to stand in)
  });
});

describe('a clear line', () => {
  const o = map();
  const free = (x: number, z: number) => !o.isBlocked(x, z, R);

  it('runs across open ground', () => {
    expect(clearLine({ x: 1, z: 1 }, { x: 1, z: 10 }, free)).toBe(true);
  });

  it('stops at a wall in between', () => {
    expect(clearLine({ x: 3, z: 5 }, { x: 7, z: 5 }, free)).toBe(false);
  });

  it('is clear from a point to itself', () => {
    expect(clearLine({ x: 5, z: 5 }, { x: 5, z: 5 }, free)).toBe(true);
  });

  it('checks finely enough, with a fine step, to catch a thin fence', () => {
    const fenced = map();
    fenced.addFenceStrip(10, 5, 0, 0.05);
    const fine = (x: number, z: number) => !fenced.blocksSight(x, z);
    expect(clearLine({ x: 9, z: 5 }, { x: 11, z: 5 }, fine, 0.02)).toBe(false);
  });
});

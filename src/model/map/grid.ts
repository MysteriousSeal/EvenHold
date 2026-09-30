import { MAP_DEPTH, MAP_WIDTH } from '../constants';

// A world's size in tiles. Every map in a world (heights, lakes, surfaces)
// is indexed [x][z] with these dimensions.
export interface MapSize {
  width: number;
  depth: number;
}

export const DEFAULT_MAP_SIZE: MapSize = { width: MAP_WIDTH, depth: MAP_DEPTH };

export function sizeOf(map: readonly (readonly unknown[])[]): MapSize {
  return { width: map.length, depth: map[0]?.length ?? 0 };
}

// The hero starts at the center of the map.
export function spawnOf(size: MapSize): { x: number; z: number } {
  return { x: Math.floor(size.width / 2), z: Math.floor(size.depth / 2) };
}

export const NEIGHBORS_4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function inBounds(size: MapSize, x: number, z: number): boolean {
  return x >= 0 && x < size.width && z >= 0 && z < size.depth;
}

export function cellKey(x: number, z: number): string {
  return `${x},${z}`;
}

// A fast lookup for a set of "x,z" cell keys, as a flat grid: on big maps,
// building a key string for every tile to test against a Set is slow.
export function cellLookup(size: MapSize, keys: Iterable<string>): (x: number, z: number) => boolean {
  const grid = new Uint8Array(size.width * size.depth);
  for (const key of keys) {
    const [x, z] = key.split(',').map(Number);
    if (inBounds(size, x, z)) grid[x * size.depth + z] = 1;
  }
  return (x, z) => inBounds(size, x, z) && grid[x * size.depth + z] === 1;
}

// Continuous world coordinate -> index of the grid cell it falls in, clamped to the map.
export function toCellX(size: MapSize, x: number): number {
  return Math.min(size.width - 1, Math.max(0, Math.round(x)));
}

export function toCellZ(size: MapSize, z: number): number {
  return Math.min(size.depth - 1, Math.max(0, Math.round(z)));
}

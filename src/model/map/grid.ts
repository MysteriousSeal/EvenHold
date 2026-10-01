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

// The way something turned `quarterTurns` faces (its local +Z turned so, as the view turns its models):
// 0 +z, 1 +x, 2 -z, 3 -x.
export const FACINGS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
];

// Which of NEIGHBORS_4 a step (dx, dz) is.
export const sideOf = (dx: number, dz: number): number => NEIGHBORS_4.findIndex(([nx, nz]) => nx === dx && nz === dz);

// The tiles reached from `from`, step by step (four ways), through those `open`: "x,z" keys.
export function flood(from: ReadonlyArray<readonly [number, number]>, open: (x: number, z: number) => boolean): Set<string> {
  const seen = new Set<string>();
  const todo = from.map(([x, z]): [number, number] => [x, z]);
  while (todo.length > 0) {
    const [x, z] = todo.pop()!;
    const key = cellKey(x, z);
    if (seen.has(key) || !open(x, z)) continue;
    seen.add(key);
    for (const [dx, dz] of NEIGHBORS_4) todo.push([x + dx, z + dz]);
  }
  return seen;
}

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

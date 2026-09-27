import { MAP_WIDTH, MAP_DEPTH } from './constants';

export const NEIGHBORS_4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function inBounds(x: number, z: number): boolean {
  return x >= 0 && x < MAP_WIDTH && z >= 0 && z < MAP_DEPTH;
}

export function cellKey(x: number, z: number): string {
  return `${x},${z}`;
}

// Continuous world coordinate -> index of the grid cell it falls in, clamped to the map.
export function toCellX(x: number): number {
  return Math.min(MAP_WIDTH - 1, Math.max(0, Math.round(x)));
}

export function toCellZ(z: number): number {
  return Math.min(MAP_DEPTH - 1, Math.max(0, Math.round(z)));
}

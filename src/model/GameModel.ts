// Model: owns game state and rules. No rendering, no input handling.

import { createNoise2D } from 'simplex-noise';
import { mulberry32 } from '../util/random';

export const MAP_WIDTH = 40;
export const MAP_DEPTH = 40;
export const HERO_SPEED = 4; // units per second
export const MAX_HEIGHT = 4;
export const WATER_LEVEL = 1; // tiers at or below this are low ground; only some of it floods
export const NOISE_SCALE = 12; // wavelength of the base terrain features
export const LAKE_NOISE_SCALE = 22; // wavelength of the lake mask (large, contiguous blobs)
export const LAKE_THRESHOLD_MIN = -0.3; // low threshold => most low ground floods (lake-heavy world)
export const LAKE_THRESHOLD_MAX = 0.6; // high threshold => almost no low ground floods (dry world)
export const MIN_LAKE_SIZE = 6; // lake blobs smaller than this many connected tiles are dropped
export const TREE_CHANCE = 0.08; // probability a given eligible cell grows a tree

export interface Hero {
  x: number;
  z: number;
  y: number;
}

export interface Tree {
  x: number;
  z: number;
  groundHeight: number;
  rotationY: number;
  scale: number;
}

export class GameModel {
  readonly seed: number;
  readonly heightMap: number[][];
  readonly lakeMap: boolean[][];
  readonly trees: Tree[];
  readonly hero: Hero;

  constructor(seed: number) {
    this.seed = seed;

    const rng = mulberry32(seed);
    const noise2D = createNoise2D(rng);

    // How lake-prone this particular world is — drawn once per seed, so some
    // seeds are dotted with lakes and others are nearly dry.
    const lakeThreshold = LAKE_THRESHOLD_MIN + rng() * (LAKE_THRESHOLD_MAX - LAKE_THRESHOLD_MIN);

    this.heightMap = GameModel.generateHeightMap(noise2D);
    GameModel.smoothHeightMap(this.heightMap);

    const spawnX = Math.floor(MAP_WIDTH / 2);
    const spawnZ = Math.floor(MAP_DEPTH / 2);

    // The spawn point must stay dry, but forcing its height up after
    // smoothing (or clearing just its lakeMap cell) would carve a single
    // tile out of an otherwise-uniform area — exactly the "impossible" hole
    // this basin-flood approach exists to prevent. Instead, whichever basin
    // the spawn cell belongs to (if any) simply never floods.
    this.lakeMap = GameModel.generateLakeMap(this.heightMap, noise2D, lakeThreshold, spawnX, spawnZ);
    this.trees = GameModel.generateTrees(this.heightMap, this.lakeMap, rng);

    this.hero = { x: spawnX, z: spawnZ, y: 0 };
    this.hero.y = this.getHeightAt(this.hero.x, this.hero.z);
  }

  private static generateHeightMap(noise2D: (x: number, y: number) => number): number[][] {
    const map: number[][] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      const row: number[] = [];
      for (let z = 0; z < MAP_DEPTH; z++) {
        const base = noise2D(x / NOISE_SCALE, z / NOISE_SCALE);
        const detail = noise2D(x / (NOISE_SCALE / 3), z / (NOISE_SCALE / 3)) * 0.3;
        const normalized = Math.min(1, Math.max(0, (base + detail + 1.3) / 2.6));
        const h = Math.min(MAX_HEIGHT, Math.floor(normalized * (MAX_HEIGHT + 1)));
        row.push(h);
      }
      map.push(row);
    }
    return map;
  }

  // Caps the height difference between orthogonal neighbors at 1 tier, in
  // place. Raw noise occasionally drops a single cell 2+ tiers below every
  // neighbor (or spikes one above), producing a walled-in pit or a lone
  // tower after flooring to integer tiers. This fills/shaves those outliers
  // so every step in the terrain is walkable.
  //
  // Each pass sweeps in-place (Gauss-Seidel style), so a height correction
  // only propagates in the direction of the sweep within a single pass.
  // Alternating the sweep direction every iteration lets corrections
  // propagate both ways, so the grid reaches a fully stable state (no
  // violations left anywhere) in a handful of passes instead of needing one
  // pass per row/column of the map.
  private static smoothHeightMap(map: number[][]): void {
    const offsets: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    for (let iteration = 0; iteration < 16; iteration++) {
      let changed = false;
      const reverse = iteration % 2 === 1;

      for (let xi = 0; xi < MAP_WIDTH; xi++) {
        const x = reverse ? MAP_WIDTH - 1 - xi : xi;
        for (let zi = 0; zi < MAP_DEPTH; zi++) {
          const z = reverse ? MAP_DEPTH - 1 - zi : zi;

          const neighborHeights: number[] = [];
          for (const [dx, dz] of offsets) {
            const nx = x + dx;
            const nz = z + dz;
            if (nx >= 0 && nx < MAP_WIDTH && nz >= 0 && nz < MAP_DEPTH) {
              neighborHeights.push(map[nx][nz]);
            }
          }
          if (neighborHeights.length === 0) continue;

          const minNeighbor = Math.min(...neighborHeights);
          const maxNeighbor = Math.max(...neighborHeights);
          const h = map[x][z];

          // h must be within 1 of every neighbor at once, i.e. within
          // [maxNeighbor - 1, minNeighbor + 1]. Checking only against the
          // aggregate min/max (the old approach) misses a cell sitting
          // "between" two neighbors that are themselves far apart — e.g.
          // heights 0, 2, 4 in a row: the middle 2 looks fine against the
          // {0, 4} range but is still 2 away from each individually.
          const targetLow = maxNeighbor - 1;
          const targetHigh = minNeighbor + 1;

          let next: number;
          if (targetLow <= targetHigh) {
            next = Math.min(targetHigh, Math.max(targetLow, h));
          } else {
            // The neighbors themselves are more than 2 apart, so no single h
            // can satisfy both; nudge toward their midpoint and let the
            // neighbors converge toward each other over later passes.
            next = Math.round((minNeighbor + maxNeighbor) / 2);
          }

          if (next !== h) {
            changed = true;
            map[x][z] = next;
          }
        }
      }

      if (!changed) break;
    }
  }

  // Water physically can't flood part of a connected low-lying basin and
  // leave the rest dry — it finds its own level. So instead of deciding
  // per-cell, this flood-fills every connected group of cells at or below
  // WATER_LEVEL (4-directional) and makes ONE flood/no-flood decision for
  // the whole basin: the average of a low-frequency "lake blob" noise
  // sampled across the basin's cells against the seed's lake threshold.
  // Basins under MIN_LAKE_SIZE never flood, avoiding puddle-sized clutter.
  private static generateLakeMap(
    heightMap: number[][],
    noise2D: (x: number, y: number) => number,
    lakeThreshold: number,
    spawnX: number,
    spawnZ: number,
  ): boolean[][] {
    const map: boolean[][] = heightMap.map((row) => row.map(() => false));
    const visited: boolean[][] = heightMap.map((row) => row.map(() => false));
    const offsets: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    for (let x = 0; x < MAP_WIDTH; x++) {
      for (let z = 0; z < MAP_DEPTH; z++) {
        if (heightMap[x][z] > WATER_LEVEL || visited[x][z]) continue;

        const basin: Array<[number, number]> = [];
        const stack: Array<[number, number]> = [[x, z]];
        visited[x][z] = true;

        while (stack.length > 0) {
          const [cx, cz] = stack.pop()!;
          basin.push([cx, cz]);

          for (const [dx, dz] of offsets) {
            const nx = cx + dx;
            const nz = cz + dz;
            if (
              nx >= 0 &&
              nx < MAP_WIDTH &&
              nz >= 0 &&
              nz < MAP_DEPTH &&
              heightMap[nx][nz] <= WATER_LEVEL &&
              !visited[nx][nz]
            ) {
              visited[nx][nz] = true;
              stack.push([nx, nz]);
            }
          }
        }

        const containsSpawn = basin.some(([cx, cz]) => cx === spawnX && cz === spawnZ);
        if (basin.length < MIN_LAKE_SIZE || containsSpawn) continue;

        let blobSum = 0;
        for (const [cx, cz] of basin) {
          blobSum += noise2D(cx / LAKE_NOISE_SCALE + 500, cz / LAKE_NOISE_SCALE + 500);
        }
        const blobAverage = blobSum / basin.length;

        if (blobAverage > lakeThreshold) {
          for (const [cx, cz] of basin) map[cx][cz] = true;
        }
      }
    }

    return map;
  }

  // Reuses the same rng stream right after height-map generation, so tree
  // placement stays fully determined by the seed.
  private static generateTrees(heightMap: number[][], lakeMap: boolean[][], rng: () => number): Tree[] {
    const trees: Tree[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      for (let z = 0; z < MAP_DEPTH; z++) {
        const h = heightMap[x][z];
        const roll = rng();
        // Skip lakes, skip the highest tier (bare summit), skip the hero's spawn cell.
        const isSpawn = x === Math.floor(MAP_WIDTH / 2) && z === Math.floor(MAP_DEPTH / 2);
        if (!lakeMap[x][z] && h < MAX_HEIGHT && !isSpawn && roll < TREE_CHANCE) {
          const rotationY = rng() * Math.PI * 2;
          const scale = 0.85 + rng() * 0.3;
          trees.push({ x, z, groundHeight: h, rotationY, scale });
        }
      }
    }
    return trees;
  }

  getHeightAt(x: number, z: number): number {
    const cx = Math.min(MAP_WIDTH - 1, Math.max(0, Math.round(x)));
    const cz = Math.min(MAP_DEPTH - 1, Math.max(0, Math.round(z)));
    return this.heightMap[cx][cz];
  }

  isWater(x: number, z: number): boolean {
    const cx = Math.min(MAP_WIDTH - 1, Math.max(0, Math.round(x)));
    const cz = Math.min(MAP_DEPTH - 1, Math.max(0, Math.round(z)));
    return this.lakeMap[cx][cz];
  }

  // dirX/dirZ: world-space direction (not necessarily normalized), dt: seconds
  move(dirX: number, dirZ: number, dt: number): void {
    const len = Math.hypot(dirX, dirZ);
    if (len < 1e-6) return;

    const nx = dirX / len;
    const nz = dirZ / len;
    const dist = HERO_SPEED * dt;

    const margin = 0.4;
    const candidateX = Math.min(MAP_WIDTH - 1 - margin, Math.max(margin, this.hero.x + nx * dist));
    const candidateZ = Math.min(MAP_DEPTH - 1 - margin, Math.max(margin, this.hero.z + nz * dist));

    // Axis-separated collision against water so the hero can slide along a shoreline
    // instead of getting stuck the instant either component would enter a lake.
    if (!this.isWater(candidateX, this.hero.z)) this.hero.x = candidateX;
    if (!this.isWater(this.hero.x, candidateZ)) this.hero.z = candidateZ;

    this.hero.y = this.getHeightAt(this.hero.x, this.hero.z);
  }
}

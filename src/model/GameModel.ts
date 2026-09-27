// Model: owns game state and rules. No rendering, no input handling.
// Generation is delegated to terrain.ts / lakes.ts / trees.ts; this class
// wires them together from a seed and exposes the runtime API (movement,
// lookups) the controller and view use every frame.

import { createNoise2D } from 'simplex-noise';
import { mulberry32 } from '../util/random';
import { MAP_WIDTH, MAP_DEPTH, HERO_SPEED, LAKE_THRESHOLD_MIN, LAKE_THRESHOLD_MAX, SPAWN_X, SPAWN_Z } from './constants';
import type { Hero, Tree, House } from './types';
import { generateHeightMap, smoothHeightMap } from './terrain';
import { generateLakeMap } from './lakes';
import { generateVillages } from './villages';
import { generateTrees } from './trees';

export class GameModel {
  readonly seed: number;
  readonly heightMap: number[][];
  readonly lakeMap: boolean[][];
  readonly houses: House[];
  readonly trees: Tree[];
  readonly hero: Hero;

  private readonly houseCells: ReadonlySet<string>;

  constructor(seed: number) {
    this.seed = seed;

    const rng = mulberry32(seed);
    const noise2D = createNoise2D(rng);

    // How lake-prone this particular world is — drawn once per seed, so some
    // seeds are dotted with lakes and others are nearly dry.
    const lakeThreshold = LAKE_THRESHOLD_MIN + rng() * (LAKE_THRESHOLD_MAX - LAKE_THRESHOLD_MIN);

    this.heightMap = generateHeightMap(noise2D);
    smoothHeightMap(this.heightMap);

    this.lakeMap = generateLakeMap(this.heightMap, noise2D, lakeThreshold, SPAWN_X, SPAWN_Z);
    this.houses = generateVillages(this.heightMap, this.lakeMap, rng, SPAWN_X, SPAWN_Z);
    this.houseCells = new Set(this.houses.map((house) => `${house.x},${house.z}`));
    this.trees = generateTrees(this.heightMap, this.lakeMap, this.houseCells, rng, SPAWN_X, SPAWN_Z);

    this.hero = { x: SPAWN_X, z: SPAWN_Z, y: 0 };
    this.hero.y = this.getHeightAt(this.hero.x, this.hero.z);
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

  isHouse(x: number, z: number): boolean {
    const cx = Math.min(MAP_WIDTH - 1, Math.max(0, Math.round(x)));
    const cz = Math.min(MAP_DEPTH - 1, Math.max(0, Math.round(z)));
    return this.houseCells.has(`${cx},${cz}`);
  }

  private isBlocked(x: number, z: number): boolean {
    return this.isWater(x, z) || this.isHouse(x, z);
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

    // Axis-separated collision (against water and houses) so the hero can
    // slide along an obstacle's edge instead of getting stuck the instant
    // either component alone would move into it.
    if (!this.isBlocked(candidateX, this.hero.z)) this.hero.x = candidateX;
    if (!this.isBlocked(this.hero.x, candidateZ)) this.hero.z = candidateZ;

    this.hero.y = this.getHeightAt(this.hero.x, this.hero.z);
  }
}

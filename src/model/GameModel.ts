// Model: owns game state and rules. No rendering, no input handling.
// World generation lives in worldgen/; this class holds the generated world
// plus the hero, and exposes the per-frame runtime API (movement, lookups).

import { MAP_WIDTH, MAP_DEPTH, HERO_SPEED, HERO_RADIUS, SPAWN_X, SPAWN_Z } from './constants';
import { cellKey, toCellX, toCellZ } from './grid';
import type { Hero, Tree, House } from './types';
import { generateWorld } from './worldgen/world';

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

    const world = generateWorld(seed);
    this.heightMap = world.heightMap;
    this.lakeMap = world.lakeMap;
    this.houses = world.houses;
    this.trees = world.trees;
    this.houseCells = new Set(this.houses.map((house) => cellKey(house.x, house.z)));

    this.hero = { x: SPAWN_X, z: SPAWN_Z, y: 0 };
    this.hero.y = this.getHeightAt(this.hero.x, this.hero.z);
  }

  getHeightAt(x: number, z: number): number {
    return this.heightMap[toCellX(x)][toCellZ(z)];
  }

  private isSolidCell(x: number, z: number): boolean {
    const cx = toCellX(x);
    const cz = toCellZ(z);
    return this.lakeMap[cx][cz] || this.houseCells.has(cellKey(cx, cz));
  }

  // Tests all four corners of the hero's square footprint, not just its
  // center — a center-only check lets the hero's body sink halfway into a
  // house or water tile before the center crosses the cell boundary.
  private isBlocked(x: number, z: number): boolean {
    const r = HERO_RADIUS;
    return (
      this.isSolidCell(x - r, z - r) ||
      this.isSolidCell(x + r, z - r) ||
      this.isSolidCell(x - r, z + r) ||
      this.isSolidCell(x + r, z + r)
    );
  }

  // dirX/dirZ: world-space direction (not necessarily normalized), dt: seconds
  move(dirX: number, dirZ: number, dt: number): void {
    const len = Math.hypot(dirX, dirZ);
    if (len < 1e-6 || dt <= 0) return;

    const dist = HERO_SPEED * dt;
    const margin = 0.4;
    const candidateX = Math.min(MAP_WIDTH - 1 - margin, Math.max(margin, this.hero.x + (dirX / len) * dist));
    const candidateZ = Math.min(MAP_DEPTH - 1 - margin, Math.max(margin, this.hero.z + (dirZ / len) * dist));

    // Axis-separated so the hero slides along an obstacle's edge instead of
    // stopping dead the instant either component alone would move into it.
    if (!this.isBlocked(candidateX, this.hero.z)) this.hero.x = candidateX;
    if (!this.isBlocked(this.hero.x, candidateZ)) this.hero.z = candidateZ;

    this.hero.y = this.getHeightAt(this.hero.x, this.hero.z);
  }
}

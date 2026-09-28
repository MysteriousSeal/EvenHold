// Model: owns game state and rules. No rendering, no input handling.
// World generation lives in worldgen/; this class holds the generated world
// plus the hero, and exposes the per-frame runtime API (movement, lookups).

import {
  MAP_WIDTH,
  MAP_DEPTH,
  HERO_SPEED,
  HERO_RADIUS,
  HOP_DURATION,
  HOP_HEIGHT,
  SPAWN_X,
  SPAWN_Z,
  TILE_HEIGHT,
} from './constants';
import { cellKey, toCellX, toCellZ } from './grid';
import type { Hero, Tree, House, Surface, Village } from './types';
import { generateWorld, solidCells } from './worldgen/world';

export class GameModel {
  readonly seed: number;
  readonly heightMap: number[][];
  readonly lakeMap: boolean[][];
  readonly surfaceMap: Surface[][];
  readonly trails: Array<Array<[number, number]>>;
  readonly villages: Village[];
  readonly houses: House[];
  readonly trees: Tree[];
  readonly hero: Hero;

  private readonly solidCells: ReadonlySet<string>;
  private hop: { fromY: number; toY: number; elapsed: number } | null = null;

  constructor(seed: number) {
    this.seed = seed;

    const world = generateWorld(seed);
    this.heightMap = world.heightMap;
    this.lakeMap = world.lakeMap;
    this.surfaceMap = world.surfaceMap;
    this.trails = world.trails;
    this.villages = world.villages;
    this.houses = world.houses;
    this.trees = world.trees;
    this.solidCells = solidCells(this.houses, this.villages);

    this.hero = { x: SPAWN_X, z: SPAWN_Z, y: 0 };
    this.hero.y = this.getGroundY(this.hero.x, this.hero.z);
  }

  // Ground surface height in world units (the height map itself is in tiers).
  getGroundY(x: number, z: number): number {
    return this.heightMap[toCellX(x)][toCellZ(z)] * TILE_HEIGHT;
  }

  private isSolidCell(x: number, z: number): boolean {
    const cx = toCellX(x);
    const cz = toCellZ(z);
    return this.lakeMap[cx][cz] || this.solidCells.has(cellKey(cx, cz));
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

  // Advances the hero one frame. dirX/dirZ: world-space input direction
  // (not necessarily normalized, zero when idle); dt: seconds.
  update(dirX: number, dirZ: number, dt: number): void {
    if (dt <= 0) return;
    this.moveHorizontally(dirX, dirZ, dt);
    // Runs even with no input, so a hop started just before the player let
    // go still finishes instead of freezing mid-air.
    this.updateHop(dt);
  }

  private moveHorizontally(dirX: number, dirZ: number, dt: number): void {
    const len = Math.hypot(dirX, dirZ);
    if (len < 1e-6) return;

    const dist = HERO_SPEED * dt;
    const margin = 0.4;
    const candidateX = Math.min(MAP_WIDTH - 1 - margin, Math.max(margin, this.hero.x + (dirX / len) * dist));
    const candidateZ = Math.min(MAP_DEPTH - 1 - margin, Math.max(margin, this.hero.z + (dirZ / len) * dist));

    // Axis-separated so the hero slides along an obstacle's edge instead of
    // stopping dead the instant either component alone would move into it.
    if (!this.isBlocked(candidateX, this.hero.z)) this.hero.x = candidateX;
    if (!this.isBlocked(this.hero.x, candidateZ)) this.hero.z = candidateZ;
  }

  // Whenever the ground under the hero changes tier, hop to it along an arc:
  // a straight line from the old height to the new one, plus a parabola that
  // peaks HOP_HEIGHT above that line halfway through. Stepping onto another
  // tier mid-hop restarts the hop from the current height, so rapid
  // multi-step climbs stay continuous.
  private updateHop(dt: number): void {
    const groundY = this.getGroundY(this.hero.x, this.hero.z);
    const currentTarget = this.hop ? this.hop.toY : this.hero.y;
    if (groundY !== currentTarget) {
      this.hop = { fromY: this.hero.y, toY: groundY, elapsed: 0 };
    }
    if (!this.hop) return;

    this.hop.elapsed += dt;
    const p = Math.min(1, this.hop.elapsed / HOP_DURATION);
    const { fromY, toY } = this.hop;
    this.hero.y = fromY + (toY - fromY) * p + HOP_HEIGHT * 4 * p * (1 - p);

    if (p >= 1) this.hop = null;
  }
}

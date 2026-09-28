// Model: owns game state and rules. No rendering, no input handling.
// World generation lives in worldgen/; this class holds the generated world
// plus the hero, and exposes the per-frame runtime API (movement, lookups).

import {
  HERO_SPEED,
  HERO_RADIUS,
  BUSH_COLLISION_HALF,
  TREE_COLLISION_HALF,
  FENCE_THICKNESS,
  HOP_DURATION,
  HOP_HEIGHT,
  TILE_HEIGHT,
  ROAD_SURFACE_HEIGHT,
} from './constants';
import { DEFAULT_MAP_SIZE, NEIGHBORS_4, cellKey, inBounds, spawnOf, toCellX, toCellZ, type MapSize } from './grid';
import type { Building, Bush, Field, Hero, Tree, House, Surface, Village } from './types';
import { generateWorld, solidCells } from './worldgen/world';
import { fenceEdges } from './worldgen/fields';
import { onPaving } from './roads';

export class GameModel {
  readonly seed: number;
  readonly size: MapSize;
  readonly heightMap: number[][];
  readonly lakeMap: boolean[][];
  readonly surfaceMap: Surface[][];
  readonly trails: Array<Array<[number, number]>>;
  readonly villages: Village[];
  readonly houses: House[];
  readonly buildings: Building[];
  readonly fields: Field[];
  readonly trees: Tree[];
  readonly bushes: Bush[];
  readonly hero: Hero;

  private readonly solidCells: ReadonlySet<string>; // tiles blocked edge to edge
  // Props smaller than a tile (bushes, tree trunks): tile key -> half-size of
  // the square they block, centered on the tile.
  private readonly propFootprints: ReadonlyMap<string, number>;
  private hop: { fromY: number; toY: number; elapsed: number } | null = null;

  // `size` defaults to the game's map; tests pass small worlds.
  constructor(seed: number, size: MapSize = DEFAULT_MAP_SIZE) {
    this.seed = seed;

    const world = generateWorld(seed, size);
    this.size = world.size;
    this.heightMap = world.heightMap;
    this.lakeMap = world.lakeMap;
    this.surfaceMap = world.surfaceMap;
    this.trails = world.trails;
    this.villages = world.villages;
    this.houses = world.houses;
    this.buildings = world.buildings;
    this.fields = world.fields;
    this.trees = world.trees;
    this.bushes = world.bushes;
    // Houses and wells nearly fill their tile, so they block all of it;
    // bushes and tree trunks are much smaller, so they get their own footprint.
    this.solidCells = solidCells(this);
    this.propFootprints = new Map([
      ...this.bushes.map((b): [string, number] => [cellKey(b.x, b.z), BUSH_COLLISION_HALF]),
      ...this.trees.map((t): [string, number] => [cellKey(t.x, t.z), TREE_COLLISION_HALF]),
    ]);

    for (const field of this.fields) {
      for (const { x, z, side } of fenceEdges(field)) {
        const [dx, dz] = NEIGHBORS_4[side];
        const t = FENCE_THICKNESS;
        const rect: [number, number, number, number] =
          dx !== 0
            ? [dx > 0 ? x + 0.5 - t : x - 0.5, z - 0.5, dx > 0 ? x + 0.5 : x - 0.5 + t, z + 0.5]
            : [x - 0.5, dz > 0 ? z + 0.5 - t : z - 0.5, x + 0.5, dz > 0 ? z + 0.5 : z - 0.5 + t];
        const key = cellKey(x, z);
        this.fences.set(key, [...(this.fences.get(key) ?? []), rect]);
      }
    }

    const spawn = spawnOf(this.size);
    this.hero = { x: spawn.x, z: spawn.z, y: 0 };
    this.hero.y = this.getGroundY(this.hero.x, this.hero.z);
  }

  // Height of whatever the hero would stand on at (x, z), in world units:
  // the tile's tier, plus the road/cobble paving where there is some.
  getGroundY(x: number, z: number): number {
    const tile = this.heightMap[toCellX(this.size, x)][toCellZ(this.size, z)] * TILE_HEIGHT;
    return onPaving(this.surfaceMap, x, z) ? tile + ROAD_SURFACE_HEIGHT : tile;
  }

  // Field fences, as thin axis-aligned rectangles [minX, minZ, maxX, maxZ]
  // along tile edges, keyed by the tile they're in.
  private readonly fences = new Map<string, Array<[number, number, number, number]>>();

  // Dev cheats: movement speed factor (1 = normal).
  speedMultiplier = 1;

  // Moves the hero straight to (x, z), standing on the ground there.
  teleport(x: number, z: number): void {
    this.hero.x = x;
    this.hero.z = z;
    this.hero.y = this.getGroundY(x, z);
    this.hop = null;
  }

  // A tile the hero can stand in the middle of: on the map, dry, and free
  // of houses, wells, trees and bushes.
  isOpenTile(x: number, z: number): boolean {
    const key = cellKey(x, z);
    return inBounds(this.size, x, z) && !this.lakeMap[x][z] && !this.solidCells.has(key) && !this.propFootprints.has(key);
  }

  private isSolidCell(x: number, z: number): boolean {
    const cx = toCellX(this.size, x);
    const cz = toCellZ(this.size, z);
    return this.lakeMap[cx][cz] || this.solidCells.has(cellKey(cx, cz));
  }

  // Tests all four corners of the hero's square footprint, not just its
  // center — a center-only check lets the hero's body sink halfway into a
  // house or water tile before the center crosses the cell boundary.
  private isBlocked(x: number, z: number): boolean {
    const r = HERO_RADIUS;
    const corners: Array<[number, number]> = [
      [x - r, z - r],
      [x + r, z - r],
      [x - r, z + r],
      [x + r, z + r],
    ];
    if (corners.some(([cx, cz]) => this.isSolidCell(cx, cz))) return true;

    // Props: overlap between the hero's square and the prop's smaller
    // square, checked for the prop on every tile the hero's corners touch
    // (a prop square lies inside its tile, so that's the only way to overlap).
    const propHit = corners.some(([cx, cz]) => {
      const px = toCellX(this.size, cx);
      const pz = toCellZ(this.size, cz);
      const half = this.propFootprints.get(cellKey(px, pz));
      return half !== undefined && Math.abs(x - px) < r + half && Math.abs(z - pz) < r + half;
    });
    if (propHit) return true;

    // Fences: the hero's square against the fence strips of every tile its
    // corners touch.
    return corners.some(([cx, cz]) =>
      (this.fences.get(cellKey(toCellX(this.size, cx), toCellZ(this.size, cz))) ?? []).some(
        ([minX, minZ, maxX, maxZ]) => x + r > minX && x - r < maxX && z + r > minZ && z - r < maxZ,
      ),
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

    const dist = HERO_SPEED * this.speedMultiplier * dt;
    const margin = 0.4;
    const candidateX = Math.min(this.size.width - 1 - margin, Math.max(margin, this.hero.x + (dirX / len) * dist));
    const candidateZ = Math.min(this.size.depth - 1 - margin, Math.max(margin, this.hero.z + (dirZ / len) * dist));

    // Axis-separated so the hero slides along an obstacle's edge instead of
    // stopping dead the instant either component alone would move into it.
    if (!this.isBlocked(candidateX, this.hero.z)) this.hero.x = candidateX;
    if (!this.isBlocked(this.hero.x, candidateZ)) this.hero.z = candidateZ;
  }

  // Whenever the ground height under the hero changes, move to it over a
  // short time: a straight line from the old height to the new one, plus —
  // for a real terrain step — a parabola peaking HOP_HEIGHT above that line
  // halfway through. A new change mid-move restarts from the current
  // height, so rapid multi-step climbs stay continuous.
  private updateHop(dt: number): void {
    const groundY = this.getGroundY(this.hero.x, this.hero.z);
    const currentTarget = this.hop ? this.hop.toY : this.hero.y;
    if (groundY !== currentTarget) {
      this.hop = { fromY: this.hero.y, toY: groundY, elapsed: 0 };
    }
    if (!this.hop) return;

    // Small height changes (stepping onto a road's paving) just ease up or
    // down quickly; only a real terrain step gets the full arcing hop. The
    // cut-off sits between the paving height (0.08) and a tier (0.15).
    const { fromY, toY } = this.hop;
    const isStep = Math.abs(toY - fromY) >= TILE_HEIGHT * 0.75;
    const duration = isStep ? HOP_DURATION : HOP_DURATION / 2;
    const arc = isStep ? HOP_HEIGHT : 0;

    this.hop.elapsed += dt;
    const p = Math.min(1, this.hop.elapsed / duration);
    this.hero.y = fromY + (toY - fromY) * p + arc * 4 * p * (1 - p);

    if (p >= 1) this.hop = null;
  }
}

// Model: owns game state and rules. No rendering, no input handling.
// World generation lives in worldgen/; this class holds the generated world
// plus the hero, and exposes the per-frame runtime API (movement, lookups).

import {
  HERO_SPEED,
  HERO_RADIUS,
  BUSH_COLLISION_HALF,
  TREE_COLLISION_HALF,
  ATTACK_DURATION,
  ATTACK_KNOCKBACK,
  ATTACK_REACH,
  ATTACK_STRIKE,
  CAMPFIRE_COLLISION_HALF,
  CAMP_PROP_COLLISION_HALF,
  PALISADE_THICKNESS,
  ENEMY_ACTIVE_RADIUS,
  ENEMY_CORPSE_TIME,
  ENEMY_STATS,
  ENEMY_SEPARATION_SPEED,
  ENEMY_PATH_RADIUS,
  ENEMY_PATH_REFRESH,
  LANTERN_COLLISION_HALF,
  FENCE_THICKNESS,
  HOP_DURATION,
  HOP_HEIGHT,
  TILE_HEIGHT,
  ROAD_SURFACE_HEIGHT,
} from './constants';
import { DEFAULT_MAP_SIZE, NEIGHBORS_4, cellKey, inBounds, spawnOf, toCellX, toCellZ, type MapSize } from './grid';
import type { Building, Bush, Camp, Enemy, Field, Hero, Tree, House, Surface, Village } from './types';
import { campPalisade, campPieces, spawnEnemies, stepEnemy, type EnemyActions } from './enemies';
import { ENEMY_DAMAGE, ENEMY_XP, FRESH_HERO_STATS, gainXp, hurt, maxHpAt, recover } from './heroStats';
import { HERO_LOOK } from './human/humanoid';
import { spawnWildlife, stepWildlife, type Wildlife } from './wildlife/wildlife';
import { generateWorld, solidCells } from './worldgen/world';
import { fenceEdges } from './worldgen/fields';
import { squareLanterns } from './worldgen/villages';
import { onPaving } from './roads';
import { findPath } from './pathfinding';

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
  readonly enemies: Enemy[];
  readonly camps: Camp[];
  readonly wildlife: Wildlife[]; // peaceful animals: they never block and can't be hurt

  private readonly solidCells: Set<string>; // tiles blocked edge to edge
  // Props smaller than a tile (bushes, tree trunks, lamp posts): tile key ->
  // half-size of the square they block, centered on the tile.
  private readonly propFootprints: Map<string, number>;
  private readonly lowProps = new Set<string>(); // props too low to hide anyone (campfires)
  private hop: { fromY: number; toY: number; elapsed: number } | null = null;
  // Field fences, as thin axis-aligned rectangles [minX, minZ, maxX, maxZ]
  // along tile edges, keyed by the tile they're in.
  private readonly fences = new Map<string, Array<[number, number, number, number]>>();
  // Time into the current attack, or null when not attacking; whether the
  // current blow has landed yet (each blow hits at most once).
  private attackElapsed: number | null = null;
  private attackLanded = false;

  // Dev cheats: movement speed factor (1 = normal); walking through
  // everything; god mode (nothing hurts the hero yet, so just a flag); and
  // enemies standing still.
  speedMultiplier = 1;
  noclip = false;
  godMode = false;
  enemiesFrozen = false;

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
    this.solidCells = new Set(solidCells(this));
    this.propFootprints = new Map([
      ...this.bushes.map((b): [string, number] => [cellKey(b.x, b.z), BUSH_COLLISION_HALF]),
      ...this.trees.map((t): [string, number] => [cellKey(t.x, t.z), TREE_COLLISION_HALF]),
      ...this.villages.flatMap((v) => squareLanterns(v).map(([x, z]): [string, number] => [cellKey(x, z), LANTERN_COLLISION_HALF])),
    ]);

    for (const field of this.fields) {
      for (const { x, z, side } of fenceEdges(field)) this.addFenceStrip(x, z, side, FENCE_THICKNESS);
    }

    const spawn = spawnOf(this.size);
    this.hero = { x: spawn.x, z: spawn.z, y: 0, facing: 0, look: { ...HERO_LOOK }, equipment: {}, ...FRESH_HERO_STATS }; // starts naked
    this.hero.y = this.getGroundY(this.hero.x, this.hero.z);
    const { enemies, camps } = spawnEnemies(this);
    this.enemies = enemies;
    this.camps = camps;
    // Tents block their tile; the fire, crates and rack a square in the
    // middle of theirs; the palisade a strip along its edges. The loot pile
    // and log seats don't block.
    for (const camp of camps) {
      for (const piece of campPieces(camp)) {
        const key = cellKey(piece.x, piece.z);
        if (piece.kind === 'tent') this.solidCells.add(key);
        else if (piece.kind === 'fire') {
          this.propFootprints.set(key, CAMPFIRE_COLLISION_HALF);
          this.lowProps.add(key);
        }
        else if (piece.kind !== 'loot') this.propFootprints.set(key, CAMP_PROP_COLLISION_HALF);
      }
      for (const edge of campPalisade(camp)) this.addFenceStrip(edge.x, edge.z, edge.side, PALISADE_THICKNESS);
    }
    for (const enemy of this.enemies) enemy.y = this.getGroundY(enemy.x, enemy.z);
    this.wildlife = spawnWildlife(this);
  }

  // A blocking strip `thickness` thick along one edge of a tile (a fence).
  private addFenceStrip(x: number, z: number, side: number, thickness: number): void {
    const [dx, dz] = NEIGHBORS_4[side];
    const t = thickness;
    const rect: [number, number, number, number] =
      dx !== 0
        ? [dx > 0 ? x + 0.5 - t : x - 0.5, z - 0.5, dx > 0 ? x + 0.5 : x - 0.5 + t, z + 0.5]
        : [x - 0.5, dz > 0 ? z + 0.5 - t : z - 0.5, x + 0.5, dz > 0 ? z + 0.5 : z - 0.5 + t];
    const key = cellKey(x, z);
    this.fences.set(key, [...(this.fences.get(key) ?? []), rect]);
  }

  // Height of whatever the hero would stand on at (x, z), in world units:
  // the tile's tier, plus the road/cobble paving where there is some.
  getGroundY(x: number, z: number): number {
    const tile = this.heightMap[toCellX(this.size, x)][toCellZ(this.size, z)] * TILE_HEIGHT;
    return onPaving(this.surfaceMap, x, z) ? tile + ROAD_SURFACE_HEIGHT : tile;
  }

  // Starts a blow unless one is already under way; returns whether it did.
  startAttack(): boolean {
    if (this.attackElapsed !== null) return false;
    this.attackElapsed = 0;
    this.attackLanded = false;
    return true;
  }

  // How far through the current attack the hero is, 0..1, or null.
  get attackProgress(): number | null {
    return this.attackElapsed === null ? null : Math.min(1, this.attackElapsed / ATTACK_DURATION);
  }

  // Moves the hero straight to (x, z), standing on the ground there.
  teleport(x: number, z: number): void {
    this.hero.x = x;
    this.hero.z = z;
    this.hero.y = this.getGroundY(x, z);
    this.hop = null;
  }

  // A tile the hero can stand in the middle of: on the map, dry, and free
  // of buildings, wells, trees, bushes and lamp posts.
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
  private isBlocked(x: number, z: number, r = HERO_RADIUS): boolean {
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
    if (this.attackElapsed !== null) {
      this.attackElapsed += dt;
      if (!this.attackLanded && this.attackElapsed >= ATTACK_STRIKE * ATTACK_DURATION) {
        this.attackLanded = true;
        this.landBlow();
      }
      if (this.attackElapsed >= ATTACK_DURATION) this.attackElapsed = null;
    }
    this.updateEnemies(dt);
    recover(this.hero, dt);
    stepWildlife(this.wildlife, this, this.hero, dt);
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
    const free = (x: number, z: number) => this.noclip || (!this.isBlocked(x, z) && !this.bumpsEnemy(x, z));
    if (free(candidateX, this.hero.z)) this.hero.x = candidateX;
    if (free(this.hero.x, candidateZ)) this.hero.z = candidateZ;
    this.hero.facing = Math.atan2(dirX, dirZ);
  }

  // Living enemies are solid to the hero: a step is refused if it would
  // overlap one and bring the two closer. Stepping away from an enemy
  // already pressed against the hero is always allowed, so the hero can't
  // get pinned.
  private bumpsEnemy(x: number, z: number): boolean {
    return this.enemies.some((enemy) => {
      const reach = HERO_RADIUS + ENEMY_STATS[enemy.kind].radius;
      if (enemy.state === 'dead' || Math.abs(enemy.x - x) >= reach || Math.abs(enemy.z - z) >= reach) return false;
      return Math.hypot(enemy.x - x, enemy.z - z) < Math.hypot(enemy.x - this.hero.x, enemy.z - this.hero.z);
    });
  }

  // The blow lands on the nearest living enemy within reach and roughly in
  // front of the hero (within 70 degrees of facing): one hit point off, a
  // shove away, and a brief flash. At zero it dies.
  private landBlow(): void {
    const fx = Math.sin(this.hero.facing);
    const fz = Math.cos(this.hero.facing);
    let target: Enemy | null = null;
    let best = Infinity;
    for (const enemy of this.enemies) {
      if (enemy.state === 'dead') continue;
      const dx = enemy.x - this.hero.x;
      const dz = enemy.z - this.hero.z;
      const d = Math.hypot(dx, dz);
      if (d > ATTACK_REACH + ENEMY_STATS[enemy.kind].radius || d >= best) continue;
      if (d > 1e-6 && (dx * fx + dz * fz) / d < Math.cos((70 * Math.PI) / 180)) continue;
      target = enemy;
      best = d;
    }
    if (!target) return;
    target.hp -= 1;
    target.hurtFor = 0.25;
    target.swingFor = null; // a hit interrupts its own blow
    target.state = target.hp <= 0 ? 'dead' : 'chase';
    if (target.state === 'dead') gainXp(this.hero, ENEMY_XP[target.kind]);
    const d = Math.max(best, 1e-6);
    this.moveEnemy(target, ((target.x - this.hero.x) / d) * ATTACK_KNOCKBACK, ((target.z - this.hero.z) / d) * ATTACK_KNOCKBACK);
  }

  private readonly enemyActions: EnemyActions = {
    move: (e, dx, dz) => this.moveEnemy(e, dx, dz),
    steer: (e, quarry) => this.chaseGoal(e, quarry),
    sees: (e) => this.canSee(e),
    strike: (e) => this.enemyStrikes(e),
  };

  // An enemy's blow lands if the hero is still within its reach (a step
  // back in time dodges it). Out of health, the hero wakes at spawn, healed.
  private enemyStrikes(enemy: Enemy): void {
    if (this.godMode || Math.hypot(enemy.x - this.hero.x, enemy.z - this.hero.z) > ENEMY_STATS[enemy.kind].stop + 0.25) return;
    if (!hurt(this.hero, ENEMY_DAMAGE[enemy.kind])) return;
    const spawn = spawnOf(this.size);
    this.teleport(spawn.x, spawn.z);
    this.hero.hp = maxHpAt(this.hero.level);
    for (const e of this.enemies) if (e.state === 'chase') e.state = 'wander';
  }

  // Enemies near the hero act; the dead lie a while, then are gone.
  private updateEnemies(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (Math.abs(enemy.x - this.hero.x) > ENEMY_ACTIVE_RADIUS || Math.abs(enemy.z - this.hero.z) > ENEMY_ACTIVE_RADIUS) continue;
      enemy.hurtFor = Math.max(0, enemy.hurtFor - dt);
      if (enemy.state === 'dead') {
        enemy.deadFor += dt;
        if (enemy.deadFor >= ENEMY_CORPSE_TIME) this.enemies.splice(i, 1);
        continue;
      }
      enemy.pathAge += dt;
      if (!this.enemiesFrozen) stepEnemy(enemy, this.hero, dt, this.enemyActions);
    }
    if (!this.enemiesFrozen) this.separateEnemies(dt);
  }

  // Enemies that overlap (spawned close, or shoved together) ease apart,
  // each moving half the way, so a group closing in spreads around the hero.
  private separateEnemies(dt: number): void {
    const near = this.enemies.filter(
      (e) => e.state !== 'dead' && Math.abs(e.x - this.hero.x) <= ENEMY_ACTIVE_RADIUS && Math.abs(e.z - this.hero.z) <= ENEMY_ACTIVE_RADIUS,
    );
    for (let i = 0; i < near.length; i++) {
      for (let j = i + 1; j < near.length; j++) {
        const a = near[i];
        const b = near[j];
        const reach = ENEMY_STATS[a.kind].radius + ENEMY_STATS[b.kind].radius;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d >= reach) continue;
        // Exactly on top of each other: part along a direction from their ids.
        const [ux, uz] = d > 1e-6 ? [dx / d, dz / d] : [Math.cos(a.id + b.id), Math.sin(a.id + b.id)];
        const push = Math.min(reach - d, ENEMY_SEPARATION_SPEED * dt) / 2;
        this.moveEnemy(a, -ux * push, -uz * push);
        this.moveEnemy(b, ux * push, uz * push);
      }
    }
  }

  // Where a chasing enemy heads: straight at the hero when nothing's in the
  // way, else the next tile of a path around it, found afresh twice a
  // second so it follows the hero. With no way through, the path ends as
  // close to the hero as it gets, and the enemy waits there.
  private chaseGoal(enemy: Enemy, quarry: { x: number; z: number }): { x: number; z: number } {
    const r = ENEMY_STATS[enemy.kind].radius;
    const free = (x: number, z: number) => !this.isBlocked(x, z, r);
    if (this.clearLine(enemy, quarry, free)) {
      enemy.path = null;
      return quarry;
    }
    if (!enemy.path || enemy.pathAge > ENEMY_PATH_REFRESH) {
      enemy.path = findPath(enemy, quarry, ENEMY_PATH_RADIUS, free);
      enemy.pathAge = 0;
    }
    const path = enemy.path;
    while (path.length > 0 && Math.hypot(path[0].x - enemy.x, path[0].z - enemy.z) < 0.12) path.shift();
    return path[0] ?? enemy;
  }

  // Whether an enemy can see the hero: nothing solid (a building, a
  // palisade or fence, a tree trunk, a bush, a tent...) on the line between.
  // Water, crops and campfires don't hide anyone.
  private canSee(enemy: Enemy): boolean {
    return this.clearLine(enemy, this.hero, (x, z) => !this.blocksSight(x, z), 0.05); // fine steps, so a thin fence can't slip between
  }

  private blocksSight(x: number, z: number): boolean {
    const cx = toCellX(this.size, x);
    const cz = toCellZ(this.size, z);
    const key = cellKey(cx, cz);
    if (this.solidCells.has(key)) return true;
    const half = this.lowProps.has(key) ? undefined : this.propFootprints.get(key);
    if (half !== undefined && Math.abs(x - cx) < half && Math.abs(z - cz) < half) return true;
    return (this.fences.get(key) ?? []).some(([minX, minZ, maxX, maxZ]) => x >= minX && x <= maxX && z >= minZ && z <= maxZ);
  }

  // Whether `free` holds all along the straight line from `a` to `b`, checked every `step`.
  private clearLine(a: { x: number; z: number }, b: { x: number; z: number }, free: (x: number, z: number) => boolean, step = 0.2): boolean {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.ceil(d / step);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!free(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  }

  // Living enemies are solid to each other, by the same rule as for the hero:
  // no step that overlaps another and brings the two closer.
  private bumpsOtherEnemy(enemy: Enemy, x: number, z: number): boolean {
    return this.enemies.some((other) => {
      if (other === enemy || other.state === 'dead') return false;
      const reach = ENEMY_STATS[enemy.kind].radius + ENEMY_STATS[other.kind].radius;
      if (Math.abs(other.x - x) >= reach || Math.abs(other.z - z) >= reach) return false;
      const after = Math.hypot(other.x - x, other.z - z);
      return after < reach && after < Math.hypot(other.x - enemy.x, other.z - enemy.z);
    });
  }

  // Moves an enemy with the same collisions as the hero (axis by axis, so it
  // slides along obstacles); returns whether it moved at all.
  private moveEnemy(enemy: Enemy, dx: number, dz: number): boolean {
    const x0 = enemy.x;
    const z0 = enemy.z;
    const r = ENEMY_STATS[enemy.kind].radius;
    const margin = 0.4;
    const nx = Math.min(this.size.width - 1 - margin, Math.max(margin, enemy.x + dx));
    const nz = Math.min(this.size.depth - 1 - margin, Math.max(margin, enemy.z + dz));
    if (!this.isBlocked(nx, enemy.z, r) && !this.bumpsOtherEnemy(enemy, nx, enemy.z)) enemy.x = nx;
    if (!this.isBlocked(enemy.x, nz, r) && !this.bumpsOtherEnemy(enemy, enemy.x, nz)) enemy.z = nz;
    enemy.y = this.getGroundY(enemy.x, enemy.z);
    return enemy.x !== x0 || enemy.z !== z0;
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

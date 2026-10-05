// A bot getting about as a player does, by the arrow keys' direction only:
// outdoors along paths round what's in the way (the game's own pathfinding),
// indoors round the furniture, through doors to go in and out. It tells
// when it's there, and when it's stuck (pressing on and getting nowhere).
import type { GameModel } from '../../src/model/GameModel';
import { findPath } from '../../src/model/map/pathfinding';
import { clearLine, type Point } from '../../src/model/map/obstacles';
import { HERO_RADIUS, INDOOR_SCALE } from '../../src/model/constants';
import { NPC_RADIUS } from '../../src/model/npcs/npcs';
import { bumpsFurniture } from '../../src/model/interiors/furniture';
import type { Entrance } from '../../src/model/interiors/interiors';
import { noticeBoards } from '../../src/model/quests/noticeBoards';
import { boardNumber } from '../../src/model/quests/quests';
import { zoneLevel } from '../../src/model/enemies/enemyLevels';
import { spawnOf } from '../../src/model/map/grid';

export type Arrival = 'going' | 'there' | 'stuck' | 'no way';

const REPATH = 2.5; // seconds between fresh paths
const STILL_TIME = 6; // seconds pressing on without moving: stuck
const LOST_TIME = 40; // seconds without getting any nearer (round and round): stuck (not on a long way round)
const PATH_RADIUS = 40;

export class Nav {
  private path: Point[] = [];
  private age = Infinity;
  private goal: Point | null = null;
  private best = Infinity; // nearest yet to the goal
  private sinceBetter = 0; // seconds since getting nearer
  private still: Point & { t: number } = { x: 0, z: 0, t: 0 }; // where last seen moving, and seconds since
  private noWay = 0;
  private reaches = false; // whether the last path found gets there (else: going as near as there's a way)
  private route: Point[] | null = null; // outdoors, the whole way there (tile by tile) when it's a long way round
  private routedAt = -Infinity; // when (game seconds) the whole way was last worked out: not more than every few seconds (it's a big search)
  unreachable = false; // whether the goal's been found to be out of reach from here, the whole map over

  constructor(private readonly model: GameModel) {}

  // Seconds the hero's pressed on without moving.
  get stillFor(): number {
    return this.still.t;
  }

  reset(): void {
    [this.path, this.age, this.goal, this.best, this.sinceBetter, this.noWay] = [[], Infinity, null, Infinity, 0, 0];
    this.still = { x: this.model.hero.x, z: this.model.hero.z, t: 0 };
    [this.route, this.unreachable] = [null, false];
  }

  // Where the hero can stand, where they are now (a room's floor, a dungeon's between its rock, or outdoors).
  // Folk standing about count as in the way (the way round them, if there's one); foes too, outdoors and underground.
  free(): (x: number, z: number) => boolean {
    const { inside, hero } = this.model;
    const where = inside?.entrance ?? null;
    const reach = (HERO_RADIUS + NPC_RADIUS) * (inside ? INDOOR_SCALE : 1);
    const folk = this.model.npcs.filter((n) => n.where === where && Math.abs(n.x - hero.x) < 45 && Math.abs(n.z - hero.z) < 45); // (even those touching the hero: round them, not into them)
    // (and foes, but the one being gone for: at the goal)
    const goal = this.goal;
    const foes = inside && !this.model.dungeon ? [] : this.model.foes.filter((e) => e.state !== 'dead' && Math.hypot(e.x - hero.x, e.z - hero.z) > 0.6 && Math.abs(e.x - hero.x) < 45 && Math.abs(e.z - hero.z) < 45 && !(goal && Math.hypot(e.x - goal.x, e.z - goal.z) < 1.5));
    // (right by the hero, no: the tiles there are where the way starts, and those in the way step aside, or are sidestepped)
    const clear = (x: number, z: number) => Math.hypot(x - hero.x, z - hero.z) < 1.1 || (!folk.some((n) => Math.hypot(n.x - x, n.z - z) < reach) && !foes.some((e) => Math.hypot(e.x - x, e.z - z) < 0.5));
    if (!inside) return (x, z) => !this.model.isBlocked(x, z, HERO_RADIUS) && clear(x, z);
    const r = HERO_RADIUS * INDOOR_SCALE;
    const { width, depth } = inside.room;
    return (x, z) => x >= -0.5 + r && z >= -0.5 + r && x <= width - 0.5 - r && z <= depth - 0.5 - r && !bumpsFurniture(inside.furniture, x, z, r) && !inside.walls?.(x, z, r) && clear(x, z); // (a dungeon's rock too)
  }

  // Tile centers to walk through: straight there, if nothing's in the way (as a player would: down the aisle behind a
  // bar, say, where no tile's middle is clear); else the pathfinding, from the middle of the hero's tile, so if that's
  // blocked (a prop there, the hero at its edge), first to the nearest clear middle the hero can walk straight to.
  private pathTo(to: Point): Point[] {
    const { hero } = this.model;
    const free = this.free();
    if (this.model.inside && free(to.x, to.z) && clearLine(hero, to, free, 0.1)) return [to];
    const radius = Math.min(PATH_RADIUS, Math.ceil(Math.hypot(to.x - hero.x, to.z - hero.z)) + 8); // (no farther round than need be)
    const [tx, tz] = [Math.round(hero.x), Math.round(hero.z)];
    if (free(tx, tz)) return findPath(hero, to, radius, free);
    const near: Point[] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) near.push({ x: tx + dx, z: tz + dz });
    near.sort((a, b) => Math.hypot(a.x - hero.x, a.z - hero.z) - Math.hypot(b.x - hero.x, b.z - hero.z));
    const first = near.find((p) => free(p.x, p.z) && clearLine(hero, p, free, 0.1));
    return first ? [first, ...findPath(first, to, radius, free)] : findPath(hero, to, radius, free);
  }

  // A fresh path: straight there round what's in the way; or, outdoors,
  // when there's no way there near at hand, toward a point some way along
  // the whole way round (found once).
  private repath(to: Point): void {
    const { hero, inside } = this.model;
    if (!this.route) {
      this.path = this.pathTo(to);
      const end = this.path[this.path.length - 1] ?? hero;
      this.reaches = Math.hypot(end.x - to.x, end.z - to.z) < 1;
      if (this.reaches || inside || this.model.minutes - this.routedAt < 1) return; // (a whole way just worked out, for another goal: the near way for now)
      this.route = this.wholeWay(to);
      if (!this.route) return void (this.unreachable = true);
    }
    // On along the route itself, from the point of it nearest the hero (none left: there).
    if (this.route.length === 0) return void (this.path = [to]);
    let nearest = 0;
    for (let i = 0; i < this.route.length; i++) if (Math.hypot(this.route[i].x - hero.x, this.route[i].z - hero.z) < Math.hypot(this.route[nearest].x - hero.x, this.route[nearest].z - hero.z)) nearest = i;
    if (Math.hypot(this.route[nearest].x - hero.x, this.route[nearest].z - hero.z) > 0.75 || !clearLine(hero, this.route[nearest], this.free(), 0.1)) {
      // (off it, pushed about or round a fight: a fresh one from here)
      if (this.model.minutes - this.routedAt < 3) return void (this.path = this.path.length ? this.path : [to]); // (just worked out: on as it is)
      this.route = this.wholeWay(to);
      if (!this.route) return void (this.unreachable = true);
      if (this.route.length === 0) return void (this.path = [to]);
      nearest = 0;
    }
    this.path = this.route.slice(nearest, nearest + 40);
    this.reaches = true;
  }

  // The way to `to` across the whole map, or null if there's none.
  private wholeWay(to: Point): Point[] | null {
    this.routedAt = this.model.minutes;
    // On a half-tile lattice: through a wood, the way's between the trunks, not over the tiles' middles.
    const STEP = 0.5;
    const [w, d] = [this.model.size.width / STEP, this.model.size.depth / STEP];
    const free = (x: number, z: number) => !this.model.isBlocked(x, z, HERO_RADIUS);
    const { hero } = this.model;
    const [hi, hj] = [Math.round(hero.x / STEP), Math.round(hero.z / STEP)];
    const [gi, gj] = [Math.round(to.x / STEP), Math.round(to.z / STEP)];
    // Within the box round the hero and the goal, a good way out each side (round a lake, say): not the whole map.
    const MARGIN = 80 / STEP;
    const [i0, j0] = [Math.max(2, Math.min(hi, gi) - MARGIN), Math.max(2, Math.min(hj, gj) - MARGIN)];
    const [i1, j1] = [Math.min(w - 3, Math.max(hi, gi) + MARGIN), Math.min(d - 3, Math.max(hj, gj) + MARGIN)];
    const bd = j1 - j0 + 1;
    const cells = (i1 - i0 + 1) * bd;
    const index = (i: number, j: number) => (i - i0) * bd + (j - j0);
    const at = (cell: number): Point => ({ x: (i0 + Math.floor(cell / bd)) * STEP, z: (j0 + (cell % bd)) * STEP });
    const came = new Int32Array(cells).fill(-1);
    const queue = new Int32Array(cells);
    let [head, tail] = [0, 0];
    // From the lattice points round the hero they can walk straight to.
    for (let di = -2; di <= 2; di++) {
      for (let dj = -2; dj <= 2; dj++) {
        const [i, j] = [hi + di, hj + dj];
        if (i < i0 || j < j0 || i > i1 || j > j1) continue;
        const p = { x: i * STEP, z: j * STEP };
        if (!free(p.x, p.z) || !clearLine(hero, p, free, 0.1)) continue;
        came[index(i, j)] = index(i, j); // (a start: comes from itself)
        queue[tail++] = index(i, j);
      }
    }
    while (head < tail) {
      const cell = queue[head++];
      const p = at(cell);
      if (Math.hypot(p.x - to.x, p.z - to.z) <= 0.75) {
        const way: Point[] = [];
        for (let c = cell; came[c] !== c; c = came[c]) way.push(at(c));
        return way.reverse();
      }
      const [i, j] = [i0 + Math.floor(cell / bd), j0 + (cell % bd)];
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const [ni, nj] = [i + di, j + dj];
        if (ni < i0 || nj < j0 || ni > i1 || nj > j1 || came[index(ni, nj)] >= 0) continue;
        const [nx, nz] = [ni * STEP, nj * STEP];
        if (!free(nx, nz) || !free((p.x + nx) / 2, (p.z + nz) / 2)) continue;
        came[index(ni, nj)] = cell;
        queue[tail++] = index(ni, nj);
      }
    }
    return null;
  }

  // One frame toward `to`, within `near` of it: the way to press (dx, dz), and how it's going.
  toward(to: Point, near: number, dt: number): { dx: number; dz: number; state: Arrival } {
    const { hero } = this.model;
    // (a new goal: afresh; the same one moved a little, a foe's say: kept on)
    if (!this.goal || Math.hypot(this.goal.x - to.x, this.goal.z - to.z) > 1.5) {
      this.reset();
      this.goal = { ...to };
    }
    const d = Math.hypot(to.x - hero.x, to.z - hero.z);
    if (d <= near) return { dx: 0, dz: 0, state: 'there' };
    // Moving and getting nearer (round what's in the way, maybe farther for a while), or stuck.
    if (d < this.best - 0.15) [this.best, this.sinceBetter] = [d, 0];
    else if ((this.sinceBetter += dt) > LOST_TIME && !this.route) return { dx: 0, dz: 0, state: this.reaches ? 'stuck' : 'no way' };
    if (Math.hypot(hero.x - this.still.x, hero.z - this.still.z) > 0.3) this.still = { x: hero.x, z: hero.z, t: 0 };
    else if ((this.still.t += dt) > STILL_TIME) return { dx: 0, dz: 0, state: this.reaches ? 'stuck' : 'no way' };
    // The way: straight on over the last stretch, else along a path round what's between.
    this.age += dt;
    if (this.age > REPATH || this.path.length === 0) {
      this.repath(to);
      this.age = 0;
      if (this.unreachable) return { dx: 0, dz: 0, state: 'no way' };
    }
    // Points reached, or (near the goal) a tile just behind the hero the way started from: passed over, not gone back to.
    const behind = (p: Point) => d < 2 && Math.hypot(p.x - hero.x, p.z - hero.z) < 1.2 && (p.x - hero.x) * (to.x - hero.x) + (p.z - hero.z) * (to.z - hero.z) < 0;
    while (this.path.length > 0 && (Math.hypot(this.path[0].x - hero.x, this.path[0].z - hero.z) < 0.2 || behind(this.path[0]))) this.path.shift();
    // The last bit straight on, if nothing's in the way (a wall's corner, say) up to just short of it (a door's spot is against its wall).
    const short = { x: to.x + ((hero.x - to.x) / (d || 1)) * Math.min(0.35, d), z: to.z + ((hero.z - to.z) / (d || 1)) * Math.min(0.35, d) };
    const straight = d < 1.2 && clearLine(hero, short, this.free(), 0.1);
    const next = straight || this.path.length === 0 ? to : this.path[0];
    if (this.path.length === 0 && !straight) {
      if ((this.noWay += dt) > 4) return { dx: 0, dz: 0, state: 'no way' };
    } else this.noWay = 0;
    const [dx, dz] = [next.x - hero.x, next.z - hero.z];
    const len = Math.hypot(dx, dz) || 1;
    // Held up a moment by someone stood right in the way: a sidestep round them (the side that's clear).
    const where = this.model.inside?.entrance ?? null;
    const scale = this.model.inside ? INDOOR_SCALE : 1;
    const blocker = this.still.t > 1.5 && this.model.npcs.find((n) => n.where === where && Math.hypot(n.x - hero.x, n.z - hero.z) < (HERO_RADIUS + NPC_RADIUS) * scale + 0.05);
    if (blocker) {
      const free = this.free();
      const side = [1, -1].find((k) => free(hero.x - (dz / len) * k * 0.4, hero.z + (dx / len) * k * 0.4)) ?? 1;
      return { dx: (-dz / len) * side, dz: (dx / len) * side, state: 'going' };
    }
    return { dx: dx / len, dz: dz / len, state: 'going' };
  }
}

// The nearest door of a kind of building to the hero (`but` those), if there's one: on ground made just now (a streamed
// world's farther regions, not made yet, can't be walked to: their villages are known, but not the way there).
export function nearestDoor(model: GameModel, type: Entrance['type'], but: (e: Entrance) => boolean = () => false, within = Infinity): Entrance | null {
  const { hero } = model;
  return model.entrances.filter((e) => e.type === type && !but(e) && model.isMade(e.x, e.z) && Math.hypot(e.x - hero.x, e.z - hero.z) < within).sort((a, b) => Math.hypot(a.x - hero.x, a.z - hero.z) - Math.hypot(b.x - hero.x, b.z - hero.z))[0] ?? null;
}

// The notice board to go to for work (its village's index): the nearest of
// the villages at about the hero's level (theirs or one less), else of those
// below it, else the nearest (a village's level sets its quests').
export function boardFor(model: GameModel): number {
  const { hero } = model;
  const spawn = spawnOf(model.size);
  const boards = noticeBoards(model);
  const far = (i: number) => Math.hypot(boards[i].x - hero.x, boards[i].z - hero.z);
  const all = boards.map((_, i) => i).filter((i) => model.isMade(boards[i].x, boards[i].z)).sort((a, b) => far(a) - far(b)); // (on ground made just now)
  const level = (i: number) => zoneLevel(spawn, model.villages[i]);
  const i = all.find((i) => level(i) >= hero.level - 1 && level(i) <= hero.level) ?? all.find((i) => level(i) < hero.level) ?? all[0];
  return i === undefined ? -1 : boardNumber(model, i); // (none about: -1, no board) // (its number, as quests know it: a streamed world's, its village's place)
}

// Open ground somewhere about (x, z) (a few tiles either way), if any's found.
export function openNear(model: GameModel, rng: () => number, x: number, z: number): Point | null {
  for (let tries = 0; tries < 20; tries++) {
    const [tx, tz] = [Math.round(x + (rng() - 0.5) * 8), Math.round(z + (rng() - 0.5) * 8)];
    if (model.isOpenTile(tx, tz)) return { x: tx, z: tz };
  }
  return null;
}

// Whether the hero could stand somewhere within `reach` of a point (outdoors).
export function standableNear(model: GameModel, at: Point, reach: number): boolean {
  for (let r = 0.3; r < reach; r += 0.25) for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) if (!model.isBlocked(at.x + Math.cos(a) * r, at.z + Math.sin(a) * r, HERO_RADIUS)) return true;
  return false;
}

// What the hero's doing, for a report (only what's out of the ordinary), and who's pressed up against them.
export function heroState(model: GameModel): string {
  const { hero } = model;
  const odd = [model.yard && 'in a yard', model.seated && 'seated', hero.drinking && 'drinking', hero.energy < 1 && `energy ${hero.energy.toFixed(1)}`, hero.hp < 1 && `health ${hero.hp.toFixed(1)}`];
  const npcs = model.npcs.filter((n) => n.where === (model.inside?.entrance ?? null) && Math.hypot(n.x - hero.x, n.z - hero.z) < 0.9).map((n) => `${n.name} the ${n.role}`);
  const foes = model.enemies.filter((e) => e.state !== 'dead' && Math.hypot(e.x - hero.x, e.z - hero.z) < 1.5).map((e) => `a ${e.kind} (${e.state})`);
  odd.push(...npcs.map((n) => `against ${n}`), ...foes.map((f) => `by ${f}`));
  return odd.filter(Boolean).length ? ` (${odd.filter(Boolean).join(', ')})` : '';
}

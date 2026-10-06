// What blocks movement and sight on the map, built with the world (a streamed world's a region at a time):
// - solid tiles, blocked edge to edge (water, houses, wells, tents);
// - props smaller than a tile (bushes, tree trunks, lamp posts, camp
//   crates): a square around the tile's center; campfires among them are
//   too low to hide anyone;
// - fences and palisades: thin strips along tile edges.
// Walkers are squares of half-width r checked at all four corners, so none
// sinks halfway into a wall before its center crosses the edge.

import { NEIGHBORS_4, inBounds, toCellX, toCellZ, type MapSize } from './grid';
import type { Tiles } from './tiles';

export type Point = { x: number; z: number };

type Rect = [number, number, number, number]; // [minX, minZ, maxX, maxZ]

// One page of the grids: a region of a streamed world (or a classic world's whole map), its tiles indexed
// (x - x0) * depth + (z - z0). (Handed between threads as it is: a region's made off the game's: worldStreamer.ts.)
export interface ObstaclePage {
  x0: number;
  z0: number;
  width: number;
  depth: number;
  solid: Uint8Array; // tiles blocked edge to edge (besides water)
  prop: Uint8Array; // 0: none; else 1 + the index in `halves` of its half-sizes
  low: Uint8Array; // props too low to hide anyone
  round: Uint8Array; // props round, not square (a rock): `half` their radius
  fenced: Uint8Array; // tiles with a fence strip (most have none: asked before the map is)
  fences: Map<number, Rect[]>; // fence strips, by the tile they're in
}

export class Obstacles {
  // Kept as grids, a page a region (not keyed by "x,z": the world has hundreds of thousands of props, and these are
  // asked every frame); a tile whose page isn't open (a streamed world's region not made, or let go) blocks everything.
  private readonly halves: Array<[number, number, number, number]> = []; // the props' half-sizes (across x, across z), and where a round one's middle is off its tile's (x, z); each kept exact
  private readonly pages = new Map<number, ObstaclePage>();
  private last: ObstaclePage | null = null; // (the page asked last: walkers keep to one, mostly)
  private readonly across: number; // pages across z

  // `pageSize`: tiles a side of each page (a classic world: its whole map, one page, opened at once; a streamed one:
  // its regions', each opened as it's made: open, close).
  constructor(
    private readonly size: MapSize,
    private readonly tiles: Tiles,
    solid: Set<string> = new Set(), // tiles blocked edge to edge (besides water), as "x,z"
    private readonly pageSize = Math.max(size.width, size.depth),
  ) {
    this.across = Math.ceil(size.depth / pageSize);
    if (pageSize >= Math.max(size.width, size.depth)) this.open(0, 0);
    for (const key of solid) {
      const [x, z] = key.split(',').map(Number);
      this.addSolid(x, z);
    }
  }

  // The page of region (px, pz) opened (empty: what's on it added after), or let go.
  open(px: number, pz: number): void {
    const [x0, z0] = [px * this.pageSize, pz * this.pageSize];
    const [width, depth] = [Math.min(this.pageSize, this.size.width - x0), Math.min(this.pageSize, this.size.depth - z0)];
    const n = width * depth;
    this.pages.set(px * this.across + pz, { x0, z0, width, depth, solid: new Uint8Array(n), prop: new Uint8Array(n), low: new Uint8Array(n), round: new Uint8Array(n), fenced: new Uint8Array(n), fences: new Map() });
  }

  // Region (px, pz)'s page as made elsewhere (another Obstacles, off the game's thread: its props' sizes by `halves`,
  // its own), put in as this one's.
  install(px: number, pz: number, page: ObstaclePage, halves: ReadonlyArray<readonly [number, number, number, number]>): void {
    const mine = halves.map(([hx, hz, kx, kz]) => {
      const k = this.halves.findIndex(([a, b, c, d]) => a === hx && b === hz && c === kx && d === kz);
      return 1 + (k >= 0 ? k : this.halves.push([hx, hz, kx, kz]) - 1);
    });
    const { prop } = page;
    for (let i = 0; i < prop.length; i++) if (prop[i]) prop[i] = mine[prop[i] - 1];
    this.pages.set(px * this.across + pz, page);
  }

  // Region (px, pz)'s page and the props' sizes it goes by, as they are (to be installed elsewhere).
  pageOfRegion(px: number, pz: number): { page: ObstaclePage; halves: ReadonlyArray<readonly [number, number, number, number]> } | null {
    const page = this.pages.get(px * this.across + pz);
    return page ? { page, halves: this.halves } : null;
  }

  close(px: number, pz: number): void {
    const page = this.pages.get(px * this.across + pz);
    if (page === this.last) this.last = null;
    this.pages.delete(px * this.across + pz);
  }

  // The open page tile (x, z) is on, or null (off the map, or not open).
  private pageOf(x: number, z: number): ObstaclePage | null {
    const last = this.last;
    if (last && x >= last.x0 && z >= last.z0 && x < last.x0 + last.width && z < last.z0 + last.depth) return last;
    if (!inBounds(this.size, x, z)) return null;
    const page = this.pages.get(Math.floor(x / this.pageSize) * this.across + Math.floor(z / this.pageSize)) ?? null;
    if (page) this.last = page;
    return page;
  }

  // Tile (x, z)'s page and its index in it, or null.
  private at(x: number, z: number): { page: ObstaclePage; i: number } | null {
    const page = this.pageOf(x, z);
    return page && { page, i: (x - page.x0) * page.depth + (z - page.z0) };
  }

  addSolid(x: number, z: number): void {
    const at = this.at(x, z);
    if (at) at.page.solid[at.i] = 1;
  }

  // A prop in the middle of tile (x, z), half-size `half` across x and
  // `halfZ` across z (a square, unless told); `low` ones (a campfire) block
  // walking but not sight; `round` ones (a boulder) a disc of radius `half` (met as close from any side), its middle
  // (ox, oz) off the tile's (one rock over several tiles: each of them the same disc, round the rock's middle).
  addProp(x: number, z: number, half: number, low = false, halfZ = half, round = false, ox = 0, oz = 0): void {
    const at = this.at(x, z);
    if (!at) return;
    let k = this.halves.findIndex(([hx, hz, kx, kz]) => hx === half && hz === halfZ && kx === ox && kz === oz);
    if (k < 0) k = this.halves.push([half, halfZ, ox, oz]) - 1;
    const { page, i } = at;
    page.prop[i] = k + 1;
    if (low) page.low[i] = 1; // (low once, low for good, as ever)
    page.round[i] = round ? 1 : 0;
  }

  // The prop in the middle of tile (x, z) taken away (a tree felled: skills/lumber.ts): the tile clear of it.
  clearProp(x: number, z: number): void {
    const at = this.at(x, z);
    if (!at) return;
    const { page, i } = at;
    [page.prop[i], page.low[i], page.round[i]] = [0, 0, 0];
  }

  // A blocking strip `thickness` thick along one edge (`side`, NEIGHBORS_4) of tile (x, z).
  addFenceStrip(x: number, z: number, side: number, thickness: number): void {
    const [dx, dz] = NEIGHBORS_4[side];
    const t = thickness;
    const rect: Rect =
      dx !== 0
        ? [dx > 0 ? x + 0.5 - t : x - 0.5, z - 0.5, dx > 0 ? x + 0.5 : x - 0.5 + t, z + 0.5]
        : [x - 0.5, dz > 0 ? z + 0.5 - t : z - 0.5, x + 0.5, dz > 0 ? z + 0.5 : z - 0.5 + t];
    const at = this.at(x, z);
    if (!at) return;
    at.page.fences.set(at.i, [...(at.page.fences.get(at.i) ?? []), rect]);
    at.page.fenced[at.i] = 1;
  }

  // A tile one can stand in the middle of: on the map (and made), dry, and free of buildings and props.
  isOpenTile(x: number, z: number): boolean {
    const at = this.at(x, z);
    return !!at && !this.tiles.lake(x, z) && !at.page.solid[at.i] && !at.page.prop[at.i];
  }

  // Whether a walker of half-width r can't stand at (x, z), checked at its four corners.
  isBlocked(x: number, z: number, r: number): boolean {
    return this.cornerBlocked(x, z, r, x - r, z - r) || this.cornerBlocked(x, z, r, x + r, z - r) || this.cornerBlocked(x, z, r, x - r, z + r) || this.cornerBlocked(x, z, r, x + r, z + r);
  }

  // Whether the tile a corner (cx, cz) of a walker at (x, z) touches blocks it. (Asked four times a step for every
  // walker: nothing made while asking it, no fence looked up where there's none.)
  private cornerBlocked(x: number, z: number, r: number, cx: number, cz: number): boolean {
    const tx = toCellX(this.size, cx);
    const tz = toCellZ(this.size, cz);
    const page = this.pageOf(tx, tz);
    if (!page) return true; // (not made: no way on)
    const i = (tx - page.x0) * page.depth + (tz - page.z0);
    if (this.tiles.lake(tx, tz) || page.solid[i]) return true;
    // A prop's square lies inside its tile, so checking the tiles the
    // corners touch finds every prop the walker could overlap; same for fences.
    const prop = page.prop[i];
    if (prop) {
      const sizes = this.halves[prop - 1];
      if (page.round[i]) {
        // Round: whether the walker's square comes within its radius of its middle (nearest point of the square to it).
        const mx = tx + sizes[2];
        const mz = tz + sizes[3];
        const qx = Math.max(x - r, Math.min(mx, x + r));
        const qz = Math.max(z - r, Math.min(mz, z + r));
        if (Math.hypot(qx - mx, qz - mz) < sizes[0]) return true;
      } else if (Math.abs(x - tx) < r + sizes[0] && Math.abs(z - tz) < r + sizes[1]) return true;
    }
    if (!page.fenced[i]) return false;
    for (const [minX, minZ, maxX, maxZ] of page.fences.get(i)!) if (x + r > minX && x - r < maxX && z + r > minZ && z - r < maxZ) return true;
    return false;
  }

  // Whether something solid hides what's behind (x, z): buildings, tents,
  // props other than low ones, fences (and what isn't made). Water and crops hide nothing.
  blocksSight(x: number, z: number): boolean {
    const tx = toCellX(this.size, x);
    const tz = toCellZ(this.size, z);
    const page = this.pageOf(tx, tz);
    if (!page) return true;
    const i = (tx - page.x0) * page.depth + (tz - page.z0);
    if (page.solid[i]) return true;
    const prop = page.low[i] ? 0 : page.prop[i];
    if (prop && page.round[i]) {
      const [half, , ox, oz] = this.halves[prop - 1];
      if (Math.hypot(x - tx - ox, z - tz - oz) < half) return true; // (a round one: its disc)
    } else if (prop && Math.abs(x - tx) < this.halves[prop - 1][0] && Math.abs(z - tz) < this.halves[prop - 1][1]) return true;
    return (page.fences.get(i) ?? []).some(([minX, minZ, maxX, maxZ]) => x >= minX && x <= maxX && z >= minZ && z <= maxZ);
  }
}

// Whether `free` holds all along the straight line from `a` to `b`, checked every `step`.
export function clearLine(a: Point, b: Point, free: (x: number, z: number) => boolean, step = 0.2): boolean {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.ceil(d / step);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!free(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
  }
  return true;
}

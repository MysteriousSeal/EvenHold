// What blocks movement and sight on the map, built once with the world:
// - solid tiles, blocked edge to edge (water, houses, wells, tents);
// - props smaller than a tile (bushes, tree trunks, lamp posts, camp
//   crates): a square around the tile's center; campfires among them are
//   too low to hide anyone;
// - fences and palisades: thin strips along tile edges.
// Walkers are squares of half-width r checked at all four corners, so none
// sinks halfway into a wall before its center crosses the edge.

import { NEIGHBORS_4, inBounds, toCellX, toCellZ, type MapSize } from './grid';

export type Point = { x: number; z: number };

export class Obstacles {
  // Kept as grids (index x * depth + z), not keyed by "x,z": the world has
  // hundreds of thousands of props, and these are asked every frame.
  private readonly solid: Uint8Array; // tiles blocked edge to edge (besides water)
  private readonly prop: Uint8Array; // 0: none; else 1 + the index in `halves` of its square's half-size
  private readonly halves: number[] = []; // the props' half-sizes, each kept exact
  private readonly low: Uint8Array; // props too low to hide anyone
  // Fence strips as axis-aligned rectangles [minX, minZ, maxX, maxZ], by the tile they're in.
  private readonly fences = new Map<number, Array<[number, number, number, number]>>();

  constructor(
    private readonly size: MapSize,
    private readonly lakeMap: boolean[][],
    solid: Set<string>, // tiles blocked edge to edge (besides water), as "x,z"
  ) {
    const tiles = size.width * size.depth;
    [this.solid, this.prop, this.low] = [new Uint8Array(tiles), new Uint8Array(tiles), new Uint8Array(tiles)];
    for (const key of solid) {
      const [x, z] = key.split(',').map(Number);
      this.addSolid(x, z);
    }
  }

  // Its index in the grids, or -1 off the map (where nothing's ever asked of it).
  private at(x: number, z: number): number {
    return inBounds(this.size, x, z) ? x * this.size.depth + z : -1;
  }

  addSolid(x: number, z: number): void {
    const i = this.at(x, z);
    if (i >= 0) this.solid[i] = 1;
  }

  // A square prop of half-size `half` in the middle of tile (x, z); `low`
  // ones (a campfire) block walking but not sight.
  addProp(x: number, z: number, half: number, low = false): void {
    const i = this.at(x, z);
    if (i < 0) return;
    let k = this.halves.indexOf(half);
    if (k < 0) k = this.halves.push(half) - 1;
    this.prop[i] = k + 1;
    if (low) this.low[i] = 1; // (low once, low for good, as ever)
  }

  // A blocking strip `thickness` thick along one edge (`side`, NEIGHBORS_4) of tile (x, z).
  addFenceStrip(x: number, z: number, side: number, thickness: number): void {
    const [dx, dz] = NEIGHBORS_4[side];
    const t = thickness;
    const rect: [number, number, number, number] =
      dx !== 0
        ? [dx > 0 ? x + 0.5 - t : x - 0.5, z - 0.5, dx > 0 ? x + 0.5 : x - 0.5 + t, z + 0.5]
        : [x - 0.5, dz > 0 ? z + 0.5 - t : z - 0.5, x + 0.5, dz > 0 ? z + 0.5 : z - 0.5 + t];
    const i = this.at(x, z);
    if (i >= 0) this.fences.set(i, [...(this.fences.get(i) ?? []), rect]);
  }

  // A tile one can stand in the middle of: on the map, dry, and free of
  // buildings and props.
  isOpenTile(x: number, z: number): boolean {
    const i = this.at(x, z);
    return i >= 0 && !this.lakeMap[x][z] && !this.solid[i] && !this.prop[i];
  }

  // Whether a walker of half-width r can't stand at (x, z), checked at its four corners.
  isBlocked(x: number, z: number, r: number): boolean {
    return this.cornerBlocked(x, z, r, x - r, z - r) || this.cornerBlocked(x, z, r, x + r, z - r) || this.cornerBlocked(x, z, r, x - r, z + r) || this.cornerBlocked(x, z, r, x + r, z + r);
  }

  // Whether the tile a corner (cx, cz) of a walker at (x, z) touches blocks it.
  private cornerBlocked(x: number, z: number, r: number, cx: number, cz: number): boolean {
    const tx = toCellX(this.size, cx);
    const tz = toCellZ(this.size, cz);
    const i = tx * this.size.depth + tz;
    if (this.lakeMap[tx][tz] || this.solid[i]) return true;
    // A prop's square lies inside its tile, so checking the tiles the
    // corners touch finds every prop the walker could overlap; same for fences.
    const prop = this.prop[i];
    if (prop && Math.abs(x - tx) < r + this.halves[prop - 1] && Math.abs(z - tz) < r + this.halves[prop - 1]) return true;
    const fences = this.fences.get(i);
    return !!fences && fences.some(([minX, minZ, maxX, maxZ]) => x + r > minX && x - r < maxX && z + r > minZ && z - r < maxZ);
  }

  // Whether something solid hides what's behind (x, z): buildings, tents,
  // props other than low ones, fences. Water and crops hide nothing.
  blocksSight(x: number, z: number): boolean {
    const tx = toCellX(this.size, x);
    const tz = toCellZ(this.size, z);
    const i = tx * this.size.depth + tz;
    if (this.solid[i]) return true;
    const prop = this.low[i] ? 0 : this.prop[i];
    if (prop && Math.abs(x - tx) < this.halves[prop - 1] && Math.abs(z - tz) < this.halves[prop - 1]) return true;
    return (this.fences.get(i) ?? []).some(([minX, minZ, maxX, maxZ]) => x >= minX && x <= maxX && z >= minZ && z <= maxZ);
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

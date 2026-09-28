// What blocks movement and sight on the map, built once with the world:
// - solid tiles, blocked edge to edge (water, houses, wells, tents);
// - props smaller than a tile (bushes, tree trunks, lamp posts, camp
//   crates): a square around the tile's center; campfires among them are
//   too low to hide anyone;
// - fences and palisades: thin strips along tile edges.
// Walkers are squares of half-width r checked at all four corners, so none
// sinks halfway into a wall before its center crosses the edge.

import { NEIGHBORS_4, cellKey, inBounds, toCellX, toCellZ, type MapSize } from './grid';

export type Point = { x: number; z: number };

export class Obstacles {
  private readonly propFootprints = new Map<string, number>(); // tile key -> half-size of the square blocked
  private readonly lowProps = new Set<string>(); // props too low to hide anyone
  // Fence strips as axis-aligned rectangles [minX, minZ, maxX, maxZ], keyed by the tile they're in.
  private readonly fences = new Map<string, Array<[number, number, number, number]>>();

  constructor(
    private readonly size: MapSize,
    private readonly lakeMap: boolean[][],
    private readonly solid: Set<string>, // tiles blocked edge to edge (besides water)
  ) {}

  addSolid(x: number, z: number): void {
    this.solid.add(cellKey(x, z));
  }

  // A square prop of half-size `half` in the middle of tile (x, z); `low`
  // ones (a campfire) block walking but not sight.
  addProp(x: number, z: number, half: number, low = false): void {
    const key = cellKey(x, z);
    this.propFootprints.set(key, half);
    if (low) this.lowProps.add(key);
  }

  // A blocking strip `thickness` thick along one edge (`side`, NEIGHBORS_4) of tile (x, z).
  addFenceStrip(x: number, z: number, side: number, thickness: number): void {
    const [dx, dz] = NEIGHBORS_4[side];
    const t = thickness;
    const rect: [number, number, number, number] =
      dx !== 0
        ? [dx > 0 ? x + 0.5 - t : x - 0.5, z - 0.5, dx > 0 ? x + 0.5 : x - 0.5 + t, z + 0.5]
        : [x - 0.5, dz > 0 ? z + 0.5 - t : z - 0.5, x + 0.5, dz > 0 ? z + 0.5 : z - 0.5 + t];
    const key = cellKey(x, z);
    this.fences.set(key, [...(this.fences.get(key) ?? []), rect]);
  }

  // A tile one can stand in the middle of: on the map, dry, and free of
  // buildings and props.
  isOpenTile(x: number, z: number): boolean {
    const key = cellKey(x, z);
    return inBounds(this.size, x, z) && !this.lakeMap[x][z] && !this.solid.has(key) && !this.propFootprints.has(key);
  }

  // Whether a walker of half-width r can't stand at (x, z).
  isBlocked(x: number, z: number, r: number): boolean {
    const corners: Array<[number, number]> = [
      [x - r, z - r],
      [x + r, z - r],
      [x - r, z + r],
      [x + r, z + r],
    ];
    return corners.some(([cx, cz]) => {
      const tx = toCellX(this.size, cx);
      const tz = toCellZ(this.size, cz);
      const key = cellKey(tx, tz);
      if (this.lakeMap[tx][tz] || this.solid.has(key)) return true;
      // A prop's square lies inside its tile, so checking the tiles the
      // corners touch finds every prop the walker could overlap; same for fences.
      const half = this.propFootprints.get(key);
      if (half !== undefined && Math.abs(x - tx) < r + half && Math.abs(z - tz) < r + half) return true;
      return (this.fences.get(key) ?? []).some(([minX, minZ, maxX, maxZ]) => x + r > minX && x - r < maxX && z + r > minZ && z - r < maxZ);
    });
  }

  // Whether something solid hides what's behind (x, z): buildings, tents,
  // props other than low ones, fences. Water and crops hide nothing.
  blocksSight(x: number, z: number): boolean {
    const tx = toCellX(this.size, x);
    const tz = toCellZ(this.size, z);
    const key = cellKey(tx, tz);
    if (this.solid.has(key)) return true;
    const half = this.lowProps.has(key) ? undefined : this.propFootprints.get(key);
    if (half !== undefined && Math.abs(x - tx) < half && Math.abs(z - tz) < half) return true;
    return (this.fences.get(key) ?? []).some(([minX, minZ, maxX, maxZ]) => x >= minX && x <= maxX && z >= minZ && z <= maxZ);
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

// The world's tiles as the game reads them: each one's height (its tier), whether it's under a lake, and what its
// surface is, by where it is on the map (whole tiles: x, z). However the world's kept (a classic world made whole,
// one patch; a streamed one a region at a time, worldgen/regions.ts), this is all anything past its making sees of
// it. A tile off the map, or not made yet, is flat dry natural ground at tier 0, and `has` says so.

import type { Surface } from '../types';
import type { MapSize } from './grid';

export const SURFACES: readonly Surface[] = ['natural', 'path', 'plaza', 'field'];
const SURFACE_INDEX = new Map(SURFACES.map((s, i) => [s, i]));

export interface Tiles {
  readonly size: MapSize; // the whole map's
  has(x: number, z: number): boolean; // on the map, and made
  height(x: number, z: number): number;
  lake(x: number, z: number): boolean;
  surface(x: number, z: number): Surface;
}

// A rectangle of tiles (a classic world's whole map, or one region of a streamed one), kept flat: a byte a tile for
// each of its height, water and surface (a big map has millions of tiles).
export class TilePatch implements Tiles {
  readonly heights: Uint8Array;
  readonly lakes: Uint8Array;
  readonly surfaces: Uint8Array;

  constructor(
    readonly size: MapSize, // the whole map's
    readonly x0: number, // where it starts, on the map
    readonly z0: number,
    readonly width: number,
    readonly depth: number,
    made?: { heights: Uint8Array; lakes: Uint8Array; surfaces: Uint8Array }, // (its bytes as made elsewhere: off the game's thread)
  ) {
    this.heights = made?.heights ?? new Uint8Array(width * depth);
    this.lakes = made?.lakes ?? new Uint8Array(width * depth);
    this.surfaces = made?.surfaces ?? new Uint8Array(width * depth);
  }

  // A patch as handed between threads (its fields, no longer a TilePatch), made one again (its bytes kept, not copied).
  static of(size: MapSize, data: Pick<TilePatch, 'x0' | 'z0' | 'width' | 'depth' | 'heights' | 'lakes' | 'surfaces'>): TilePatch {
    return new TilePatch(size, data.x0, data.z0, data.width, data.depth, data);
  }

  // A patch from a world's maps as made ([x][z], local to it), at (x0, z0) on a map of `size`.
  static fromMaps(size: MapSize, x0: number, z0: number, maps: { heightMap: readonly (readonly number[])[]; lakeMap: readonly (readonly boolean[])[]; surfaceMap: readonly (readonly Surface[])[] }): TilePatch {
    const [width, depth] = [maps.heightMap.length, maps.heightMap[0]?.length ?? 0];
    const patch = new TilePatch(size, x0, z0, width, depth);
    for (let x = 0; x < width; x++) {
      const [h, l, s] = [maps.heightMap[x], maps.lakeMap[x], maps.surfaceMap[x]];
      for (let z = 0; z < depth; z++) {
        const i = x * depth + z;
        patch.heights[i] = h[z];
        patch.lakes[i] = l[z] ? 1 : 0;
        patch.surfaces[i] = SURFACE_INDEX.get(s[z]) ?? 0;
      }
    }
    return patch;
  }

  // Its index of (x, z), or -1 off it.
  at(x: number, z: number): number {
    const [u, v] = [x - this.x0, z - this.z0];
    return u >= 0 && v >= 0 && u < this.width && v < this.depth ? u * this.depth + v : -1;
  }

  has(x: number, z: number): boolean {
    return this.at(x, z) >= 0;
  }

  height(x: number, z: number): number {
    const i = this.at(x, z);
    return i < 0 ? 0 : this.heights[i];
  }

  lake(x: number, z: number): boolean {
    const i = this.at(x, z);
    return i >= 0 && this.lakes[i] === 1;
  }

  surface(x: number, z: number): Surface {
    const i = this.at(x, z);
    return i < 0 ? 'natural' : SURFACES[this.surfaces[i]];
  }
}

// A world's maps as made ([x][z], the whole map), read as tiles where they are, nothing copied: for what's placed
// while it's still being made (ruins, camps: worldgen/world.ts).
export function mapsAsTiles(maps: { heightMap: readonly (readonly number[])[]; lakeMap: readonly (readonly boolean[])[]; surfaceMap: readonly (readonly Surface[])[] }): Tiles {
  const size = { width: maps.heightMap.length, depth: maps.heightMap[0]?.length ?? 0 };
  const has = (x: number, z: number) => x >= 0 && z >= 0 && x < size.width && z < size.depth;
  return {
    size,
    has,
    height: (x, z) => (has(x, z) ? maps.heightMap[x][z] : 0),
    lake: (x, z) => has(x, z) && maps.lakeMap[x][z],
    surface: (x, z) => (has(x, z) ? maps.surfaceMap[x][z] : 'natural'),
  };
}

// A streamed world's tiles: the patches of the regions made (each `pageSize` a side), as one map; a tile of a region
// not made (or let go) is off it, as off the map.
export class RegionTiles implements Tiles {
  private readonly patches = new Map<number, TilePatch>();
  private last: TilePatch | null = null; // (the patch asked last: most asks are near the one before)
  private readonly across: number;

  constructor(
    readonly size: MapSize,
    private readonly pageSize: number,
  ) {
    this.across = Math.ceil(size.depth / pageSize);
  }

  add(patch: TilePatch): void {
    this.patches.set(Math.floor(patch.x0 / this.pageSize) * this.across + Math.floor(patch.z0 / this.pageSize), patch);
  }

  remove(px: number, pz: number): void {
    if (this.last === this.patches.get(px * this.across + pz)) this.last = null;
    this.patches.delete(px * this.across + pz);
  }

  private patchAt(x: number, z: number): TilePatch | null {
    const last = this.last;
    if (last && x >= last.x0 && z >= last.z0 && x < last.x0 + last.width && z < last.z0 + last.depth) return last;
    if (x < 0 || z < 0 || x >= this.size.width || z >= this.size.depth) return null;
    const patch = this.patches.get(Math.floor(x / this.pageSize) * this.across + Math.floor(z / this.pageSize)) ?? null;
    if (patch) this.last = patch;
    return patch;
  }

  has(x: number, z: number): boolean {
    return !!this.patchAt(x, z);
  }

  height(x: number, z: number): number {
    return this.patchAt(x, z)?.height(x, z) ?? 0;
  }

  lake(x: number, z: number): boolean {
    return this.patchAt(x, z)?.lake(x, z) ?? false;
  }

  surface(x: number, z: number): Surface {
    return this.patchAt(x, z)?.surface(x, z) ?? 'natural';
  }
}

// A streamed world kept made round the hero (worldgen/regions.ts, liveWorld.ts): each frame the regions within
// LOAD_REACH of where they are on the map asked for (made and peopled off the game's thread, where it can be: a
// RegionSource, LiveWorld.build), one made put in (adopted: a few milliseconds), one past KEEP_REACH let go (the gap
// between, so walking along a border never makes and lets go the same one over and over). Far enough ahead that a
// region's in long before the hero could walk to it.

import { LiveWorld, type RegionBuilt } from './liveWorld';
import { STREAMED_SIZE as STREAMED, generateRegionLand } from '../worldgen/regions';
import type { MapSize } from '../map/grid';

const LOAD_REACH = 320; // tiles round the hero within which every region's made
const KEEP_REACH = 768; // and past which one's let go

// Where regions come from: asked for, handed back made and peopled (at once, or a while after: a worker's).
export interface RegionSource {
  request(rx: number, rz: number): void;
  ready(): RegionBuilt[]; // those made since last asked
}

// A region of a streamed world of `seed`, made and peopled (a worker's work: regionWorker.ts).
export const buildRegion = (seed: number, size: MapSize, rx: number, rz: number): RegionBuilt => LiveWorld.build(seed, size, generateRegionLand(seed, rx, rz, size));

// Regions made at once, as asked (tests, tools; and where no worker can be had).
export class SyncSource implements RegionSource {
  private readonly made: RegionBuilt[] = [];

  constructor(
    private readonly seed: number,
    private readonly size: MapSize = STREAMED,
  ) {}

  request(rx: number, rz: number): void {
    this.made.push(buildRegion(this.seed, this.size, rx, rz));
  }

  ready(): RegionBuilt[] {
    return this.made.splice(0);
  }
}

export class WorldStreamer {
  private readonly asked = new Set<number>(); // regions asked for, not yet put in
  private readonly arrived: RegionBuilt[] = []; // made, waiting their turn to be put in

  constructor(
    private readonly world: LiveWorld,
    private readonly source: RegionSource,
  ) {}

  // The regions (rx, rz) within `reach` tiles of (x, z), on the map.
  private within(x: number, z: number, reach: number): Array<[number, number]> {
    const r = this.world.regionSize;
    const [x0, x1] = [Math.max(0, Math.floor((x - reach) / r)), Math.min(Math.ceil(this.world.size.width / r) - 1, Math.floor((x + reach) / r))];
    const [z0, z1] = [Math.max(0, Math.floor((z - reach) / r)), Math.min(Math.ceil(this.world.size.depth / r) - 1, Math.floor((z + reach) / r))];
    const out: Array<[number, number]> = [];
    for (let rx = x0; rx <= x1; rx++) for (let rz = z0; rz <= z1; rz++) out.push([rx, rz]);
    return out;
  }

  // Each frame: those near asked for, one arrived put in, one far let go.
  update(at: { x: number; z: number }): void {
    const { world } = this;
    for (const [rx, rz] of this.within(at.x, at.z, LOAD_REACH)) {
      const index = world.regionIndex(rx, rz);
      if (world.isLoaded(rx, rz) || this.asked.has(index)) continue;
      this.asked.add(index);
      this.source.request(rx, rz);
    }
    this.arrived.push(...this.source.ready());
    const built = this.arrived.shift(); // (one a frame)
    if (built && this.asked.delete(world.regionIndex(built.rx, built.rz))) world.adopt(built); // (unless let go while it was being made)
    const keep = new Set(this.within(at.x, at.z, KEEP_REACH).map(([rx, rz]) => world.regionIndex(rx, rz)));
    const far = world.loaded().find((index) => !keep.has(index)); // (one a frame: each a few milliseconds' letting go)
    if (far !== undefined) world.unload(...world.regionAt(far));
    for (const index of [...this.asked]) if (!keep.has(index)) this.asked.delete(index);
  }

  // Before play: the regions round (x, z) made and peopled now, all of them.
  prime(at: { x: number; z: number }): void {
    for (const [rx, rz] of this.within(at.x, at.z, LOAD_REACH)) {
      if (this.world.isLoaded(rx, rz)) continue;
      this.world.adopt(buildRegion(this.seed, this.world.size, rx, rz));
    }
  }

  private get seed(): number {
    return this.world.seed;
  }
}

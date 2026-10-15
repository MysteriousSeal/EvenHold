// The map of the land the hero's walked (M: controller/atlas/mapWindow.ts): what they've seen of it (fog.ts), what the
// seed made there, charted a chunk at a time and kept for the game (chart.ts: asked of a ChartSource, a worker's in the
// game), and the places come upon out in the wilds (a crypt, a cave, a stronghold, a bandit camp: within sight of
// them once), each struck through once cleared (its boss slain; a camp's crew). Others' marks are put on it by name
// (marks: a purse dropped where the hero fell, say). Saved: the fog, and the places found.

import type { MapSize } from '../map/grid';
import type { Tiles } from '../map/tiles';
import type { Camp } from '../camps/camps';
import { campLevel } from '../camps/camps';
import { campName } from '../camps/campNames';
import type { Entrance } from '../interiors/interiors';
import { dungeonAt } from '../dungeons/dungeons';
import { BOSS_POST } from '../dungeons/dungeonRecord';
import { generateRegionLand } from '../worldgen/regions';
import { chartOf, chartOfLand, type Chart, type ChartLand } from './chart';
import { CHUNK, Fog, SIGHT } from './fog';

export type PlaceKind = 'crypt' | 'cave' | 'stronghold' | 'camp';

// A place come upon: what, where, its name and level, its key (a dungeon's record's, dungeons.ts; a camp's, by where
// it stands), and whether it's been cleared.
export interface Place {
  kind: PlaceKind;
  x: number;
  z: number;
  name: string;
  level: number;
  key: string;
  cleared: boolean;
}

// A mark on the map (mapPins.ts gathers them): what it's for, where, and what it says.
export interface MapPin {
  kind: 'quest' | 'story' | 'bounty' | 'purse' | 'board';
  x: number;
  z: number;
  label: string;
}

// Where charts come from: asked for, handed back charted (at once, or a while after: a worker's).
export interface ChartSource {
  request(cx: number, cz: number): void;
  ready(): Chart[];
}

export interface AtlasHost {
  readonly seed: number;
  readonly size: MapSize;
  readonly streamed: boolean;
  readonly tiles: Tiles;
  readonly hero: { x: number; z: number };
  readonly inside: unknown;
  readonly world: { contents(index: number): Omit<ChartLand, 'tiles'> | null }; // (a classic world's, all in its one region)
  readonly crypts: ReadonlyArray<{ entrance: Entrance }>;
  readonly caves: ReadonlyArray<{ entrance: Entrance }>;
  readonly strongholds: ReadonlyArray<{ entrance: Entrance }>;
  readonly camps: readonly Camp[];
  readonly cryptsCleared: ReadonlyMap<string, ReadonlySet<number>>;
  campEmpty(camp: Camp): boolean;
}

// Charts made at once, as asked (tests; and where no worker can be had): a streamed world's from its region's land
// (made afresh: a few hundred milliseconds), a classic world's from the world made whole.
export class SyncCharts implements ChartSource {
  private readonly made: Chart[] = [];

  constructor(private readonly host: AtlasHost) {}

  request(cx: number, cz: number): void {
    const { seed, size, streamed, tiles } = this.host;
    const whole = this.host.world.contents(0);
    if (streamed) this.made.push(chartOfLand(seed, size, generateRegionLand(seed, cx, cz, size)));
    else if (whole) this.made.push(chartOf(seed, size, cx, cz, { ...whole, tiles }));
  }

  ready(): Chart[] {
    return this.made.splice(0);
  }
}

export class Atlas {
  readonly fog: Fog;
  readonly marks = new Map<string, () => readonly MapPin[]>(); // others' marks, by whose (a purse dropped: keeper's)
  private readonly charts = new Map<number, Chart>(); // by chunk number (fog.ts chunkOf)
  private readonly asked = new Set<number>();
  private readonly found = new Map<string, Place>(); // by key
  private readonly camps = new Map<string, Camp>(); // the camps found, this game (to look at their crew)
  private source: ChartSource | null = null;

  constructor(private readonly host: AtlasHost) {
    this.fog = new Fog(host.size);
  }

  // Where its charts come from (the game's: workers; else made at once, as asked).
  chartsFrom(source: ChartSource): void {
    this.source = source;
  }

  // Each frame: outdoors, what's within sight of the hero seen, the places there come upon.
  update(): void {
    if (this.host.inside) return;
    const { hero } = this.host;
    if (this.fog.walk(hero.x, hero.z)) this.look(hero.x, hero.z);
  }

  // The places within sight of (x, z), come upon.
  private look(x: number, z: number): void {
    const near = (p: { x: number; z: number }) => Math.abs(p.x - x) <= SIGHT && Math.abs(p.z - z) <= SIGHT && Math.hypot(p.x - x, p.z - z) <= SIGHT;
    for (const { entrance } of [...this.host.crypts, ...this.host.caves, ...this.host.strongholds]) {
      if (!near(entrance)) continue;
      const place = dungeonAt(entrance);
      if (place && !this.found.has(place.key)) this.found.set(place.key, { kind: place.kind, x: Math.round(entrance.x), z: Math.round(entrance.z), name: place.name, level: place.level, key: place.key, cleared: false });
    }
    for (const camp of this.host.camps) {
      if (!near(camp)) continue;
      const key = `camp:${camp.x},${camp.z}`;
      this.camps.set(key, camp);
      if (!this.found.has(key)) this.found.set(key, { kind: 'camp', x: camp.x, z: camp.z, name: campName(camp, this.host.seed), level: campLevel(camp, this.host.size), key, cleared: false });
    }
  }

  // The places come upon, each cleared or not as it stands now (a dungeon's boss slain; a camp's crew, where it's made).
  places(): readonly Place[] {
    for (const place of this.found.values()) {
      if (place.cleared) continue;
      const camp = this.camps.get(place.key);
      place.cleared = camp ? this.host.campEmpty(camp) : !!this.host.cryptsCleared.get(place.key)?.has(BOSS_POST);
    }
    return [...this.found.values()];
  }

  // Chunk (cx, cz)'s chart, if it's charted yet (else asked for: there a while after).
  chart(cx: number, cz: number): Chart | null {
    this.take();
    const n = this.fog.chunkOf(cx, cz);
    const chart = this.charts.get(n);
    if (chart || this.asked.has(n) || cx < 0 || cz < 0 || cx * CHUNK >= this.host.size.width || cz * CHUNK >= this.host.size.depth) return chart ?? null;
    this.asked.add(n);
    (this.source ??= new SyncCharts(this.host)).request(cx, cz);
    this.take();
    return this.charts.get(n) ?? null;
  }

  // Those charted since last asked, kept.
  private take(): void {
    for (const chart of this.source?.ready() ?? []) this.charts.set(this.fog.chunkOf(chart.cx, chart.cz), chart);
  }

  // Every mark others have put on the map.
  marked(): MapPin[] {
    return [...this.marks.values()].flatMap((marks) => [...marks()]);
  }

  // For saving: the land seen, the places found.
  save(): { seen: Record<string, string>; places: Place[] } {
    return { seen: this.fog.save(), places: [...this.found.values()].map((p) => ({ ...p })) };
  }

  // Back from a save. One from before the map (none seen): the land seen round each of `around` (where the hero is,
  // the villages been to).
  load(saved: unknown, around: ReadonlyArray<{ x: number; z: number }> = []): void {
    const data = (saved && typeof saved === 'object' ? saved : {}) as { seen?: unknown; places?: unknown };
    this.found.clear();
    const kinds: readonly unknown[] = ['crypt', 'cave', 'stronghold', 'camp'];
    for (const p of Array.isArray(data.places) ? data.places : []) {
      if (!p || typeof p !== 'object' || !kinds.includes(p.kind) || typeof p.key !== 'string' || typeof p.name !== 'string' || ![p.x, p.z, p.level].every(Number.isFinite)) continue;
      this.found.set(p.key, { kind: p.kind, x: p.x, z: p.z, name: p.name, level: p.level, key: p.key, cleared: p.cleared === true });
    }
    if (this.fog.load(data.seen)) return;
    for (const at of around) this.fog.reveal(at.x, at.z);
  }
}

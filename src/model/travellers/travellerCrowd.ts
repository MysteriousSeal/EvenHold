// Everyone on the roads: a classic world's one band of travellers (travellers.ts), or a streamed world's a band to each
// region made (its own roads, between its own villages: each region's roads its own), seen as one: everyone in one
// list, each walking on their own region's roads, held (a word with the hero) by their own band.

import type { Enemy } from '../types';
import type { Road } from '../worldgen/roads';
import type { Traveller, Travellers } from './travellers';

export class TravellerCrowd {
  private readonly all: Traveller[] = []; // everyone on the roads made, of every band
  private readonly bands = new Map<number, Travellers>();
  private readonly bandOf = new Map<Traveller, Travellers>();

  // Everyone on the roads: a classic world's band's own list (the same: changed, changed for them), else all of them.
  get list(): Traveller[] {
    return this.bands.size === 1 ? this.only!.list : this.all;
  }

  private get only(): Travellers | null {
    return this.bands.size === 1 ? this.bands.values().next().value! : null;
  }

  // The band `t` walks with.
  private bandFor(t: Traveller): Travellers | undefined {
    return this.bandOf.get(t) ?? this.only ?? undefined;
  }

  // A region's band (`key`: its region's), on the roads with the rest; or let go.
  add(key: number, band: Travellers): void {
    this.bands.set(key, band);
    for (const t of band.list) this.bandOf.set(t, band);
    for (const t of band.list) this.all.push(t);
  }

  remove(key: number): void {
    const band = this.bands.get(key);
    if (!band) return;
    this.bands.delete(key);
    for (const t of band.list) this.bandOf.delete(t);
    const gone = new Set(band.list);
    let kept = 0;
    for (const t of this.all) if (!gone.has(t)) this.all[kept++] = t;
    this.all.length = kept;
  }

  // The road `t` walks (theirs: their band's, by its index).
  roadOf(t: Traveller): Road {
    return this.bandFor(t)!.roads[t.road];
  }

  // A classic world's roads (its one band's); a streamed world's: none here (each region's its own: roadOf).
  get roads(): readonly Road[] {
    return this.only?.roads ?? [];
  }

  update(dt: number, enemies: readonly Enemy[] = []): void {
    for (const band of this.bands.values()) band.update(dt, enemies);
  }

  hold(t: Traveller, seconds: number): void {
    this.bandFor(t)?.hold(t, seconds);
  }

  // Where everyone is, for the save: a classic world's (its one band); a streamed world's set out afresh with their
  // regions, kept nowhere.
  save(): ReturnType<Travellers['save']> {
    return this.only?.save() ?? { v: 0, on: [] };
  }

  load(saved: ReturnType<Travellers['save']>): void {
    const band = this.only;
    if (!band) return;
    band.load(saved);
    this.bandOf.clear();
    for (const t of band.list) this.bandOf.set(t, band);
  }
}

// The dead walk at night: from RISE till DAWN, near every crypt within reach of the hero, a band of the barrow dead
// rises on the nearest road (out of the hero's sight) and walks it, slowly, up and down a stretch of it (WALK_SPAN
// each way), skeletons and, past the first levels, a draugr among them (the drowned and the barrow-wights). In fours,
// a level under the land's own foes (a risk, not a wall); what they leave as any of their kind does (old silver,
// grave gear). After arc 2's begun, the false saint's "miracles" call more: a second band at every crypt within
// SAINT_REACH of the cathedral. Each crypt's band rises once a night (cut down, it stays down till the next). Dawn
// sends them back: those still walking sink into the ground, gone. Never kept in a save but which crypts' bands are
// spent tonight.
import { enemyLevel, zoneLevel } from '../enemies/enemyLevels';
import { makeEnemy } from '../enemies/enemies';
import { spawnOf } from '../map/grid';
import { DAY_MINUTES, between } from '../clock';
import type { Enemy, EnemyKind } from '../types';
import type { GameModel } from '../GameModel';
import type { Road } from '../worldgen/roads';
import { hashUnit } from '../../util/random';

export const RISE = 22; // the hour they rise
export const DAWN = 5; // and go back
export const BAND = 4; // to a band
const REACH = 90; // tiles: crypts this near the hero raise theirs
const ROAD_REACH = 45; // tiles: a crypt's road, at most this far from it
const UNSEEN = 22; // tiles from the hero, at least, where they rise
const GONE = 130; // tiles: the hero this far, they're let go (risen again tomorrow night, if not cut down)
const WALK = 0.35; // tiles a second they go along the road
const WALK_SPAN = 40; // tiles each way along it from where they rose
const DRAUGR_FROM = 4; // the level a draugr walks with them from
const SAINT_REACH = 300; // tiles from the cathedral: a second band, once arc 2's begun
const NIGHT_ID = 2 ** 47 + 2 ** 40; // their ids: past the witch-finders' (patrols.ts), short of a streamed world's own
const RANK = 0.7; // tiles between them, walking
const LOOK = 1; // seconds between looks for crypts near enough to rise from

interface Band {
  key: string; // its crypt's, and which of its bands
  route: Array<[number, number]>;
  from: number; // where along the route it rose
  along: number; // and is now
  way: 1 | -1;
  foes: Enemy[];
}

// Whether the dead are out at `minutes`.
export const deadHours = (minutes: number): boolean => between(minutes, RISE, DAWN);
// Which night it is (from its evening to the next morning): its day's number.
export const nightOf = (minutes: number): number => Math.floor((minutes - DAWN * 60 - 60) / DAY_MINUTES);

export class NightDead {
  readonly bands: Band[] = [];
  private spent = new Set<string>(); // the bands risen tonight (cut down or walking), by key
  private night = -1;
  private nextId = NIGHT_ID;
  private sinceLook = LOOK; // (at once, the first frame)
  private readonly roadOf = new Map<string, { route: Array<[number, number]>; at: number }>(); // each crypt's road, by its key

  constructor(private readonly model: GameModel) {}

  update(dt: number): void {
    const { model } = this;
    const night = nightOf(model.minutes);
    if (night !== this.night) [this.night, this.spent] = [night, new Set()];
    if (!deadHours(model.minutes)) return this.dawn();
    for (const band of [...this.bands]) this.walk(band, dt);
    this.sinceLook += dt;
    if (model.inside || this.sinceLook < LOOK) return;
    this.sinceLook = 0;
    for (const key of this.wanted()) if (!this.spent.has(key)) this.rise(key);
  }

  // The bands that would walk tonight round the hero: each crypt near enough's (and its second, near the cathedral).
  private wanted(): string[] {
    const { model } = this;
    const cathedral = model.roads.patrols.arcTwo ? model.roads.patrols.cathedralAt() : null;
    const keys: string[] = [];
    for (const crypt of model.crypts) {
      if (Math.hypot(crypt.middle.x - model.hero.x, crypt.middle.z - model.hero.z) > REACH) continue;
      const key = `${Math.round(crypt.middle.x)},${Math.round(crypt.middle.z)}`;
      keys.push(`${key}:0`);
      if (cathedral && Math.hypot(crypt.middle.x - cathedral.x, crypt.middle.z - cathedral.z) < SAINT_REACH) keys.push(`${key}:1`);
    }
    return keys;
  }

  // A band risen (if its crypt has a road near, and there's a spot on it out of the hero's sight).
  private rise(key: string): void {
    const { model } = this;
    const [x, z] = key.split(':')[0].split(',').map(Number);
    const road = this.roadNear(x, z);
    if (!road) return void this.spent.add(key); // (no road near: none walk from it)
    const second = key.endsWith(':1');
    const from = Math.max(0, Math.min(road.route.length - 1, road.at + (second ? WALK_SPAN / 2 : 0)));
    const [rx, rz] = road.route[Math.round(from)];
    if (Math.hypot(rx - model.hero.x, rz - model.hero.z) < UNSEEN) return; // (in sight: not yet)
    this.spent.add(key);
    const level = zoneLevel(spawnOf(model.size), { x: rx, z: rz });
    const foes: Enemy[] = [];
    for (let i = 0; i < BAND; i++) {
      const kind: EnemyKind = i === 0 && level >= DRAUGR_FROM ? 'draugr' : 'skeleton';
      const id = this.nextId++;
      const [ox, oz] = [((i % 2) - 0.5) * RANK, Math.floor(i / 2) * RANK];
      const foe = makeEnemy(id, kind, rx + ox, rz + oz, rx, rz, Math.max(1, enemyLevel(spawnOf(model.size), rx, rz, i) - 1)); // (a level under the land's own, give or take one)
      foe.y = model.getGroundY(foe.x, foe.z);
      foes.push(foe);
      model.enemies.push(foe);
    }
    this.bands.push({ key, route: road.route, from, along: from, way: hashUnit(x, z, 991) < 0.5 ? 1 : -1, foes });
    if (!this.bands.some((b) => b.key !== key && near(b, model.hero, 60))) model.report({ kind: 'banner', title: 'The dead walk', line: 'Mist on the road, and something in it' });
  }

  // Along the road, a stretch up and down: the band's wanderers' home with it (those set on the hero, theirs).
  private walk(band: Band, dt: number): void {
    const { model } = this;
    const alive = band.foes.filter((e) => e.state !== 'dead');
    if (alive.length === 0 || (alive.every((e) => far(e, model.hero, GONE)))) return this.letGo(band, alive);
    band.along += band.way * WALK * dt;
    const end = band.route.length - 1;
    if (band.along <= Math.max(0, band.from - WALK_SPAN) || band.along >= Math.min(end, band.from + WALK_SPAN)) {
      band.way = band.way > 0 ? -1 : 1;
      band.along = Math.max(0, Math.min(end, band.along));
    }
    const i = Math.min(end - 1, Math.max(0, Math.floor(band.along)));
    const [x0, z0] = band.route[i];
    const [x1, z1] = band.route[i + 1] ?? band.route[i];
    const t = band.along - i;
    const [hx, hz] = [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t];
    for (const e of alive) if (e.state === 'wander') [e.homeX, e.homeZ] = [hx, hz];
  }

  // Gone from the world: the cut-down band forgotten, a band let go (far behind) its foes taken off (risen again,
  // if it's still the night and the hero comes back: it's not spent).
  private letGo(band: Band, alive: readonly Enemy[]): void {
    this.bands.splice(this.bands.indexOf(band), 1);
    if (alive.length === 0) return;
    this.remove(alive);
    this.spent.delete(band.key);
  }

  // Dawn: every band still walking sinks back, gone (told, if any were near the hero).
  private dawn(): void {
    if (this.bands.length === 0) return;
    const seen = this.bands.some((b) => b.foes.some((e) => e.state !== 'dead' && !far(e, this.model.hero, 40)));
    for (const band of this.bands) this.remove(band.foes.filter((e) => e.state !== 'dead'));
    this.bands.length = 0;
    if (seen) this.model.report({ kind: 'banner', title: 'Dawn', line: 'The dead go back to their graves' });
  }

  private remove(foes: readonly Enemy[]): void {
    const { enemies } = this.model;
    for (const e of foes) {
      const at = enemies.indexOf(e);
      if (at >= 0) enemies.splice(at, 1);
    }
  }

  // The road nearest a crypt (within ROAD_REACH), and the point of it nearest: of the roads known (each band's).
  private roadNear(x: number, z: number): { route: Array<[number, number]>; at: number } | null {
    const key = `${x},${z}`;
    if (this.roadOf.has(key)) return this.roadOf.get(key)!;
    let best: { route: Array<[number, number]>; at: number } | null = null;
    let near = ROAD_REACH;
    const roads = new Set<Road>();
    for (const band of this.model.travellers.bands.values()) for (const road of band.roads) roads.add(road);
    for (const road of roads) {
      road.route.forEach(([rx, rz], at) => {
        const d = Math.hypot(rx - x, rz - z);
        if (d < near) [best, near] = [{ route: road.route, at }, d];
      });
    }
    if (best) this.roadOf.set(key, best); // (none: asked again tomorrow night, more of the land made)
    return best;
  }

  // Which crypts' bands are spent tonight, for the save.
  save(): { night: number; spent: string[] } {
    return { night: this.night, spent: [...this.spent].filter((k) => !this.bands.some((b) => b.key === k)) }; // (those walking: risen again)
  }

  load(saved: unknown): void {
    this.bands.length = 0;
    [this.night, this.spent] = [-1, new Set()];
    const s = saved as Partial<ReturnType<NightDead['save']>> | null;
    if (!s || !Number.isInteger(s.night) || !Array.isArray(s.spent)) return;
    this.night = s.night!;
    this.spent = new Set(s.spent.filter((k) => typeof k === 'string'));
  }
}

const far = (a: { x: number; z: number }, b: { x: number; z: number }, d: number): boolean => Math.hypot(a.x - b.x, a.z - b.z) >= d;
const near = (band: Band, hero: { x: number; z: number }, d: number): boolean => band.foes.some((e) => e.state !== 'dead' && !far(e, hero, d));

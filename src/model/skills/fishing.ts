// Fishing (skills.ts): a fishing rod in the bag (loot/tools.ts: a pedlar's), E on a lake's shore (a dry tile beside the
// water) casts it, the line out into the water before them (as far as CAST_REACH, while it's water). Then a wait for a
// bite, shorter the better they are; a bite, the bobber dipping, and a moment (the catch's own: a big one's off quicker) to hook it with E again:
// too late, it gets away. Hooked, it's landed into the bag (full: at their feet, told how many, and the line reeled in), and the line cast
// again on its own, on and on till they walk off or reel in (E while they wait). What bites is by the water and the skill: small fry
// anywhere, and roach from 40; from 75 (a lucky one now and then from 55) river trout in a lake's narrows (its arms and inlets, the
// nearest the world has to a river) and lake perch in its open water; from 110 eels in the narrows; from 150 pike where the bobber
// lies far from any bank (the deep); from 200 char in the open water; from 250 sturgeon in the deep; from 225, now and then, what
// the water hides (a locket, an old coin; a torc in the deep). Each water has a catch that's never grey (an eel, a perch, a pike;
// a char, a sturgeon), so no lake leaves a fisher with nothing to learn. The skill rises as they land them, the surer the harder the catch is
// for them (skills.ts difficulty), with a little of the hero's own experience; the older catches thinning as better ones come; and
// now and then (HUGE) a huge one of the bigger fish, worth three, off the hook the quicker. Nothing of it is kept: a line out isn't saved.

import { NEIGHBORS_4 } from '../map/grid';
import type { LootId } from '../loot/loot';
import type { BagItem } from '../hero/bag';
import { canCarry } from '../hero/bagSlots';
import { addToBag } from '../hero/bag';
import type { GameEvent, Hero } from '../types';
import { gainXp } from '../hero/heroStats';
import { RISE, difficulty, practise, skillOf, tierOf } from './skills';

const SKILL = 'fishing';
// The waters: anywhere; a lake's narrows (little water round the bobber); its open water (much); the deep (no bank
// near the bobber at all).
export type Waters = 'any' | 'narrows' | 'open' | 'deep';
export interface Catch {
  item: LootId;
  needs: number; // the skill it wants
  in: Waters; // where it bites
  weight: number; // how often, against the rest that could
  window: number; // seconds its bite lasts, to hook it in (the bigger, the quicker it's off)
  early?: number; // from this level, now and then (EARLY_WEIGHT) before it's theirs to catch: a lucky one
  fewer?: [number, number]; // from this level, this weight instead (small fry, once there's better about)
  lasting?: boolean; // never grey (one in every water: always something to learn from, wherever they fish)
}
export const CATCHES: readonly Catch[] = [
  { item: 'smallFry', needs: 1, in: 'any', weight: 3, window: 1.2, fewer: [75, 1] },
  { item: 'roach', needs: 40, in: 'any', weight: 3, window: 1.1, fewer: [110, 1] },
  { item: 'riverTrout', needs: 75, in: 'narrows', weight: 4, window: 0.95, early: 55, fewer: [200, 2] },
  { item: 'lakePerch', needs: 75, in: 'open', weight: 4, window: 0.95, early: 55, fewer: [200, 2], lasting: true },
  { item: 'eel', needs: 110, in: 'narrows', weight: 5, window: 0.85, lasting: true },
  { item: 'pike', needs: 150, in: 'deep', weight: 5, window: 0.75, lasting: true, fewer: [250, 2] },
  { item: 'char', needs: 200, in: 'open', weight: 5, window: 0.8, lasting: true },
  { item: 'sturgeon', needs: 250, in: 'deep', weight: 5, window: 0.65, lasting: true },
  { item: 'fadedLocket', needs: 225, in: 'any', weight: 0.25, window: 0.8 }, // (what the water hides: junk/junk.ts)
  { item: 'oldSilver', needs: 225, in: 'any', weight: 0.25, window: 0.8 },
  { item: 'frostTorc', needs: 225, in: 'deep', weight: 0.2, window: 0.8 },
];
const EARLY_WEIGHT = 1;
export const HUGE = { chance: 0.02, worth: 3, quicker: 0.15 }; // now and then a huge one (any but the fry and roach): as much as so many, off the hook quicker
const HUGE_KINDS: readonly LootId[] = ['riverTrout', 'lakePerch', 'eel', 'pike', 'char', 'sturgeon'];
// The fish of them (the rest found in the water): raw, for the pot, and sold at their worth to a pedlar or a herbalist.
export const FISH: readonly LootId[] = ['smallFry', 'roach', 'riverTrout', 'lakePerch', 'eel', 'pike', 'char', 'sturgeon'];
export const isFish = (item: string): item is LootId => (FISH as readonly string[]).includes(item);
// How often a catch bites for a hand at `level`, against the rest (0: not for them yet).
export const weightOf = (fish: Catch, level: number): number =>
  level >= fish.needs ? (fish.fewer && level >= fish.fewer[0] ? fish.fewer[1] : fish.weight) : fish.early !== undefined && level >= fish.early ? EARLY_WEIGHT : 0;
// How hard a catch is for a hand at `level`, and how likely landing it teaches (skills.ts RISE): a lasting one's
// never less than green.
export const riseOf = (fish: Catch, level: number) => {
  const rise = difficulty(fish.needs, level);
  return fish.lasting && rise.chance === 0 ? RISE[2] : rise;
};

export const CAST_REACH = 3; // tiles out from the shore the line goes, at most (while it's water)
const DEEP = 2; // tiles round the bobber all water: the deep
const NARROWS = 3; // tiles round the bobber looked over for how much is water
const NARROW_SHARE = 0.6; // less of it water than this: the narrows
const WAIT: [number, number] = [3, 8]; // seconds for a bite, least and most, at the skill's first tier
const QUICKER = 0.12; // of the wait shorter, each tier on
const LANDED = 0.9; // seconds landing it takes, before the line's cast again
const HERO_XP = 2; // the hero's own experience, a catch

export interface FishingHost {
  readonly hero: Hero;
  readonly tiles: { lake(x: number, z: number): boolean };
  readonly inside: unknown | null;
  readonly yard: unknown | null;
  dropLoot(item: BagItem, x: number, z: number): void;
  report(event: GameEvent): void;
}

// The water a line's in: the bobber's tile, and what water it is.
export interface Spot {
  x: number;
  z: number;
  narrows: boolean;
  deep: boolean;
}

// What E would do on a shore (the prompt): cast; or not, and why (no rod in the bag).
export type FishAction = { kind: 'fish'; spot: Spot } | { kind: 'cannot'; spot: Spot; why: 'rod' };

// A line out: where, and how it stands (waiting for a bite, a bite on, a catch being landed), seconds into it.
export interface Line {
  spot: Spot;
  phase: 'waiting' | 'bite' | 'landed';
  t: number;
  wait: number; // seconds till the bite, waiting
  caught?: LootId; // what's biting, and then being landed
  window?: number; // seconds its bite lasts
  huge?: boolean; // a huge one (HUGE)
}

// The water at (x, z): whether it's the narrows, the deep.
export function spotAt(tiles: FishingHost['tiles'], x: number, z: number): Spot {
  let [water, all, deep] = [0, 0, true];
  for (let dx = -NARROWS; dx <= NARROWS; dx++) {
    for (let dz = -NARROWS; dz <= NARROWS; dz++) {
      const wet = tiles.lake(x + dx, z + dz);
      [all, water] = [all + 1, water + (wet ? 1 : 0)];
      if (!wet && Math.max(Math.abs(dx), Math.abs(dz)) <= DEEP) deep = false;
    }
  }
  return { x, z, narrows: water / all < NARROW_SHARE, deep };
}

// Whether a catch bites at a spot.
export const bitesAt = (fish: Catch, spot: Pick<Spot, 'narrows' | 'deep'>): boolean =>
  fish.in === 'any' || (fish.in === 'deep' ? spot.deep : fish.in === 'narrows' ? spot.narrows : !spot.narrows);

// What could bite at a spot, for a hand at `level`.
export const catchesAt = (spot: Pick<Spot, 'narrows' | 'deep'>, level: number): Catch[] => CATCHES.filter((fish) => weightOf(fish, level) > 0 && bitesAt(fish, spot));

// One of them, by their weights (`roll`: 0..1).
export function pickCatch(spot: Pick<Spot, 'narrows' | 'deep'>, level: number, roll: number): Catch {
  const can = catchesAt(spot, level);
  let left = roll * can.reduce((sum, fish) => sum + weightOf(fish, level), 0);
  for (const fish of can) if ((left -= weightOf(fish, level)) < 0) return fish;
  return can[can.length - 1];
}

export class Fishing {
  line: Line | null = null;
  private full = false; // the last catch didn't all fit: reeled in once it's landed

  constructor(
    private readonly host: FishingHost,
    private readonly rng: () => number = Math.random,
  ) {}

  // Whether there's a rod in the bag.
  get rod(): boolean {
    return (this.host.hero.bag.fishingRod ?? 0) > 0;
  }

  // The water a line would go into from where the hero stands: their tile dry, and water beside it (of the four sides,
  // the one they face most); out along that way as far as CAST_REACH while it's water. None: not on a shore.
  get spotInReach(): Spot | null {
    const { hero, tiles, inside, yard } = this.host;
    if (inside || yard) return null;
    const [hx, hz] = [Math.round(hero.x), Math.round(hero.z)];
    if (tiles.lake(hx, hz)) return null;
    const [fx, fz] = [Math.sin(hero.facing), Math.cos(hero.facing)];
    const side = NEIGHBORS_4.filter(([dx, dz]) => tiles.lake(hx + dx, hz + dz)).sort(([ax, az], [bx, bz]) => bx * fx + bz * fz - (ax * fx + az * fz))[0];
    if (!side) return null;
    const [dx, dz] = side;
    let out = 1;
    while (out < CAST_REACH && tiles.lake(hx + dx * (out + 1), hz + dz * (out + 1))) out++;
    return spotAt(tiles, hx + dx * out, hz + dz * out);
  }

  // What E would do on the shore, if they're on one.
  get action(): FishAction | null {
    const spot = this.spotInReach;
    if (!spot) return null;
    return this.rod ? { kind: 'fish', spot } : { kind: 'cannot', spot, why: 'rod' };
  }

  // Whether a fish is on the line, to be hooked now.
  get biting(): boolean {
    return this.line?.phase === 'bite';
  }

  // Seconds a bite's wait at the hero's skill, least and most (shorter each tier on).
  get waitSeconds(): [number, number] {
    const quicker = 1 - QUICKER * tierOf(skillOf(this.host.hero, SKILL).level).index;
    return [WAIT[0] * quicker, WAIT[1] * quicker];
  }

  // E: the line cast (facing the water), on a shore with a rod; a line out, a bite hooked, or (waiting) reeled in.
  use(): boolean {
    const line = this.line;
    if (line) {
      if (line.phase === 'bite') this.hook(line);
      else if (line.phase === 'waiting') this.stop();
      return true;
    }
    const action = this.action;
    if (action?.kind !== 'fish') return false;
    const { hero } = this.host;
    hero.facing = Math.atan2(action.spot.x - hero.x, action.spot.z - hero.z); // (facing the water)
    this.cast(action.spot);
    return true;
  }

  stop(): void {
    [this.line, this.full] = [null, false];
  }

  // How far through a bite's moment (0..1), a bite on; else null (its bar).
  get progress(): number | null {
    return this.line?.phase === 'bite' ? Math.min(1, this.line.t / (this.line.window ?? 1)) : null;
  }

  // A moment of it: stopped if they've walked off (or lost their rod, or gone in); else the wait, the bite, the landing.
  update(dt: number, moving: boolean): void {
    const line = this.line;
    if (!line) return;
    if (moving || this.host.inside || this.host.yard || !this.rod) return this.stop();
    line.t += dt;
    if (line.phase === 'waiting' && line.t >= line.wait) this.bite(line);
    else if (line.phase === 'bite' && line.t >= (line.window ?? 0)) {
      this.host.report({ kind: 'fished', item: null, x: line.spot.x, z: line.spot.z }); // (too late: it got away)
      this.cast(line.spot);
    } else if (line.phase === 'landed' && line.t >= LANDED) {
      if (!this.full) return this.cast(line.spot);
      this.stop();
      this.host.report({ kind: 'poor', text: 'Your bag is full' }); // (as cooking stops)
    }
  }

  // The line out into `spot`, waiting for a bite.
  private cast(spot: Spot): void {
    const [least, most] = this.waitSeconds;
    this.line = { spot, phase: 'waiting', t: 0, wait: least + this.rng() * (most - least) };
  }

  // A bite: what it is, by the water and their skill (so a big one's off quicker: its own moment to hook it in).
  private bite(line: Line): void {
    const fish = pickCatch(line.spot, skillOf(this.host.hero, SKILL).level, this.rng());
    const huge = HUGE_KINDS.includes(fish.item) && this.rng() < HUGE.chance;
    Object.assign(line, { phase: 'bite', t: 0, caught: fish.item, window: fish.window - (huge ? HUGE.quicker : 0), huge });
  }

  // A bite hooked: landed into the bag (full: at their feet), the skill maybe risen (by what it is: a lucky one, before
  // its level, the surest of all), some of the hero's own experience.
  private hook(line: Line): void {
    const { hero } = this.host;
    const level = skillOf(hero, SKILL).level;
    const fish = CATCHES.find((c) => c.item === line.caught) ?? pickCatch(line.spot, level, this.rng());
    let dropped = 0; // (what the bag hasn't room for: at their feet)
    for (let n = 0; n < (line.huge ? HUGE.worth : 1); n++) {
      if (canCarry(hero, fish.item)) addToBag(hero.bag, fish.item); // (a huge one: as good as so many, for the pot or the purse)
      else this.host.dropLoot(fish.item, hero.x + dropped++ * 0.15, hero.z);
    }
    Object.assign(line, { phase: 'landed', t: 0, caught: fish.item });
    this.host.report({ kind: 'fished', item: fish.item, x: line.spot.x, z: line.spot.z, ...(dropped && { dropped }), ...(line.huge && { huge: true }) });
    if (dropped) this.full = true; // (landed, then reeled in: no more cast to pile on the shore)
    gainXp(hero, HERO_XP);
    practise(hero, SKILL, fish.needs, this.rng(), this.host.report, riseOf(fish, level).chance);
  }
}

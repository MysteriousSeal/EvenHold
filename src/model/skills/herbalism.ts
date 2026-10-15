// Herbs in their season (alchemy's picking: skills.ts, loot/herbs.ts): patches of them out in the wilds, one in some of
// every SITE tiles a side, on open natural ground (never on a road, a field, a floor or the water), each by the seed's
// hashes, so every map has them where it ever did, classic or streamed. What a patch grows is its country's and the
// season's (scenery/biomes.ts, clock.ts): the herbs up there then, one of them by a roll of the patch's own, the
// commoner likelier (a meadow's chamomile in the spring is yarrow in the autumn, and nothing in the winter but
// rosehips or snowdrops); a country with nothing up that season, a bare patch. E by one starts the hero picking, a herb
// at a time into the bag (PULL seconds each; the bag full, at their feet), till it's picked bare: 2 to 4 of it, and a
// second herb now and then from 100 (the likelier the better they are). Each wants the skill to know it (as a vein
// does: mining.ts), and teaches as its difficulty allows (skills.ts: orange always … grey never). Picked bare, it's
// back a day after it was last picked at (REGROW). Walking off, E again, going in, or another trade, stops it. What's
// picked is kept (saved), and when.

import { hashUnit } from '../../util/random';
import { addToBag } from '../hero/bag';
import { canCarry } from '../hero/bagSlots';
import { gainXp } from '../hero/heroStats';
import { seasonAt, SEASONS, type Season } from '../clock';
import { createBiomes } from '../scenery/biomes';
import { HERBS, herbsIn, type HerbId } from '../loot/herbs';
import type { LootId } from '../loot/loot';
import type { GameEvent, Hero } from '../types';
import { difficulty, practise, skillOf } from './skills';

const SKILL = 'alchemy';
export const SITE = 10; // tiles a side of each cell of the wilds, a patch in some of them
const SITE_CHANCE = 0.55;
export const PATCH_REACH = 1.1; // tiles from a patch to pick it
export const PULL = 2.4; // seconds a herb's picked (knelt to, cut, tied)
const PULLS: [number, number] = [2, 4]; // herbs a patch gives, least and most
export const REGROW = 24 * 60; // game minutes (a day) till a patch picked bare is back
const SECOND_HERB: [number, number] = [100, 0.4]; // from this level a second herb now and then, the chance growing to this at the top
const HERO_XP = 2; // the hero's own experience, a herb picked
const SALT = 1301;
const SEEK = 30; // tiles round the hero a patch that'd teach them is looked for (the prompt's hint)

// A patch of herbs: the tile it's on, and its key (by where it lies).
export interface Patch {
  x: number;
  z: number;
}
export const patchKey = (p: Patch): string => `${p.x},${p.z}`;

export interface HerbWorld {
  readonly seed: number;
  readonly tiles: { has(x: number, z: number): boolean; surface(x: number, z: number): string };
  isOpenTile(x: number, z: number): boolean;
}

// The patch in cell (cx, cz), if it has one: on a tile of its own (a step in from the cell's sides), open natural ground.
export function patchIn(world: HerbWorld, cx: number, cz: number): Patch | null {
  const { seed } = world;
  if (hashUnit(cx, cz, seed + SALT) >= SITE_CHANCE) return null;
  const x = cx * SITE + 1 + Math.floor(hashUnit(cx, cz, seed + SALT + 1) * (SITE - 2));
  const z = cz * SITE + 1 + Math.floor(hashUnit(cx, cz, seed + SALT + 2) * (SITE - 2));
  return world.tiles.has(x, z) && world.tiles.surface(x, z) === 'natural' && world.isOpenTile(x, z) ? { x, z } : null;
}

// The patches within `radius` tiles of (x, z) (a cell's whether or not it's all in).
export function patchesNear(world: HerbWorld, x: number, z: number, radius: number): Patch[] {
  const out: Patch[] = [];
  for (let cx = Math.floor((x - radius) / SITE); cx <= Math.floor((x + radius) / SITE); cx++)
    for (let cz = Math.floor((z - radius) / SITE); cz <= Math.floor((z + radius) / SITE); cz++) {
      const patch = patchIn(world, cx, cz);
      if (patch && Math.abs(patch.x - x) <= radius && Math.abs(patch.z - z) <= radius) out.push(patch);
    }
  return out;
}

// What a patch grows in `season` (null: nothing up there then): of the herbs up in its country, one by its own roll,
// the commoner (the less skill it wants) the likelier.
export function herbOf(seed: number, patch: Patch, season: Season): HerbId | null {
  const herbs = herbsIn(createBiomes(seed).at(patch.x, patch.z), season);
  if (herbs.length === 0) return null;
  const weight = (id: HerbId) => 1 / (1 + HERBS[id].needs / 100);
  let u = hashUnit(patch.x, patch.z, seed + SALT + 3 + SEASONS.indexOf(season)) * herbs.reduce((n, id) => n + weight(id), 0);
  for (const id of herbs) if ((u -= weight(id)) < 0) return id;
  return herbs.at(-1)!;
}

// How many herbs a patch gives in all.
export const pullsIn = (seed: number, patch: Patch): number => PULLS[0] + Math.floor(hashUnit(patch.x, patch.z, seed + SALT + 9) * (PULLS[1] - PULLS[0] + 1));

export interface HerbalismHost extends HerbWorld {
  readonly hero: Hero;
  readonly inside: unknown | null;
  readonly minutes: number; // the game's clock (the season; a patch picked bare back a day after)
  // The hero's other trades: picking begun, they're stopped; one of them begun, the picking is.
  readonly lumber: { readonly chopping: unknown; stop(): void };
  readonly woodworking: { readonly making: unknown; stop(): void };
  readonly cooking: { readonly making: unknown; stop(): void };
  readonly fishing: { readonly line: unknown; stop(): void };
  readonly salvage: { readonly breaking: unknown; stop(): void };
  readonly mining: { readonly striking: unknown; stop(): void };
  dropLoot(item: LootId, x: number, z: number): void;
  report(event: GameEvent): void;
}

// What E would do by a patch (the prompt): pick it; or not, and why (not yet skilled enough to know it).
export type PickAction = { kind: 'pick'; patch: Patch; herb: HerbId } | { kind: 'cannot'; patch: Patch; herb: HerbId; needs: number };

export class Herbalism {
  readonly picked = new Map<string, number>(); // herbs taken from each patch (by patchKey); all of them: picked bare
  readonly pickedAt = new Map<string, number>(); // when each was last picked at (game minutes), to be back REGROW after
  version = 0; // bumped at each herb picked, and each patch back (what's drawn of them, redrawn)
  picking: { patch: Patch; herb: HerbId; t: number } | null = null; // the patch being picked, and seconds into the herb

  constructor(private readonly host: HerbalismHost) {}

  get season(): Season {
    return seasonAt(this.host.minutes);
  }

  // What a patch grows just now (null: nothing, this season).
  herbOf(patch: Patch): HerbId | null {
    return herbOf(this.host.seed, patch, this.season);
  }

  // Herbs left on a patch (picked bare: none).
  left(patch: Patch): number {
    return Math.max(0, pullsIn(this.host.seed, patch) - (this.picked.get(patchKey(patch)) ?? 0));
  }

  // The patches round (x, z) with something up on them to pick, and what (the view's, the guide's).
  growing(x: number, z: number, radius: number): Array<Patch & { herb: HerbId }> {
    return patchesNear(this.host, x, z, radius).flatMap((p) => {
      const herb = this.herbOf(p);
      return herb && this.left(p) > 0 ? [{ ...p, herb }] : [];
    });
  }

  // The patch in reach of the hero (outdoors), with something on it: the nearest they know, before any nearer beyond them.
  get patchInReach(): (Patch & { herb: HerbId }) | null {
    if (this.host.inside) return null;
    const { hero } = this.host;
    const level = skillOf(hero, SKILL).level;
    let best: (Patch & { herb: HerbId }) | null = null;
    let near = Infinity;
    for (const p of this.growing(hero.x, hero.z, PATCH_REACH + 1)) {
      const d = Math.hypot(p.x - hero.x, p.z - hero.z);
      if (d > PATCH_REACH) continue;
      const rank = d + (HERBS[p.herb].needs > level ? PATCH_REACH : 0);
      if (rank < near) [best, near] = [p, rank];
    }
    return best;
  }

  // The nearest patch round the hero (within SEEK) of a herb they know that still teaches them, if any (the prompt's
  // hint, by one that teaches nothing now).
  get teachingNear(): (Patch & { herb: HerbId }) | null {
    const { hero } = this.host;
    const level = skillOf(hero, SKILL).level;
    const teaches = (id: HerbId) => HERBS[id].needs <= level && difficulty(HERBS[id].needs, level).chance > 0;
    let best: (Patch & { herb: HerbId }) | null = null;
    let near = SEEK;
    for (const p of this.growing(hero.x, hero.z, SEEK)) {
      const d = Math.hypot(p.x - hero.x, p.z - hero.z);
      if (d < near && d > PATCH_REACH && teaches(p.herb)) [best, near] = [p, d];
    }
    return best;
  }

  // What E would do by the patch in reach, if any.
  get action(): PickAction | null {
    const patch = this.patchInReach;
    if (!patch) return null;
    const needs = HERBS[patch.herb].needs;
    const at = { x: patch.x, z: patch.z };
    return skillOf(this.host.hero, SKILL).level < needs ? { kind: 'cannot', patch: at, herb: patch.herb, needs } : { kind: 'pick', patch: at, herb: patch.herb };
  }

  // E: picking begun at the patch in reach (whether it was); or, picking already, stopped.
  use(): boolean {
    if (this.picking) return this.stop(), true;
    const action = this.action;
    if (action?.kind !== 'pick') return false;
    const { lumber, woodworking, cooking, fishing, salvage, mining, hero } = this.host;
    [lumber.stop(), woodworking.stop(), cooking.stop(), fishing.stop(), salvage.stop(), mining.stop()];
    this.picking = { patch: action.patch, herb: action.herb, t: 0 };
    hero.facing = Math.atan2(action.patch.x - hero.x, action.patch.z - hero.z); // (facing it)
    return true;
  }

  stop(): void {
    this.picking = null;
  }

  // How far through the herb under way (0..1), picking; else null (its bar).
  get progress(): number | null {
    return this.picking ? Math.min(1, this.picking.t / PULL) : null;
  }

  // The chance of a second herb a pull, at `level` (none under SECOND_HERB's level, growing to its most at the top).
  secondHerbChance(level: number): number {
    return level < SECOND_HERB[0] ? 0 : ((level - SECOND_HERB[0]) / (300 - SECOND_HERB[0])) * SECOND_HERB[1];
  }

  // A moment of it: patches picked bare a day ago back; the picking stopped if they've walked off (or gone in, or taken
  // up another trade, or the season's turned under them); else on, a herb each PULL.
  update(dt: number, moving: boolean): void {
    this.regrow();
    const picking = this.picking;
    if (!picking) return;
    const { hero, lumber, woodworking, cooking, fishing, salvage, mining } = this.host;
    const busy = lumber.chopping || woodworking.making || cooking.making || fishing.line || salvage.breaking || mining.striking;
    if (moving || busy || this.host.inside || this.herbOf(picking.patch) !== picking.herb || Math.hypot(picking.patch.x - hero.x, picking.patch.z - hero.z) > PATCH_REACH + 0.2) return this.stop();
    if ((picking.t += dt) < PULL) return;
    picking.t = 0;
    this.pull(picking.patch, picking.herb);
  }

  // A herb picked: into the bag (full: at their feet), a second now and then, the skill maybe risen, some of the hero's
  // own experience, told; the patch picked bare, its last.
  private pull(patch: Patch, herb: HerbId): void {
    const key = patchKey(patch);
    const picked = (this.picked.get(key) ?? 0) + 1;
    [this.picked.set(key, picked), this.pickedAt.set(key, this.host.minutes)];
    this.version++;
    const { hero } = this.host;
    const level = skillOf(hero, SKILL).level;
    const roll = (salt: number) => hashUnit(patch.x * 13 + picked, patch.z * 7 + level, SALT + salt);
    for (let n = roll(11) < this.secondHerbChance(level) ? 2 : 1; n > 0; n--) {
      if (canCarry(hero, herb)) addToBag(hero.bag, herb);
      else this.host.dropLoot(herb, hero.x, hero.z);
    }
    this.host.report({ kind: 'crafted', item: herb });
    gainXp(hero, HERO_XP);
    practise(hero, SKILL, HERBS[herb].needs, roll(12), this.host.report, difficulty(HERBS[herb].needs, level).chance);
    if (picked >= pullsIn(this.host.seed, patch)) this.picking = null; // (picked bare: back in a day)
  }

  // The patches last picked at a day ago and more, back.
  private regrow(): void {
    if (this.pickedAt.size === 0) return;
    for (const [key, at] of this.pickedAt) {
      if (this.host.minutes - at < REGROW) continue;
      [this.picked.delete(key), this.pickedAt.delete(key)];
      this.version++;
    }
  }

  // For a save: the herbs taken from each patch, and when each was last picked at.
  saved(): { picked: Record<string, number>; at: Record<string, number> } {
    return { picked: Object.fromEntries(this.picked), at: Object.fromEntries(this.pickedAt) };
  }

  // Back from a save (a sound count for each, at most the most a patch gives; a sound time, no later than now, else
  // from now); an older save's (none): none picked.
  restore(saved: unknown): void {
    [this.picked.clear(), this.pickedAt.clear()];
    const s = (saved && typeof saved === 'object' ? saved : {}) as { picked?: unknown; at?: unknown };
    const times = s.at && typeof s.at === 'object' ? (s.at as Record<string, unknown>) : {};
    const now = this.host.minutes;
    if (s.picked && typeof s.picked === 'object') {
      for (const [key, n] of Object.entries(s.picked as Record<string, unknown>)) {
        if (!/^-?\d+,-?\d+$/.test(key) || typeof n !== 'number' || !Number.isFinite(n) || n <= 0) continue;
        this.picked.set(key, Math.min(PULLS[1], Math.floor(n)));
        const at = times[key];
        this.pickedAt.set(key, typeof at === 'number' && Number.isFinite(at) ? Math.min(now, at) : now);
      }
    }
    this.version++;
  }
}

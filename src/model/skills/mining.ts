// Mining (skills.ts): a pickaxe in the bag (loot/tools.ts: the smith's copper one, or a better one forged), E by a rock of the wilds
// (a boulder or an outcrop: scenery/scenery.ts) starts the hero striking at its vein, swing after swing, on their own; each
// strike (a few swings) breaks a lump of ore loose onto the ground beside it, to be picked up, and the hero strikes on
// till the vein's worked out. Every rock is seamed with a vein of its own, by where it lies (copper the commonest, gold
// the rarest; star-iron only in the rocks of the high ground), and gives so many strikes (a boulder 12 to 18, an outcrop
// twice that); worked out, the rock stays, its vein gone; a day after it was last struck at it's back whole (REGROW: a
// miner keeps a round of rocks, and no land's ever mined out). Walking off, or E again, stops them. The veins want the
// skill (copper anyone's, tin at 40, iron at 90, silver at 140, gold at 190, star-iron at 240); the skill rises as they
// strike, the surer the harder the vein is for them (skills.ts difficulty: orange always, yellow often, green now and then,
// grey never; iron never grey, nor any vein harder than it), and a higher tier strikes quicker. Past the first tiers, more:
// a second lump now and then (from 100, likelier the better they are), and gem shards in the silver and richer, for the
// salvage bench's and the smith's work. What's mined is kept (saved), and when each vein was worked out.

import { hashUnit } from '../../util/random';
import { Nearby } from '../../util/nearby';
import type { LootId } from '../loot/loot';
import type { ToolId } from '../loot/tools';
import type { GameEvent, Hero } from '../types';
import type { Scenery } from '../scenery/scenery';
import { gainXp } from '../hero/heroStats';
import { RISE, difficulty, practise, skillOf, tierOf } from './skills';
import type { Find } from './lumber';

const SKILL = 'mining';
// The veins: the ore each gives, the skill it wants, what's found with it now and then, past a level.
export type Vein = 'copper' | 'tin' | 'iron' | 'silver' | 'gold' | 'starIron';
export interface Ore {
  name: string;
  ore: LootId;
  needs: number;
  finds?: readonly Find[]; // now and then a strike, from that level
  lasting?: boolean; // never grey: green at the least, however practised the hand (iron: always a vein to learn from); nor any vein harder than it
}
export const VEINS: Record<Vein, Ore> = {
  copper: { name: 'copper', ore: 'copperOre', needs: 1 },
  tin: { name: 'tin', ore: 'tinOre', needs: 40 },
  iron: { name: 'iron', ore: 'ironOre', needs: 90, lasting: true },
  silver: { name: 'silver', ore: 'silverOre', needs: 140, finds: [{ item: 'gemShard', from: 140, chance: 0.04 }] },
  gold: { name: 'gold', ore: 'goldOre', needs: 190, finds: [{ item: 'gemShard', from: 190, chance: 0.06 }] },
  starIron: { name: 'star-iron', ore: 'starIronOre', needs: 240, finds: [{ item: 'gemShard', from: 240, chance: 0.08 }] },
};
// Of the rocks (by where each lies), how many are seamed with each (the rest of the high ground's: STAR_IRON of them star-iron).
const SHARE: ReadonlyArray<[Vein, number]> = [['copper', 0.22], ['tin', 0.2], ['iron', 0.2], ['silver', 0.19], ['gold', 0.19]];
export const STAR_IRON = 0.4; // of the rocks of the high ground, star-iron
const HIGH = 3; // the ground's tier from which it's the high ground
const STRIKES: Record<'boulder' | 'outcrop', [number, number]> = { boulder: [12, 18], outcrop: [24, 36] }; // least and most, by the rock
const MOST_STRIKES = 36;
export const REGROW = 24 * 60; // game minutes (a day) till a worked-out vein's back
const SECOND_ORE: [number, number] = [100, 0.5]; // from this level a second lump now and then, the chance growing to this at the top
export const SWING = 0.7; // seconds a swing of the pick
const SWINGS = 4; // swings a strike, at the skill's first tier
const QUICKER = 0.1; // of a strike's swings fewer, each tier on
// What the better picks bring: a swing fewer a strike (star-iron's two); steel and star-iron, a second lump oftener.
export const PICK_BONUS: Partial<Record<ToolId, { swings?: number; secondOre?: number }>> = { ironPick: { swings: -1 }, steelPick: { swings: -1, secondOre: 0.1 }, starIronPick: { swings: -2, secondOre: 0.15 } };
const PICKS: readonly ToolId[] = ['starIronPick', 'steelPick', 'ironPick', 'copperPick']; // the best first
const REACH = { boulder: 1.2, outcrop: 1.6 }; // tiles from a rock's middle to strike at it
export const SEEK = 80; // tiles round the hero looked over for a vein that still teaches (a grey one's prompt points to it: rocks lie far apart)
const HERO_XP = 3; // the hero's own experience, a strike
const OUT_A_LITTLE = 0.35; // tiles past the rock's side a lump falls, toward the hero

// A rock that can be mined: a boulder or an outcrop.
export type Rock = Scenery & { kind: 'boulder' | 'outcrop' };
export const isRock = (s: Scenery): s is Rock => s.kind === 'boulder' || s.kind === 'outcrop';
export const rockKey = (rock: { x: number; z: number }): string => `${rock.x},${rock.z}`;
// A rock's middle.
export const middleOf = (rock: Rock): { x: number; z: number } => ({ x: rock.x + (rock.w - 1) / 2, z: rock.z + (rock.d - 1) / 2 });

// Whether a rock lies on the hills or the moor, where star-iron's found. A seam: the high ground (HIGH and up) stands in for
// the land's biomes till they're in (scenery/biomes.ts: createBiomes(seed).at(x, z) is 'hills' or 'heath', the moor; the
// pure one, not the view's aroundVillages).
export const upland = (tiles: { height(x: number, z: number): number }, rock: Rock): boolean => tiles.height(rock.x, rock.z) >= HIGH;

// A rock's vein, by where it lies.
export function veinOf(rock: Rock, seed: number, tiles: { height(x: number, z: number): number }): Vein {
  if (upland(tiles, rock) && hashUnit(rock.x, rock.z, seed + 607) < STAR_IRON) return 'starIron';
  let u = hashUnit(rock.x, rock.z, seed + 604);
  for (const [vein, share] of SHARE) if ((u -= share) < 0) return vein;
  return 'gold';
}

// How many strikes a rock gives in all (by its size, and where it lies).
export function strikesIn(rock: Rock, seed: number): number {
  const [least, most] = STRIKES[rock.kind];
  return least + Math.floor(hashUnit(rock.x, rock.z, seed + 601) * (most - least + 1));
}

// How hard a vein is for a hand at `level`, and how likely a strike at it teaches (skills.ts RISE): a lasting one's never
// less than green, nor any harder than it.
export const riseOf = (vein: Vein, level: number) => {
  const rise = difficulty(VEINS[vein].needs, level);
  const lasts = Object.values(VEINS).some((v) => v.lasting && v.needs <= VEINS[vein].needs);
  return lasts && rise.chance === 0 ? RISE[2] : rise;
};

export interface MiningHost {
  readonly hero: Hero;
  readonly seed: number;
  readonly scenery: readonly Scenery[];
  readonly tiles: { height(x: number, z: number): number };
  readonly inside: unknown | null;
  readonly minutes: number; // the game's clock (a vein worked out comes back a day after)
  // The hero's other trades: one begun, the striking's stopped; striking begun, they are.
  readonly lumber: { readonly chopping: unknown; stop(): void };
  readonly woodworking: { readonly making: unknown; stop(): void };
  readonly cooking: { readonly making: unknown; stop(): void };
  readonly fishing: { readonly line: unknown; stop(): void };
  readonly salvage: { readonly breaking: unknown; stop(): void };
  dropLoot(item: LootId, x: number, z: number): void;
  report(event: GameEvent): void;
}

// What E would do by a rock (the prompt): strike it; or not, and why (no pickaxe, not yet skilled enough).
export type MineAction = { kind: 'mine'; rock: Rock } | { kind: 'cannot'; rock: Rock; why: 'pick' | 'skill'; needs: number };

export class Mining {
  readonly mined = new Map<string, number>(); // strikes taken at each rock (by rockKey); all of its strikes: worked out
  readonly emptied = new Map<string, number>(); // when each was last struck at (game minutes), to come back whole REGROW after
  version = 0; // bumped at each strike (what's drawn of the veins, redrawn)
  striking: { rock: Rock; t: number } | null = null; // the rock being struck, and seconds into the strike

  private nearby: Nearby<Scenery> | null = null; // the rocks round the hero
  private around: Nearby<Scenery> | null = null; // and those a walk round them (SEEK)

  constructor(private readonly host: MiningHost) {}

  private get near(): Nearby<Scenery> {
    return (this.nearby ??= new Nearby(this.host.scenery, (s) => s, REACH.outcrop + 1, 8));
  }

  // A rock's vein (by where it lies).
  veinOf(rock: Rock): Vein {
    return veinOf(rock, this.host.seed, this.host.tiles);
  }

  // Whether a rock's vein is worked out (gone for good).
  workedOut(rock: Rock): boolean {
    if (this.mined.size === 0) return false;
    const mined = this.mined.get(rockKey(rock));
    return mined !== undefined && mined >= strikesIn(rock, this.host.seed);
  }

  // The nearest rock a walk away (SEEK) whose vein they can mine and that still teaches them, not worked out, if any:
  // where a grey one's prompt sends them.
  get teachingNear(): Rock | null {
    const { hero } = this.host;
    const level = skillOf(hero, SKILL).level;
    let best: Rock | null = null;
    let near = SEEK;
    for (const s of (this.around ??= new Nearby(this.host.scenery, (s) => s, SEEK, 10)).near(hero)) {
      if (!isRock(s)) continue;
      const d = Math.hypot(middleOf(s).x - hero.x, middleOf(s).z - hero.z);
      if (d >= near) continue;
      const vein = this.veinOf(s);
      if (VEINS[vein].needs <= level && riseOf(vein, level).chance > 0 && !this.workedOut(s)) [best, near] = [s, d];
    }
    return best;
  }

  // Strikes left in a rock.
  left(rock: Rock): number {
    return Math.max(0, strikesIn(rock, this.host.seed) - (this.mined.get(rockKey(rock)) ?? 0));
  }

  // The pick they'd strike with: the best in the bag; null with none.
  get pickKey(): ToolId | null {
    const { bag } = this.host.hero;
    return PICKS.find((pick) => (bag[pick] ?? 0) > 0) ?? null;
  }

  // Whether the hero has a pickaxe in the bag.
  get pick(): boolean {
    return this.pickKey !== null;
  }

  // What the pick to hand brings (PICK_BONUS), if anything.
  get pickBonus(): { swings?: number; secondOre?: number } {
    const key = this.pickKey;
    return (key && PICK_BONUS[key]) || {};
  }

  // Seconds a strike takes them: fewer swings a tier on.
  get strikeSeconds(): number {
    const { index } = tierOf(skillOf(this.host.hero, SKILL).level);
    return SWING * Math.max(1, SWINGS + (this.pickBonus.swings ?? 0)) * (1 - QUICKER * index);
  }

  // The rock in reach of the hero (outdoors), its vein not worked out: the nearest they're skilled enough to mine that
  // still teaches them, before any nearer that teaches nothing, and that before any beyond them; none they can, the
  // nearest (to be told why not).
  get rockInReach(): Rock | null {
    if (this.host.inside) return null;
    const { hero } = this.host;
    const level = skillOf(hero, SKILL).level;
    let best: Rock | null = null;
    let near = Infinity;
    for (const s of this.near.near(hero)) {
      if (!isRock(s) || this.workedOut(s)) continue;
      const m = middleOf(s);
      const d = Math.hypot(m.x - hero.x, m.z - hero.z);
      if (d > REACH[s.kind]) continue;
      const vein = this.veinOf(s);
      const rank = d + (VEINS[vein].needs > level ? 2 * REACH.outcrop : riseOf(vein, level).chance === 0 ? REACH.outcrop : 0); // (one beyond them after any they can; a grey one after any that teaches)
      if (rank < near) [best, near] = [s, rank];
    }
    return best;
  }

  // What E would do by the rock in reach, if any.
  get action(): MineAction | null {
    const rock = this.rockInReach;
    if (!rock) return null;
    if (!this.pick) return { kind: 'cannot', rock, why: 'pick', needs: 0 };
    const needs = VEINS[this.veinOf(rock)].needs;
    if (skillOf(this.host.hero, SKILL).level < needs) return { kind: 'cannot', rock, why: 'skill', needs };
    return { kind: 'mine', rock };
  }

  // E: striking begun at the rock in reach (whether it was); or, striking already, stopped.
  use(): boolean {
    if (this.striking) return this.stop(), true;
    const action = this.action;
    if (action?.kind !== 'mine') return false;
    const { lumber, woodworking, cooking, fishing, salvage } = this.host;
    [lumber.stop(), woodworking.stop(), cooking.stop(), fishing.stop(), salvage.stop()];
    this.striking = { rock: action.rock, t: 0 };
    const { hero } = this.host;
    const m = middleOf(action.rock);
    hero.facing = Math.atan2(m.x - hero.x, m.z - hero.z); // (facing it)
    return true;
  }

  stop(): void {
    this.striking = null;
  }

  // How far through a swing the hero is (0..1), striking; else null (the hero's arms drawn swinging: GameModel).
  get swing(): number | null {
    return this.striking ? (this.striking.t % SWING) / SWING : null;
  }

  // How far through the strike under way (0..1), striking; else null (its bar).
  get progress(): number | null {
    return this.striking ? Math.min(1, this.striking.t / this.strikeSeconds) : null;
  }

  // A moment of it: stopped if they've walked off (or lost their pick, or gone in, or taken up another trade); else on, a
  // strike each strikeSeconds.
  update(dt: number, moving: boolean): void {
    this.regrow();
    const striking = this.striking;
    if (!striking) return;
    const { hero, lumber, woodworking, cooking, fishing, salvage } = this.host;
    const m = middleOf(striking.rock);
    const busy = lumber.chopping || woodworking.making || cooking.making || fishing.line || salvage.breaking;
    if (moving || busy || this.host.inside || !this.pick || Math.hypot(m.x - hero.x, m.z - hero.z) > REACH[striking.rock.kind] + 0.2) return this.stop();
    if ((striking.t += dt) < this.strikeSeconds) return;
    striking.t = 0;
    this.strike(striking.rock);
  }

  // The chance of a second lump a strike, at `level` (none under SECOND_ORE's level, growing to its most at the top; a
  // steel or star-iron pick adds its own, from the start).
  secondOreChance(level: number): number {
    const skill = level < SECOND_ORE[0] ? 0 : ((level - SECOND_ORE[0]) / (300 - SECOND_ORE[0])) * SECOND_ORE[1];
    return Math.min(0.9, skill + (this.pickBonus.secondOre ?? 0));
  }

  // A strike landed: its ore broken loose (toward the hero; a second now and then, the better they are), what's found with
  // it now and then, the skill maybe risen, some of the hero's own experience; the vein worked out, its last.
  private strike(rock: Rock): void {
    const key = rockKey(rock);
    const mined = (this.mined.get(key) ?? 0) + 1;
    this.mined.set(key, mined);
    this.emptied.set(key, this.host.minutes);
    this.version++;
    const { hero } = this.host;
    const vein = this.veinOf(rock);
    const ore = VEINS[vein];
    const level = skillOf(hero, SKILL).level;
    const roll = (salt: number) => hashUnit(rock.x * 13 + mined, rock.z * 7 + level, salt);
    const drops: LootId[] = [ore.ore, ...(roll(605) < this.secondOreChance(level) ? [ore.ore] : [])];
    for (const [i, find] of (ore.finds ?? []).entries()) if (level >= find.from && roll(606 + i * 11) < find.chance) drops.push(find.item);
    for (const [i, item] of drops.entries()) this.dropBeside(rock, item, mined * 5 + i);
    gainXp(hero, HERO_XP);
    practise(hero, SKILL, ore.needs, roll(603), this.host.report, riseOf(vein, level).chance);
    if (mined >= strikesIn(rock, this.host.seed)) this.striking = null; // (worked out: the rock left, its vein gone, for a day)
  }

  // The veins last struck at a day ago and more, back whole.
  private regrow(): void {
    if (this.emptied.size === 0) return;
    for (const [key, at] of this.emptied) {
      if (this.host.minutes - at < REGROW) continue;
      [this.mined.delete(key), this.emptied.delete(key)];
      this.version++;
    }
  }

  // Something broken loose beside a rock, toward the hero, a little apart from the rest (`n`: which, to spread them).
  private dropBeside(rock: Rock, item: LootId, n: number): void {
    const { hero } = this.host;
    const m = middleOf(rock);
    const d = Math.hypot(hero.x - m.x, hero.z - m.z) || 1;
    const [ux, uz] = [(hero.x - m.x) / d, (hero.z - m.z) / d];
    const out = (rock.kind === 'outcrop' ? 0.8 : 0.4) + OUT_A_LITTLE;
    const spread = (hashUnit(rock.x * 7 + n, rock.z, 602) - 0.5) * 0.7; // (not all on one spot)
    this.host.dropLoot(item, m.x + ux * out - uz * spread, m.z + uz * out + ux * spread);
  }

  // What's mined, from a save (a sound count for each: as many as there are, at most), and when each was last struck at (a
  // sound time for each, no later than now; none saved, as an older save's: from now, so it's back a day on).
  restore(saved: unknown, emptied?: unknown): void {
    [this.mined.clear(), this.emptied.clear()];
    const now = this.host.minutes;
    const times = emptied && typeof emptied === 'object' ? (emptied as Record<string, unknown>) : {};
    if (saved && typeof saved === 'object') {
      for (const [key, n] of Object.entries(saved as Record<string, unknown>)) {
        if (!/^-?\d+,-?\d+$/.test(key) || typeof n !== 'number' || !Number.isFinite(n) || n <= 0) continue;
        this.mined.set(key, Math.min(MOST_STRIKES, Math.floor(n)));
        const at = times[key];
        this.emptied.set(key, typeof at === 'number' && Number.isFinite(at) ? Math.min(now, at) : now);
      }
    }
    this.version++;
  }

  // For a save: the strikes taken at each rock, and when each was last struck at.
  saved(): Record<string, number> {
    return Object.fromEntries(this.mined);
  }
  savedTimes(): Record<string, number> {
    return Object.fromEntries(this.emptied);
  }
}

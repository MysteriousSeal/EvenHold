// Salvaging (skills.ts): a piece of gear broken down at the salvage bench in a smithy (smithy/smithyLayout.ts: E
// before it opens the window, controller/skills/salvagePanel.ts) into what it's made of: iron scrap from blades and mail,
// leather strips from hide, linen from padding and cloth, silver filings (and a gem shard, where there's a stone) from
// jewellery, planks from wooden arms (of the wood its level's: birch, pine, oak); and the iron, leather, linen and
// silver in what foes leave (a rusty buckle, a torn pouch, an old coin). The better the piece, the more; a rare one
// leaves something finer besides (a tempered ingot, a cut gem), once the hand is skilled enough for it. Any piece can
// be broken down, at any skill: each asks a level of it by its own level and rarity (what it teaches: skills.ts
// difficulty), the four tiers falling on the gear a hero meets (levels 1 to 7, 8 to 13, 14 to 19, 20 on; a finer one
// sooner), and practises it.
import type { Hero } from '../types';
import type { GameEvent } from '../types';
import type { Entrance } from '../interiors/interiors';
import type { Furniture } from '../interiors/furniture';
import { addToBag, takeFromBag } from '../hero/bag';
import { canSwap } from '../hero/bagSlots';
import { ITEMS, type ItemId } from '../human/items';
import { baseOf, isGear, levelOf, rarityOf, type GearKey, type Rarity } from '../human/items/gear';
import type { IngredientId } from '../loot/ingredients';
import type { JUNK_ITEMS } from '../loot/junk';
import { LOOT } from '../loot/loot';
import { RISE, difficulty, practise, skillOf } from './skills';
import { RECIPES } from './woodworking';
import { SMITH_RECIPES } from './smithing';

export type Make = 'iron' | 'leather' | 'cloth' | 'silver' | 'wood';
export const MAKE_NAMES: Record<Make, string> = { iron: 'Iron', leather: 'Leather', cloth: 'Cloth', silver: 'Silver', wood: 'Wood' };
export const SCRAP_OF: Record<Make, IngredientId> = { iron: 'ironScrap', leather: 'leatherStrip', cloth: 'linenScrap', silver: 'silverFilings', wood: 'oakPlank' }; // what each leaves
export const FINER_OF: Record<Make, IngredientId> = { iron: 'temperedIngot', leather: 'temperedIngot', cloth: 'temperedIngot', wood: 'temperedIngot', silver: 'cutGem' }; // and the rare besides
const PLANKS: ReadonlyArray<[number, IngredientId]> = [[5, 'birchPlank'], [12, 'pinePlank'], [Infinity, 'oakPlank']]; // a wooden piece's, by its level at most (a birch sword never an oak plank)
// What a piece of `make` at `level` leaves.
export const scrapOf = (make: Make, level: number): IngredientId => (make === 'wood' ? PLANKS.find(([most]) => level <= most)![1] : SCRAP_OF[make]);
const RARE_EXTRA: Record<Rarity, number> = { common: 0, uncommon: 0, rare: 1, epic: 2, legendary: 3 };
export const PER_LEVEL = 12; // the skill a piece asks, a level of its own past the first (a tier every six or so)
const RARE_NEEDS: Record<Rarity, number> = { common: 0, uncommon: 25, rare: 50, epic: 100, legendary: 150 }; // and its rarity, more
export const FINER_AT: Record<Rarity, number> = { common: 0, uncommon: 0, rare: 50, epic: 100, legendary: 150 }; // the skill its finer things want (less: its scrap alone)
// How many tries a piece found (not one as a recipe makes it, nor junk) is worth, by its rarity, each with its own
// roll: past the junk, a fighter's drops are what teach, a few an hour, so each teaches as much as a crafter's
// handful of their own.
export const FOUND_TRIES: Record<Rarity, number> = { common: 10, uncommon: 12, rare: 16, epic: 20, legendary: 24 };
const GEMMED = /ruby|sapphire|jade|amber|pearl|lakeStone|runeStone|signet/;
const IRON = /mail|plate|iron|gauntlet|sabaton|greatHelm|kettle|bascinet|barbute|sallet|breastplate|brigandine|hobnail|torc|nasalCap|hornedHelm|wingedHelm|dragonHelm|boneHelm|bronze/i;
const LEATHER = /leather|studded|fur|hide|boots|bracers|breeches|vest|ridingGloves|workGloves|fingerlessGloves|jerkin|clogs|belted|huntersHood|maskedHood/i;
const WOODEN_ARMS = new Set<ItemId>(['woodenSword', 'club', 'quarterstaff', 'bandedCudgel', 'plankShield', 'buckler', 'towerShield', 'pavise', 'crestShield', 'torch']);

// The junk foes leave that has something in it: what it's of, and what it leaves (a runestone, its stone).
export const JUNK_SALVAGE = {
  rustyBuckle: ['iron', 'ironScrap'],
  rustedBlade: ['iron', 'ironScrap'],
  bentSpoon: ['iron', 'ironScrap'],
  oldArrowhead: ['iron', 'ironScrap'],
  tornPouch: ['leather', 'leatherStrip'],
  mattedPelt: ['leather', 'leatherStrip'],
  tatteredShroud: ['cloth', 'linenScrap'],
  fadedLocket: ['silver', 'silverFilings'],
  oldSilver: ['silver', 'silverFilings'],
  frostTorc: ['silver', 'silverFilings'],
  runestone: ['silver', 'gemShard'],
} satisfies Partial<Record<keyof typeof JUNK_ITEMS, [Make, IngredientId]>>;
type JunkId = keyof typeof JUNK_SALVAGE;
const JUNK_MOST = 60; // the most a bit of junk asks (an apprentice's: grey before the journeyman's is out)
export const isSalvageJunk = (item: string): item is JunkId => Object.hasOwn(JUNK_SALVAGE, item);

// What can be set on the bench: a piece of gear, or junk with something in it.
export type Salvageable = GearKey | JunkId;
export const isSalvageable = (item: string): item is Salvageable => isGear(item) || isSalvageJunk(item);

// What a piece is made of, by its kind.
export function makeOf(base: ItemId): Make {
  const { slot } = ITEMS[base];
  if (slot === 'mainHand' || slot === 'offHand') return WOODEN_ARMS.has(base) ? 'wood' : base === 'tome' ? 'cloth' : 'iron';
  if (slot === 'neck' || slot === 'ring') return 'silver';
  if (IRON.test(base)) return 'iron';
  if (LEATHER.test(base)) return 'leather';
  return 'cloth';
}

export interface Salvaged {
  make: Make;
  needs: number; // the skill level it asks (what it teaches by)
  gives: Array<[IngredientId, number]>;
  finerAt?: number; // the skill its finer things want, held back for less
  made?: boolean; // a piece as a woodworker or a smith makes it (the hero's own, likely): less back, less taught
  tries: number; // what breaking it down is worth, in tries at the skill (a piece found, several)
}

export const TOO_HARD = 100; // past the skill by more than this, a piece teaches nothing (broken down all the same)
// A piece as a recipe makes it, of woodworking's or smithing's (its item at that level and rarity): what breaking it
// down leaves can't be more than went into it, nor can making and breaking them be a ladder up the skill. (Made the
// first time it's asked: the recipes import this file's neighbours.)
let madeUses: Map<string, number> | null = null; // each piece as a recipe makes it: the fewest materials that go into one
const madeFrom = (item: string, level: number, rarity: Rarity): number | null => {
  if (!madeUses) {
    madeUses = new Map();
    for (const r of [...Object.values(RECIPES), ...Object.values(SMITH_RECIPES)] as Array<{ from: Partial<Record<string, number>>; makes: unknown }>) {
      if (typeof r.makes !== 'object' || r.makes === null) continue;
      const m = r.makes as { item: string; level: number; rarity: Rarity };
      const key = `${m.item}@${m.level}${m.rarity}`;
      const used = Object.values(r.from).reduce((n: number, k) => n + (k ?? 0), 0);
      madeUses.set(key, Math.min(madeUses.get(key) ?? Infinity, used));
    }
  }
  return madeUses.get(`${item}@${level}${rarity}`) ?? null;
};

// How likely breaking a piece down teaches a hand at `skill` (skills.ts difficulty): nothing from one too hard to
// learn from (TOO_HARD past it), green at the most from one as a recipe makes it.
export function teachChance(salvaged: Salvaged, skill: number): number {
  if (salvaged.needs > skill + TOO_HARD) return 0;
  const chance = difficulty(salvaged.needs, skill).chance;
  return salvaged.made ? Math.min(chance, RISE[2].chance) : chance;
}

// What breaking `key` down gives a hand at `skill` (none said: a master's), and the skill it asks: more of its scrap
// the higher its level (one, and one more every six levels), a finer thing besides for a rare piece (one, two, three)
// from the skill its rarity wants, and a gem shard off a stone-set ring; a bit of junk, its one scrap.
export function salvageOf(key: Salvageable, skill = Infinity): Salvaged {
  if (isSalvageJunk(key)) {
    const [make, scrap] = JUNK_SALVAGE[key] as [Make, IngredientId];
    return { make, needs: Math.min(JUNK_MOST, Math.max(1, LOOT[key].value * 3)), gives: [[scrap, 1]], tries: 1 };
  }
  const base = baseOf(key);
  const make = makeOf(base);
  const [level, rarity] = [levelOf(key), rarityOf(key)];
  const used = madeFrom(base, level, rarity); // (as a recipe makes it: what went into it)
  const scrap = 1 + Math.floor(level / 6);
  const gives: Array<[IngredientId, number]> = [[scrapOf(make, level), used === null ? scrap : Math.max(1, Math.min(Math.floor(scrap / 2), used - 1))]]; // (one made: half, and less than went in)
  if (make === 'silver' && GEMMED.test(base) && used === null) gives.push(['gemShard', 1]);
  const finerAt = RARE_EXTRA[rarity] && used === null ? FINER_AT[rarity] : undefined;
  if (finerAt !== undefined && skill >= finerAt) gives.push([FINER_OF[make], RARE_EXTRA[rarity]]);
  return { make, needs: Math.max(1, (level - 1) * PER_LEVEL) + RARE_NEEDS[rarity], gives, tries: used === null ? FOUND_TRIES[rarity] : 1, ...(finerAt !== undefined && skill < finerAt ? { finerAt } : {}), ...(used !== null ? { made: true } : {}) }; // (a level 1 piece from the start; a level 20, the artisan's)
}

export type SalvageOutcome = 'started' | 'no bench' | 'none' | 'busy' | 'full';
export const BREAK_SECONDS = 1.6; // a piece takes so long at the bench (the bar over the hero: controller/skills/castOf.ts)

export const BENCH_ALONG = 0.6; // tiles either way along the bench's front the hero may stand
export const BENCH_OUT: [number, number] = [0.5, 1.6]; // and how far out from its tile (the tile before it)

export interface SalvageHost {
  readonly hero: Hero;
  readonly inside: { entrance: Entrance; furniture: readonly Furniture[]; below?: Entrance } | null;
  report(event: GameEvent): void;
  random(): number;
}

// Whether the hero stands before the bench (the tile toward the door, its front).
export function beforeBench(bench: Furniture, hero: { x: number; z: number }): boolean {
  const out = hero.z - bench.z;
  return Math.abs(hero.x - bench.x) <= BENCH_ALONG && out >= BENCH_OUT[0] && out <= BENCH_OUT[1];
}

export class Salvage {
  breaking: { key: Salvageable; t: number; left: number } | null = null; // the piece on the bench, how long it's been, and how many more of it after

  constructor(private readonly host: SalvageHost) {}

  // The bench the hero stands before (a smithy's, on its ground floor), if any.
  get benchInReach(): Furniture | null {
    const { inside, hero } = this.host;
    if (!inside || inside.below || inside.entrance.type !== 'smithy') return null;
    return inside.furniture.find((f) => f.kind === 'salvageBench' && beforeBench(f, hero)) ?? null;
  }

  // What in the bag could be broken down here: its gear, and the junk with something in it.
  get candidates(): Salvageable[] {
    return (Object.keys(this.host.hero.bag) as string[]).filter((key): key is Salvageable => isSalvageable(key) && this.carried(key) > 0);
  }

  private carried(key: string): number {
    return this.host.hero.bag[key as keyof Hero['bag']] ?? 0;
  }

  // What a piece would leave the hero, at their skill.
  private salvaged(key: Salvageable): Salvaged {
    return salvageOf(key, skillOf(this.host.hero, 'salvaging').level);
  }

  // How far along the piece on the bench is (0..1), or null with none.
  get progress(): number | null {
    return this.breaking ? Math.min(1, this.breaking.t / BREAK_SECONDS) : null;
  }

  // `count` of `key` set on the bench, one after another (Infinity: all carried), to be broken down (update: a while
  // each, then done); or why not.
  start(key: Salvageable, count = 1): SalvageOutcome {
    if (this.breaking) return 'busy';
    if (this.benchInReach === null) return 'no bench';
    if (!this.carried(key) || !isSalvageable(key)) return 'none';
    if (!this.roomFor(key, this.salvaged(key).gives)) return 'full'; // (a full bag: what it leaves would be lost)
    this.breaking = { key, t: 0, left: Math.max(1, Math.min(count, this.carried(key))) - 1 };
    return 'started';
  }

  // A moment of it: stopped if they've walked off (or from the bench); done once its time's up: the piece gone, its
  // scrap into the bag, the skill practised, told; the next of them begun, if asked (none left, or no room: stopped).
  update(dt: number, moving: boolean): void {
    const breaking = this.breaking;
    if (!breaking) return;
    if (moving || this.benchInReach === null || !this.carried(breaking.key)) return this.stop();
    if ((breaking.t += dt) < BREAK_SECONDS) return;
    this.stop();
    const { hero } = this.host;
    const salvaged = this.salvaged(breaking.key);
    const { needs, gives } = salvaged;
    if (!this.roomFor(breaking.key, gives)) return this.host.report({ kind: 'poor', text: 'Your bag is full' }); // (filled meanwhile: the piece kept)
    takeFromBag(hero.bag, breaking.key);
    for (const [item, n] of gives) for (let i = 0; i < n; i++) addToBag(hero.bag, item);
    this.host.report({ kind: 'salvaged', item: breaking.key, gives });
    for (let i = 0; i < salvaged.tries; i++) practise(hero, 'salvaging', needs, this.host.random(), (e) => this.host.report(e), teachChance(salvaged, skillOf(hero, 'salvaging').level)); // (each its own roll, at the skill as it's risen)
    if (breaking.left > 0 && this.carried(breaking.key) && this.roomFor(breaking.key, this.salvaged(breaking.key).gives)) this.breaking = { key: breaking.key, t: 0, left: breaking.left - 1 };
  }

  stop(): void {
    this.breaking = null;
  }

  // Whether all `key` leaves would go in once it's out of the bag (each of its scraps a slot of its own, if new; the
  // piece's own slot freed, its last).
  private roomFor(key: Salvageable, gives: Salvaged['gives']): boolean {
    return canSwap(this.host.hero, { [key]: 1 }, gives.flatMap(([item, n]) => Array.from({ length: n }, () => item)));
  }
}

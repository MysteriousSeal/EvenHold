// Salvaging (skills.ts): a piece of gear broken down at the salvage bench in a smithy (smithy/smithyLayout.ts: E
// before it opens the window, controller/skills/salvagePanel.ts) into what it's made of: iron scrap from blades and mail,
// leather strips from hide, linen from padding and cloth, silver filings (and a gem shard, where there's a stone) from
// jewellery, oak planks from wooden arms. The better the piece, the more; a rare one leaves something finer besides
// (a tempered ingot, a cut gem). Each piece asks a level of the skill, by its own level and rarity, and practises it.
import type { Hero } from '../types';
import type { GameEvent } from '../types';
import type { Entrance } from '../interiors/interiors';
import type { Furniture } from '../interiors/furniture';
import { addToBag, takeFromBag } from '../hero/bag';
import { canCarry } from '../hero/bagSlots';
import { ITEMS, type ItemId } from '../human/items';
import { baseOf, isGear, levelOf, rarityOf, type GearKey, type Rarity } from '../human/items/gear';
import type { IngredientId } from '../loot/ingredients';
import { practise } from './skills';

export type Make = 'iron' | 'leather' | 'cloth' | 'silver' | 'wood';
export const MAKE_NAMES: Record<Make, string> = { iron: 'Iron', leather: 'Leather', cloth: 'Cloth', silver: 'Silver', wood: 'Wood' };
export const SCRAP_OF: Record<Make, IngredientId> = { iron: 'ironScrap', leather: 'leatherStrip', cloth: 'linenScrap', silver: 'silverFilings', wood: 'oakPlank' }; // what each leaves
export const FINER_OF: Record<Make, IngredientId> = { iron: 'temperedIngot', leather: 'temperedIngot', cloth: 'temperedIngot', wood: 'temperedIngot', silver: 'cutGem' }; // and the rare besides
const RARE_EXTRA: Record<Rarity, number> = { common: 0, uncommon: 0, rare: 1, epic: 2, legendary: 3 };
const RARE_NEEDS: Record<Rarity, number> = { common: 0, uncommon: 8, rare: 20, epic: 60, legendary: 120 };
const GEMMED = /ruby|sapphire|jade|amber|pearl|lakeStone|runeStone|signet/;
const IRON = /mail|plate|iron|gauntlet|sabaton|greatHelm|kettle|bascinet|barbute|sallet|breastplate|brigandine|hobnail|torc|nasalCap|hornedHelm|wingedHelm|dragonHelm|boneHelm|bronze/i;
const LEATHER = /leather|studded|fur|hide|boots|bracers|breeches|vest|ridingGloves|workGloves|fingerlessGloves|jerkin|clogs|belted|huntersHood|maskedHood/i;
const WOODEN_ARMS = new Set<ItemId>(['woodenSword', 'club', 'quarterstaff', 'bandedCudgel', 'plankShield', 'buckler', 'towerShield', 'pavise', 'crestShield', 'torch']);

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
  needs: number; // the skill level it asks
  gives: Array<[IngredientId, number]>;
}

// What breaking `key` down gives, and the skill it asks: more of its scrap the higher its level (one, and one more
// every six levels), a finer thing besides for a rare piece (one, two, three), and a gem shard off a stone-set ring.
export function salvageOf(key: GearKey): Salvaged {
  const base = baseOf(key);
  const make = makeOf(base);
  const [level, rarity] = [levelOf(key), rarityOf(key)];
  const gives: Array<[IngredientId, number]> = [[SCRAP_OF[make], 1 + Math.floor(level / 6)]];
  if (make === 'silver' && GEMMED.test(base)) gives.push(['gemShard', 1]);
  if (RARE_EXTRA[rarity]) gives.push([FINER_OF[make], RARE_EXTRA[rarity]]);
  return { make, needs: Math.max(1, level * 3 - 8) + RARE_NEEDS[rarity], gives }; // (the first levels' gear from the start; a piece of level 20, at 52)
}

export type SalvageOutcome = 'started' | 'no bench' | 'none' | 'skill' | 'busy' | 'full';
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
  breaking: { key: GearKey; t: number } | null = null; // the piece on the bench, and how long it's been

  constructor(private readonly host: SalvageHost) {}

  // The bench the hero stands before (a smithy's, on its ground floor), if any.
  get benchInReach(): Furniture | null {
    const { inside, hero } = this.host;
    if (!inside || inside.below || inside.entrance.type !== 'smithy') return null;
    return inside.furniture.find((f) => f.kind === 'salvageBench' && beforeBench(f, hero)) ?? null;
  }

  // The gear in the bag that could be broken down here (whatever the skill says: the window shows what's asked).
  get candidates(): GearKey[] {
    return (Object.keys(this.host.hero.bag) as string[]).filter((key): key is GearKey => isGear(key) && this.carried(key) > 0);
  }

  private carried(key: string): number {
    return this.host.hero.bag[key as keyof Hero['bag']] ?? 0;
  }

  // How far along the piece on the bench is (0..1), or null with none.
  get progress(): number | null {
    return this.breaking ? Math.min(1, this.breaking.t / BREAK_SECONDS) : null;
  }

  // One of `key` set on the bench, to be broken down (update: a while, then done); or why not.
  start(key: GearKey): SalvageOutcome {
    const { hero } = this.host;
    if (this.breaking) return 'busy';
    if (this.benchInReach === null) return 'no bench';
    if (!this.carried(key)) return 'none';
    const { needs, gives } = salvageOf(key);
    if ((hero.skills?.salvaging?.level ?? 1) < needs) return 'skill';
    if (!gives.every(([item]) => canCarry(hero, item))) return 'full'; // (a full bag: what it leaves would be lost; the piece broken down goes too, but its slot's not counted on)
    this.breaking = { key, t: 0 };
    return 'started';
  }

  // A moment of it: stopped if they've walked off (or from the bench); done once its time's up: the piece gone, its
  // scrap into the bag, the skill practised, told.
  update(dt: number, moving: boolean): void {
    const breaking = this.breaking;
    if (!breaking) return;
    if (moving || this.benchInReach === null || !this.carried(breaking.key)) return this.stop();
    if ((breaking.t += dt) < BREAK_SECONDS) return;
    this.stop();
    const { hero } = this.host;
    const { needs, gives } = salvageOf(breaking.key);
    takeFromBag(hero.bag, breaking.key);
    for (const [item, n] of gives) for (let i = 0; i < n; i++) addToBag(hero.bag, item);
    this.host.report({ kind: 'salvaged', item: breaking.key, gives });
    practise(hero, 'salvaging', needs, this.host.random(), (e) => this.host.report(e));
  }

  stop(): void {
    this.breaking = null;
  }
}

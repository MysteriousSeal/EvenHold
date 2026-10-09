// Salvaging (skills.ts): a piece of gear broken down at a village's salvage bench (worldgen/salvageBenches.ts: E by
// it opens the window, controller/skills/salvagePanel.ts) into what it's made of: iron scrap from blades and mail,
// leather strips from hide, linen from padding and cloth, silver filings (and a gem shard, where there's a stone) from
// jewellery, oak planks from wooden arms. The better the piece, the more; a rare one leaves something finer besides
// (a tempered ingot, a cut gem). Each piece asks a level of the skill, by its own level and rarity, and practises it.
import type { Hero } from '../types';
import type { GameEvent } from '../types';
import type { Village } from '../types';
import type { BenchWorld } from '../worldgen/benches';
import { addToBag, takeFromBag } from '../hero/bag';
import { ITEMS, type ItemId } from '../human/items';
import { baseOf, isGear, levelOf, rarityOf, type GearKey, type Rarity } from '../human/items/gear';
import type { IngredientId } from '../loot/ingredients';
import { practise } from './skills';
import { salvageBenchInReach, salvageBenches, type SalvageBench } from '../worldgen/salvageBenches';

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

export type SalvageOutcome = 'started' | 'no bench' | 'none' | 'skill' | 'busy';
export const BREAK_SECONDS = 1.6; // a piece takes so long at the bench (the bar over the hero: controller/skills/castOf.ts)

export interface SalvageHost extends BenchWorld {
  readonly hero: Hero;
  readonly villages: Village[];
  report(event: GameEvent): void;
  random(): number;
}

export class Salvage {
  breaking: { key: GearKey; t: number } | null = null; // the piece on the bench, and how long it's been

  constructor(private readonly host: SalvageHost) {}

  // Every village's bench (worldgen/salvageBenches.ts).
  get benches(): SalvageBench[] {
    return salvageBenches(this.host);
  }

  // The bench the hero stands by (by its village's index), if any.
  get benchInReach(): number | null {
    return salvageBenchInReach(this.benches, this.host.hero);
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
    if ((hero.skills?.salvaging?.level ?? 1) < salvageOf(key).needs) return 'skill';
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

// Smithing (skills.ts): metal worked at a smithy's anvil (smithy/smithyLayout.ts: E before it opens the recipes), as
// woodworking's wood is (woodworking.ts): a recipe picked, made one at a time (a few seconds each, a bar filling;
// walking off, or from the anvil, stops it), as many as asked or the bag allows, each taking its materials and putting
// what it makes in the bag. Ore a miner digs (skills/mining.ts) smelted two to an ingot, as its veins are reached (copper
// and tin for bronze, iron, silver, gold, star-iron; and the salvage bench's scrap, three, before them; a tempered
// ingot is steel already); ingots beaten into fittings (rivets, nails, bands; silver and gilded ones) for a
// woodworker's banded pieces and the smith's own, picks for the miner, and the smith's own wares, as gear at a level and
// rarity (never finer than he forges at that level: common, uncommon; rare only of star-iron). Each made raises the
// skill as its difficulty allows (skills.ts: orange always … grey never), and gives some of the hero's own experience.

import { hashUnit } from '../../util/random';
import type { BagItem } from '../hero/bag';
import { addToBag, takeFromBag } from '../hero/bag';
import { canSwap } from '../hero/bagSlots';
import { gainXp } from '../hero/heroStats';
import { gearKey, type Rarity } from '../human/items/gear';
import type { ItemId } from '../human/equipment';
import type { Entrance } from '../interiors/interiors';
import type { Furniture } from '../interiors/furniture';
import type { LootId } from '../loot/loot';
import type { GameEvent, Hero } from '../types';
import { beforeBench } from './salvage';
import { practise, skillOf } from './skills';
import { materialRise } from './woodworking';

const SKILL = 'smithing';
const HERO_XP = 2; // the hero's own experience, a thing made

export type SmithGroup = 'Smelting' | 'Fittings' | 'Tools' | 'Weapons' | 'Armour' | 'Shields' | 'Trinkets';
export const SMITH_GROUPS: readonly SmithGroup[] = ['Smelting', 'Fittings', 'Tools', 'Weapons', 'Armour', 'Shields', 'Trinkets'];

export interface SmithRecipe {
  name: string;
  group: SmithGroup;
  needs: number; // the skill it wants (and its difficulty goes by)
  from: Partial<Record<LootId, number>>; // its materials, each how many
  makes: LootId | { item: ItemId; level: number; rarity: Rarity }; // an ingot, a fitting, a pick; or a piece of gear made so
  seconds: number; // to make one
}

const gear = (item: ItemId, level: number, rarity: Rarity = 'common') => ({ item, level, rarity });

// The recipes, in the order of the skill they want.
export const SMITH_RECIPES = {
  copperIngot: { name: 'Copper ingot', group: 'Smelting', needs: 1, from: { copperOre: 2 }, makes: 'copperIngot', seconds: 3 },
  scrapIron: { name: 'Iron ingot, of scrap', group: 'Smelting', needs: 1, from: { ironScrap: 3 }, makes: 'ironIngot', seconds: 3.5 }, // (the salvage bench's, before a miner's reaches iron)
  copperRivets: { name: 'Copper rivets', group: 'Fittings', needs: 10, from: { copperIngot: 1 }, makes: 'copperRivets', seconds: 3 },
  copperPick: { name: 'Copper pickaxe', group: 'Tools', needs: 15, from: { copperIngot: 2, birchPlank: 1 }, makes: 'copperPick', seconds: 4 },
  dagger: { name: 'Dagger', group: 'Weapons', needs: 20, from: { copperIngot: 2 }, makes: gear('dagger', 4), seconds: 4 },
  copperRing: { name: 'Copper ring', group: 'Trinkets', needs: 25, from: { copperIngot: 1, copperRivets: 1 }, makes: gear('copperRing', 4), seconds: 3.5 },
  hatchet: { name: 'Hatchet', group: 'Tools', needs: 30, from: { copperIngot: 2, birchPlank: 1 }, makes: gear('hatchet', 5), seconds: 4.5 },
  nasalCap: { name: 'Nasal cap', group: 'Armour', needs: 40, from: { copperIngot: 3, copperRivets: 1 }, makes: gear('nasalCap', 6), seconds: 5 },
  bronzeIngot: { name: 'Bronze ingot', group: 'Smelting', needs: 45, from: { copperOre: 1, tinOre: 1 }, makes: 'bronzeIngot', seconds: 3.5 },
  bronzeTarge: { name: 'Bronze targe', group: 'Shields', needs: 50, from: { bronzeIngot: 3, leatherStrip: 1 }, makes: gear('bronzeTarge', 7), seconds: 5 },
  ironNails: { name: 'Iron nails', group: 'Fittings', needs: 55, from: { ironIngot: 1 }, makes: 'ironNails', seconds: 3 },
  shortSword: { name: 'Short sword', group: 'Weapons', needs: 60, from: { ironIngot: 2 }, makes: gear('shortSword', 8), seconds: 5 },
  bronzeSpaulders: { name: 'Bronze spaulders', group: 'Armour', needs: 65, from: { bronzeIngot: 3, copperRivets: 1 }, makes: gear('bronzeSpaulders', 9), seconds: 5.5 },
  ironBands: { name: 'Iron bands', group: 'Fittings', needs: 75, from: { ironIngot: 1, ironNails: 1 }, makes: 'ironBands', seconds: 3.5 },
  mailMittens: { name: 'Mail mittens', group: 'Armour', needs: 80, from: { ironIngot: 2, copperRivets: 2 }, makes: gear('mailMittens', 11), seconds: 5 },
  ironPick: { name: 'Iron pickaxe', group: 'Tools', needs: 85, from: { ironIngot: 2, pinePlank: 1 }, makes: 'ironPick', seconds: 5 },
  ironIngot: { name: 'Iron ingot', group: 'Smelting', needs: 90, from: { ironOre: 2 }, makes: 'ironIngot', seconds: 3 },
  mace: { name: 'Mace', group: 'Weapons', needs: 95, from: { ironIngot: 3 }, makes: gear('mace', 12), seconds: 5.5 },
  filingsSilver: { name: 'Silver ingot, of filings', group: 'Smelting', needs: 100, from: { silverFilings: 3 }, makes: 'silverIngot', seconds: 3.5 }, // (the salvage bench's, before a miner's reaches silver)
  mailCoif: { name: 'Mail coif', group: 'Armour', needs: 110, from: { ironIngot: 3, copperRivets: 2 }, makes: gear('mailCoif', 14), seconds: 5.5 },
  silverFittings: { name: 'Silver fittings', group: 'Fittings', needs: 120, from: { silverIngot: 1 }, makes: 'silverFittings', seconds: 3.5 },
  silverRing: { name: 'Silver ring', group: 'Trinkets', needs: 125, from: { silverIngot: 1, silverFittings: 1 }, makes: gear('silverRing', 14), seconds: 4.5 },
  armingSword: { name: 'Arming sword', group: 'Weapons', needs: 130, from: { ironIngot: 3, leatherStrip: 1 }, makes: gear('armingSword', 15), seconds: 6 },
  silverIngot: { name: 'Silver ingot', group: 'Smelting', needs: 140, from: { silverOre: 2 }, makes: 'silverIngot', seconds: 3.5 },
  chainMail: { name: 'Chain mail', group: 'Armour', needs: 145, from: { ironIngot: 5, copperRivets: 3 }, makes: gear('chainMail', 17), seconds: 7 },
  steelIngot: { name: 'Steel ingot', group: 'Smelting', needs: 150, from: { ironIngot: 3 }, makes: 'steelIngot', seconds: 4 },
  temperedSteel: { name: 'Steel ingot, of a tempered one', group: 'Smelting', needs: 150, from: { temperedIngot: 1 }, makes: 'steelIngot', seconds: 3 },
  steelPick: { name: 'Steel pickaxe', group: 'Tools', needs: 160, from: { steelIngot: 2, oakPlank: 1 }, makes: 'steelPick', seconds: 5.5 },
  gauntlets: { name: 'Gauntlets', group: 'Armour', needs: 170, from: { steelIngot: 2, leatherStrip: 1 }, makes: gear('gauntlets', 20), seconds: 6 },
  warHammer: { name: 'War hammer', group: 'Weapons', needs: 185, from: { steelIngot: 3, oakPlank: 1 }, makes: gear('warHammer', 22, 'uncommon'), seconds: 6.5 },
  goldIngot: { name: 'Gold ingot', group: 'Smelting', needs: 190, from: { goldOre: 2 }, makes: 'goldIngot', seconds: 4 },
  goldRing: { name: 'Gold ring', group: 'Trinkets', needs: 195, from: { goldIngot: 1 }, makes: gear('goldRing', 21, 'uncommon'), seconds: 5 },
  bascinet: { name: 'Bascinet', group: 'Armour', needs: 200, from: { steelIngot: 3, ironBands: 1 }, makes: gear('bascinet', 23, 'uncommon'), seconds: 6.5 },
  gildedFittings: { name: 'Gilded fittings', group: 'Fittings', needs: 210, from: { goldIngot: 1, silverIngot: 1 }, makes: 'gildedFittings', seconds: 4.5 },
  breastplate: { name: 'Breastplate', group: 'Armour', needs: 215, from: { steelIngot: 5, leatherStrip: 2 }, makes: gear('breastplate', 25, 'uncommon'), seconds: 7.5 },
  goldChain: { name: 'Gold chain', group: 'Trinkets', needs: 230, from: { goldIngot: 2, gildedFittings: 1 }, makes: gear('goldChain', 26, 'uncommon'), seconds: 6 },
  greatHelm: { name: 'Great helm', group: 'Armour', needs: 235, from: { steelIngot: 4, ironBands: 1 }, makes: gear('greatHelm', 27, 'uncommon'), seconds: 7 },
  starIronIngot: { name: 'Star-iron ingot', group: 'Smelting', needs: 240, from: { starIronOre: 2 }, makes: 'starIronIngot', seconds: 5 },
  plateGreaves: { name: 'Plate greaves', group: 'Armour', needs: 245, from: { steelIngot: 4, gildedFittings: 1 }, makes: gear('plateGreaves', 28, 'uncommon'), seconds: 7 },
  starIronPick: { name: 'Star-iron pickaxe', group: 'Tools', needs: 250, from: { starIronIngot: 2, oakPlank: 1 }, makes: 'starIronPick', seconds: 6 },
  signetRing: { name: 'Signet ring', group: 'Trinkets', needs: 255, from: { goldIngot: 1, gildedFittings: 1, gemShard: 1 }, makes: gear('signetRing', 28, 'uncommon'), seconds: 6 },
  towerShield: { name: 'Tower shield', group: 'Shields', needs: 265, from: { steelIngot: 4, oakPlank: 3, ironBands: 2 }, makes: gear('towerShield', 29, 'uncommon'), seconds: 7.5 },
  starIronBlade: { name: 'Star-iron blade', group: 'Weapons', needs: 280, from: { starIronIngot: 3, gildedFittings: 1 }, makes: gear('armingSword', 32, 'rare'), seconds: 8 },
  starIronPlate: { name: 'Star-iron breastplate', group: 'Armour', needs: 295, from: { starIronIngot: 5, gildedFittings: 1 }, makes: gear('breastplate', 33, 'rare'), seconds: 9 },
} satisfies Record<string, SmithRecipe>;
export type SmithRecipeId = keyof typeof SMITH_RECIPES;
export const SMITH_RECIPE_IDS = Object.keys(SMITH_RECIPES) as SmithRecipeId[];
const recipeOf = (id: SmithRecipeId): SmithRecipe => SMITH_RECIPES[id];
export const smithRise = (id: SmithRecipeId, level: number) => materialRise(SMITH_RECIPES, 'Smelting', id, level); // (an ingot lasting, as a plank does)

export interface SmithingHost {
  readonly hero: Hero;
  readonly inside: { entrance: Entrance; furniture: readonly Furniture[]; below?: unknown } | null;
  readonly lumber: { readonly chopping: unknown; stop(): void };
  readonly woodworking: { readonly making: unknown; stop(): void };
  readonly cooking: { readonly making: unknown; stop(): void };
  readonly work: { readonly shift: unknown };
  report(event: GameEvent): void;
}

export class Smithing {
  making: { recipe: SmithRecipeId; left: number; of: number; t: number } | null = null; // what's being made, how many more (of how many asked), seconds into the one under way
  private made = 0; // in all, for each its own roll

  constructor(private readonly host: SmithingHost) {}

  // The anvil the hero stands before (a smithy's, on its ground floor), if any.
  get anvilInReach(): Furniture | null {
    const { inside, hero } = this.host;
    if (!inside || inside.below || inside.entrance.type !== 'smithy') return null;
    return inside.furniture.find((f) => f.kind === 'anvil' && beforeBench(f, hero)) ?? null;
  }

  // Whether the skill's reached a recipe (known).
  knows(id: SmithRecipeId): boolean {
    return skillOf(this.host.hero, SKILL).level >= recipeOf(id).needs;
  }

  // How many of a recipe the materials in the bag would make (0: none, or not known yet), wherever they stand.
  canMake(id: SmithRecipeId): number {
    if (!this.knows(id)) return 0;
    const { bag } = this.host.hero;
    return Math.min(...Object.entries(recipeOf(id).from).map(([item, n]) => Math.floor((bag[item as LootId] ?? 0) / n!)));
  }

  // Whether what `id` makes would go in the bag (as woodworking's: a piece of gear, a stack of its own).
  roomFor(id: SmithRecipeId): boolean {
    const makes = recipeOf(id).makes;
    return canSwap(this.host.hero, recipeOf(id).from, [typeof makes === 'string' ? makes : gearKey({ ...makes, roll: 0 })]);
  }

  // `count` of a recipe begun (Infinity: all the materials make); whether it was (known, at the anvil, the materials
  // for one, room for it). Chopping, woodworking and cooking stop for it; at work, nothing's begun.
  start(id: SmithRecipeId, count = 1): boolean {
    if (this.host.work.shift || !this.anvilInReach || this.canMake(id) === 0 || count < 1 || !this.roomFor(id)) return false;
    [this.host.lumber.stop(), this.host.woodworking.stop(), this.host.cooking.stop()];
    const left = Math.min(count, this.canMake(id));
    this.making = { recipe: id, left, of: left, t: 0 };
    return true;
  }

  stop(): void {
    this.making = null;
  }

  // How far through the one under way (0..1), making; else null (its bar).
  get progress(): number | null {
    return this.making ? Math.min(1, this.making.t / recipeOf(this.making.recipe).seconds) : null;
  }

  // A moment of it: stopped by walking off (or from the anvil), chopping, woodworking, cooking, going to work; else on,
  // one made each recipe's seconds.
  update(dt: number, moving: boolean): void {
    const making = this.making;
    if (!making) return;
    if (moving || !this.anvilInReach || this.host.lumber.chopping || this.host.woodworking.making || this.host.cooking.making || this.host.work.shift) return this.stop();
    if ((making.t += dt) < recipeOf(making.recipe).seconds) return;
    making.t = 0;
    if (!this.makeOne(making.recipe) || --making.left <= 0) this.stop();
  }

  // One made: its materials out of the bag, what it makes in (no room, or materials gone: none, stopped, told why),
  // the skill up as its difficulty allows, some of the hero's own experience; told. Whether it was.
  private makeOne(id: SmithRecipeId): boolean {
    const recipe = recipeOf(id);
    const { hero } = this.host;
    if (this.canMake(id) === 0) return false;
    const level = skillOf(hero, SKILL).level;
    this.made++;
    const roll = (salt: number) => hashUnit(this.made, level, salt);
    const item: BagItem = typeof recipe.makes === 'string' ? recipe.makes : gearKey({ ...recipe.makes, roll: Math.floor(roll(702) * 1000) });
    if (!canSwap(hero, recipe.from, [item])) return this.host.report({ kind: 'poor', text: 'Your bag is full' }), false;
    for (const [material, n] of Object.entries(recipe.from)) for (let i = 0; i < n!; i++) takeFromBag(hero.bag, material as LootId);
    addToBag(hero.bag, item);
    gainXp(hero, HERO_XP);
    this.host.report({ kind: 'crafted', item });
    practise(hero, SKILL, recipe.needs, roll(701), this.host.report, smithRise(id, level).chance);
    return true;
  }
}

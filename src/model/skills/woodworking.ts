// Woodworking (skills.ts): making things from the wood a lumberjack fells (lumber.ts), as a WoW crafter does: a
// recipe picked (the skills window), made one at a time (a few seconds each, a bar filling; walking off, chopping or
// going to work stops it), as many as asked for, or all the materials in the bag allow. Each made takes its materials
// from the bag and puts what it makes in it (no room: it stops, told so). Recipes are known as the skill reaches
// them, from planks sawn from logs, through bowls, tankards, caskets and chests to sell, to wooden weapons and
// shields (iron-banded, with salvaged scrap from the journeyman's on, and a smith's nails and bands: smithing.ts); the finest varnished, or of ancient
// heartwood, better made (higher, rarer). Each made raises the skill as its difficulty
// allows (skills.ts: orange always … grey never), and gives some of the hero's own experience.

import { hashUnit } from '../../util/random';
import type { BagItem } from '../hero/bag';
import { addToBag, takeFromBag } from '../hero/bag';
import { canSwap } from '../hero/bagSlots';
import { gainXp } from '../hero/heroStats';
import { gearKey, type Rarity } from '../human/items/gear';
import type { ItemId } from '../human/equipment';
import type { LootId } from '../loot/loot';
import type { GameEvent, Hero } from '../types';
import { practise, skillOf } from './skills';

const SKILL = 'woodworking';
const HERO_XP = 2; // the hero's own experience, a thing made

export type RecipeId =
  | 'birchPlank'
  | 'woodenSword'
  | 'torch'
  | 'bedroll'
  | 'woodenBowl'
  | 'birchFramedPack'
  | 'bentwoodRing'
  | 'pinePlank'
  | 'buckler'
  | 'knottedClub'
  | 'fellingAxe'
  | 'quarterstaff'
  | 'oakPlank'
  | 'pinePack'
  | 'bandedCudgel'
  | 'carvedTankard'
  | 'carvedPendant'
  | 'spear'
  | 'plankShield'
  | 'varnish'
  | 'varnishedCasket'
  | 'broadAxe'
  | 'oakCask'
  | 'heaterShield'
  | 'varnishedStaff'
  | 'oakWarClub'
  | 'pavise'
  | 'oakChest'
  | 'heartwoodAmulet'
  | 'bandedTowerShield'
  | 'oakWarStaff'
  | 'heartwoodPack'
  | 'heavyCudgel'
  | 'oakBuckler'
  | 'oakPavise'
  | 'heartwoodTowerShield';

// What a recipe makes, to list it under (the skill's window: its sections).
export type RecipeGroup = 'Materials' | 'Goods' | 'Tools' | 'Packs' | 'Trinkets' | 'Weapons' | 'Shields';
export const RECIPE_GROUPS: readonly RecipeGroup[] = ['Materials', 'Goods', 'Tools', 'Packs', 'Trinkets', 'Weapons', 'Shields'];

export interface Recipe {
  name: string;
  group: RecipeGroup;
  needs: number; // the skill it wants (and its difficulty goes by)
  from: Partial<Record<LootId, number>>; // its materials, each how many
  makes: LootId | { item: ItemId; level: number; rarity: Rarity }; // what it makes: a material or goods, or a piece of gear made so
  seconds: number; // to make one
}

// The recipes, in the order of the skill they want.
export const RECIPES: Record<RecipeId, Recipe> = {
  // With what the salvage bench leaves (salvage.ts): packs for the bag's sockets, roomier each (loot/bags.ts); a
  // bedroll to lie down on anywhere; axes that chop quicker and leave more; trinkets set with the stones. From 150, a
  // recipe of oak alone every ten or fifteen levels, so there's always something to learn from without the rarer
  // woods; heartwood kept for the few finest.
  birchPlank: { name: 'Birch plank', group: 'Materials', needs: 1, from: { birchLog: 1 }, makes: 'birchPlank', seconds: 2.5 },
  woodenSword: { name: 'Wooden sword', group: 'Weapons', needs: 10, from: { birchPlank: 3 }, makes: { item: 'woodenSword', level: 3, rarity: 'common' }, seconds: 4 },
  torch: { name: 'Torch', group: 'Shields', needs: 15, from: { birchPlank: 2 }, makes: { item: 'torch', level: 4, rarity: 'common' }, seconds: 3.5 }, // (held in the off hand)
  bedroll: { name: 'Bedroll', group: 'Tools', needs: 20, from: { birchPlank: 4 }, makes: 'bedroll', seconds: 5 }, // (early, from planks alone: a hurt player on the road needs it in their first hour)
  woodenBowl: { name: 'Wooden bowl', group: 'Goods', needs: 25, from: { birchPlank: 2 }, makes: 'woodenBowl', seconds: 3.5 },
  birchFramedPack: { name: 'Birch-framed pack', group: 'Packs', needs: 30, from: { birchPlank: 4, leatherStrip: 2 }, makes: 'birchFramedPack', seconds: 5 },
  bentwoodRing: { name: 'Bentwood ring', group: 'Trinkets', needs: 40, from: { birchPlank: 2, silverFilings: 2 }, makes: { item: 'bentwoodRing', level: 5, rarity: 'common' }, seconds: 4 },
  pinePlank: { name: 'Pine plank', group: 'Materials', needs: 50, from: { pineLog: 1 }, makes: 'pinePlank', seconds: 2.5 },
  buckler: { name: 'Buckler', group: 'Shields', needs: 55, from: { pinePlank: 3, leatherStrip: 1 }, makes: { item: 'buckler', level: 7, rarity: 'common' }, seconds: 4.5 },
  knottedClub: { name: 'Knotted club', group: 'Weapons', needs: 65, from: { pinePlank: 3, birchPlank: 1 }, makes: { item: 'club', level: 8, rarity: 'common' }, seconds: 4.5 },
  fellingAxe: { name: 'Felling axe', group: 'Tools', needs: 80, from: { pinePlank: 3, ironScrap: 3 }, makes: { item: 'fellingAxe', level: 12, rarity: 'common' }, seconds: 5 },
  quarterstaff: { name: 'Quarterstaff', group: 'Weapons', needs: 90, from: { pinePlank: 4 }, makes: { item: 'quarterstaff', level: 11, rarity: 'common' }, seconds: 5 },
  oakPlank: { name: 'Oak plank', group: 'Materials', needs: 100, from: { oakLog: 1 }, makes: 'oakPlank', seconds: 2.5 },
  pinePack: { name: 'Pine pack', group: 'Packs', needs: 110, from: { pinePlank: 5, leatherStrip: 3 }, makes: 'pinePack', seconds: 5.5 },
  bandedCudgel: { name: 'Iron-banded cudgel', group: 'Weapons', needs: 120, from: { oakPlank: 3, ironScrap: 2 }, makes: { item: 'bandedCudgel', level: 14, rarity: 'common' }, seconds: 5 },
  carvedTankard: { name: 'Carved tankard', group: 'Goods', needs: 125, from: { oakPlank: 3 }, makes: 'carvedTankard', seconds: 4.5 },
  carvedPendant: { name: 'Carved pendant', group: 'Trinkets', needs: 130, from: { oakPlank: 2, gemShard: 1, silverFilings: 1 }, makes: { item: 'carvedPendant', level: 15, rarity: 'uncommon' }, seconds: 4.5 },
  spear: { name: 'Spear', group: 'Weapons', needs: 140, from: { pinePlank: 2, oakPlank: 2, ironScrap: 2 }, makes: { item: 'spear', level: 15, rarity: 'common' }, seconds: 5 },
  plankShield: { name: 'Plank shield', group: 'Shields', needs: 150, from: { oakPlank: 3, pinePlank: 1 }, makes: { item: 'plankShield', level: 16, rarity: 'common' }, seconds: 5 },
  varnish: { name: 'Varnish', group: 'Materials', needs: 160, from: { pineResin: 1 }, makes: 'varnish', seconds: 2.5 },
  varnishedCasket: { name: 'Varnished casket', group: 'Goods', needs: 170, from: { oakPlank: 2, varnish: 1 }, makes: 'varnishedCasket', seconds: 5 },
  broadAxe: { name: 'Broad axe', group: 'Tools', needs: 180, from: { oakPlank: 2, temperedIngot: 1, leatherStrip: 1 }, makes: { item: 'broadAxe', level: 22, rarity: 'uncommon' }, seconds: 6 },
  oakCask: { name: 'Oak cask', group: 'Goods', needs: 185, from: { oakPlank: 3 }, makes: 'oakCask', seconds: 5.5 }, // (an inn's: for its ale)
  heaterShield: { name: 'Heater shield', group: 'Shields', needs: 190, from: { oakPlank: 3, varnish: 1, ironNails: 2 }, makes: { item: 'heaterShield', level: 21, rarity: 'uncommon' }, seconds: 6 },
  varnishedStaff: { name: 'Varnished quarterstaff', group: 'Weapons', needs: 200, from: { oakPlank: 3, varnish: 1 }, makes: { item: 'quarterstaff', level: 22, rarity: 'uncommon' }, seconds: 5.5 },
  oakWarClub: { name: 'Oak war club', group: 'Weapons', needs: 210, from: { oakPlank: 3 }, makes: { item: 'club', level: 24, rarity: 'uncommon' }, seconds: 6 },
  pavise: { name: 'Pavise', group: 'Shields', needs: 215, from: { oakPlank: 4, varnish: 1, leatherStrip: 2, temperedIngot: 1 }, makes: { item: 'pavise', level: 25, rarity: 'uncommon' }, seconds: 6.5 },
  oakChest: { name: 'Oak chest', group: 'Goods', needs: 225, from: { oakPlank: 3, varnish: 1 }, makes: 'oakChest', seconds: 6.5 },
  heartwoodAmulet: { name: 'Heartwood amulet', group: 'Trinkets', needs: 230, from: { heartwood: 1, cutGem: 1, varnish: 1 }, makes: { item: 'heartwoodAmulet', level: 27, rarity: 'rare' }, seconds: 6 },
  bandedTowerShield: { name: 'Banded tower shield', group: 'Shields', needs: 235, from: { oakPlank: 3, ironBands: 2 }, makes: { item: 'towerShield', level: 27, rarity: 'uncommon' }, seconds: 6.5 },
  oakWarStaff: { name: 'Oak war staff', group: 'Weapons', needs: 245, from: { oakPlank: 2 }, makes: { item: 'quarterstaff', level: 28, rarity: 'uncommon' }, seconds: 6.5 },
  heartwoodPack: { name: 'Heartwood pack', group: 'Packs', needs: 255, from: { heartwood: 2, oakPlank: 2, leatherStrip: 4 }, makes: 'heartwoodPack', seconds: 7 },
  heavyCudgel: { name: 'Heavy cudgel', group: 'Weapons', needs: 260, from: { oakPlank: 3, ironScrap: 3, leatherStrip: 1 }, makes: { item: 'bandedCudgel', level: 30, rarity: 'uncommon' }, seconds: 7 },
  oakBuckler: { name: 'Oak buckler', group: 'Shields', needs: 265, from: { oakPlank: 2 }, makes: { item: 'buckler', level: 30, rarity: 'uncommon' }, seconds: 7 },
  oakPavise: { name: 'Oak pavise', group: 'Shields', needs: 275, from: { oakPlank: 4, varnish: 1, ironBands: 2 }, makes: { item: 'pavise', level: 31, rarity: 'uncommon' }, seconds: 7.5 },
  heartwoodTowerShield: { name: 'Heartwood tower shield', group: 'Shields', needs: 285, from: { heartwood: 2, oakPlank: 3, varnish: 1 }, makes: { item: 'towerShield', level: 33, rarity: 'rare' }, seconds: 8 },
};
export const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[];

export interface WoodworkingHost {
  readonly hero: Hero;
  readonly lumber: { readonly chopping: unknown; stop(): void };
  readonly fishing: { readonly line: unknown; stop(): void }; // (a line out: reeled in to make something; cast, the making stopped)
  readonly cooking: { readonly making: unknown; stop(): void };
  readonly work: { readonly shift: unknown };
  report(event: GameEvent): void;
}

export class Woodworking {
  making: { recipe: RecipeId; left: number; of: number; t: number } | null = null; // what's being made, how many more (of how many asked), seconds into the one under way
  private made = 0; // in all, for each its own roll

  constructor(private readonly host: WoodworkingHost) {}

  // Whether the skill's reached a recipe (known).
  knows(id: RecipeId): boolean {
    return skillOf(this.host.hero, SKILL).level >= RECIPES[id].needs;
  }

  // How many of a recipe the materials in the bag would make (0: none, or not known yet).
  canMake(id: RecipeId): number {
    if (!this.knows(id)) return 0;
    const { bag } = this.host.hero;
    return Math.min(...Object.entries(RECIPES[id].from).map(([item, n]) => Math.floor((bag[item as LootId] ?? 0) / n!)));
  }

  // Whether what `id` makes would go in the bag (a stack of it with room, or a slot free: the last of its materials'
  // among them; a piece of gear, a stack of its own: never on a plain one's).
  roomFor(id: RecipeId): boolean {
    const makes = RECIPES[id].makes;
    return canSwap(this.host.hero, RECIPES[id].from, [typeof makes === 'string' ? makes : gearKey({ ...makes, roll: 0 })]);
  }

  // `count` of a recipe begun (Infinity: all the materials make); whether it was (known, the materials for one, room
  // for it). Chopping, a line out and cooking stop for it; at work, nothing's begun.
  start(id: RecipeId, count = 1): boolean {
    if (this.host.work.shift || this.canMake(id) === 0 || count < 1 || !this.roomFor(id)) return false; // (a full bag: nothing made to be lost)
    [this.host.lumber.stop(), this.host.fishing.stop(), this.host.cooking.stop()];
    const left = Math.min(count, this.canMake(id));
    this.making = { recipe: id, left, of: left, t: 0 };
    return true;
  }

  stop(): void {
    this.making = null;
  }

  // How far through the one under way (0..1), making; else null (its bar).
  get progress(): number | null {
    return this.making ? Math.min(1, this.making.t / RECIPES[this.making.recipe].seconds) : null;
  }

  // A moment of it: stopped by walking off, chopping, a line cast, cooking, going to work; else on, one made each recipe's seconds.
  update(dt: number, moving: boolean): void {
    const making = this.making;
    if (!making) return;
    if (moving || this.host.lumber.chopping || this.host.fishing.line || this.host.cooking.making || this.host.work.shift) return this.stop();
    if ((making.t += dt) < RECIPES[making.recipe].seconds) return;
    making.t = 0;
    if (!this.makeOne(making.recipe) || --making.left <= 0) this.stop();
  }

  // One made: its materials out of the bag, what it makes in (no room, or materials gone: none, stopped, told why),
  // the skill up as its difficulty allows, some of the hero's own experience; told. Whether it was.
  private makeOne(id: RecipeId): boolean {
    const recipe = RECIPES[id];
    const { hero } = this.host;
    if (this.canMake(id) === 0) return false;
    const level = skillOf(hero, SKILL).level;
    this.made++;
    const roll = (salt: number) => hashUnit(this.made, level, salt);
    const item: BagItem = typeof recipe.makes === 'string' ? recipe.makes : gearKey({ ...recipe.makes, roll: Math.floor(roll(502) * 1000) });
    if (!canSwap(hero, recipe.from, [item])) return this.host.report({ kind: 'poor', text: 'Your bag is full' }), false;
    for (const [material, n] of Object.entries(recipe.from)) for (let i = 0; i < n!; i++) takeFromBag(hero.bag, material as LootId);
    addToBag(hero.bag, item);
    gainXp(hero, HERO_XP);
    this.host.report({ kind: 'crafted', item });
    practise(hero, SKILL, recipe.needs, roll(501), this.host.report);
    return true;
  }
}

// Woodworking (skills.ts): making things from the wood a lumberjack fells (lumber.ts), as a WoW crafter does: a
// recipe picked (the skills window), made one at a time (a few seconds each, a bar filling; walking off, chopping or
// going to work stops it), as many as asked for, or all the materials in the bag allow. Each made takes its materials
// from the bag and puts what it makes in it (no room: it stops, told so). Recipes are known as the skill reaches
// them, from planks sawn from logs, through bowls and tankards to sell, to wooden weapons and shields; the finest
// varnished, or of ancient heartwood, better made (higher, rarer). Each made raises the skill as its difficulty
// allows (skills.ts: orange always … grey never), and gives some of the hero's own experience.

import { hashUnit } from '../../util/random';
import type { BagItem } from '../hero/bag';
import { addToBag, takeFromBag } from '../hero/bag';
import { canCarry } from '../hero/bagSlots';
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
  | 'woodenBowl'
  | 'pinePlank'
  | 'knottedClub'
  | 'quarterstaff'
  | 'oakPlank'
  | 'carvedTankard'
  | 'plankShield'
  | 'varnish'
  | 'varnishedStaff'
  | 'heartwoodShield'
  | 'heartwoodStaff';

// What a recipe makes, to list it under (the skill's window: its sections).
export type RecipeGroup = 'Materials' | 'Goods' | 'Weapons' | 'Shields';
export const RECIPE_GROUPS: readonly RecipeGroup[] = ['Materials', 'Goods', 'Weapons', 'Shields'];

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
  birchPlank: { name: 'Birch plank', group: 'Materials', needs: 1, from: { birchLog: 1 }, makes: 'birchPlank', seconds: 2 },
  woodenSword: { name: 'Wooden sword', group: 'Weapons', needs: 10, from: { birchPlank: 2 }, makes: { item: 'woodenSword', level: 3, rarity: 'common' }, seconds: 3 },
  woodenBowl: { name: 'Wooden bowl', group: 'Goods', needs: 25, from: { birchPlank: 1 }, makes: 'woodenBowl', seconds: 2.5 },
  pinePlank: { name: 'Pine plank', group: 'Materials', needs: 50, from: { pineLog: 1 }, makes: 'pinePlank', seconds: 2 },
  knottedClub: { name: 'Knotted club', group: 'Weapons', needs: 65, from: { pinePlank: 2, birchPlank: 1 }, makes: { item: 'club', level: 8, rarity: 'common' }, seconds: 3 },
  quarterstaff: { name: 'Quarterstaff', group: 'Weapons', needs: 90, from: { pinePlank: 3 }, makes: { item: 'quarterstaff', level: 11, rarity: 'common' }, seconds: 3.5 },
  oakPlank: { name: 'Oak plank', group: 'Materials', needs: 100, from: { oakLog: 1 }, makes: 'oakPlank', seconds: 2 },
  carvedTankard: { name: 'Carved tankard', group: 'Goods', needs: 125, from: { oakPlank: 2 }, makes: 'carvedTankard', seconds: 3 },
  plankShield: { name: 'Plank shield', group: 'Shields', needs: 150, from: { oakPlank: 3, pinePlank: 1 }, makes: { item: 'plankShield', level: 16, rarity: 'common' }, seconds: 4 },
  varnish: { name: 'Varnish', group: 'Materials', needs: 160, from: { pineResin: 2 }, makes: 'varnish', seconds: 2.5 },
  varnishedStaff: { name: 'Varnished quarterstaff', group: 'Weapons', needs: 200, from: { oakPlank: 4, varnish: 1 }, makes: { item: 'quarterstaff', level: 22, rarity: 'uncommon' }, seconds: 4 },
  heartwoodShield: { name: 'Heartwood shield', group: 'Shields', needs: 240, from: { heartwood: 2, oakPlank: 3, varnish: 1 }, makes: { item: 'plankShield', level: 28, rarity: 'rare' }, seconds: 5 },
  heartwoodStaff: { name: 'Heartwood staff', group: 'Weapons', needs: 270, from: { heartwood: 3, varnish: 2 }, makes: { item: 'quarterstaff', level: 32, rarity: 'rare' }, seconds: 5 },
};
export const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[];

export interface WoodworkingHost {
  readonly hero: Hero;
  readonly lumber: { readonly chopping: unknown; stop(): void };
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

  // `count` of a recipe begun (Infinity: all the materials make); whether it was (known, and the materials for one).
  // Chopping stops for it; at work, nothing's begun.
  start(id: RecipeId, count = 1): boolean {
    if (this.host.work.shift || this.canMake(id) === 0 || count < 1) return false;
    this.host.lumber.stop();
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

  // A moment of it: stopped by walking off, chopping, going to work; else on, one made each recipe's seconds.
  update(dt: number, moving: boolean): void {
    const making = this.making;
    if (!making) return;
    if (moving || this.host.lumber.chopping || this.host.work.shift) return this.stop();
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
    if (!canCarry(hero, item)) return this.host.report({ kind: 'poor', text: 'Your bag is full' }), false;
    for (const [material, n] of Object.entries(recipe.from)) for (let i = 0; i < n!; i++) takeFromBag(hero.bag, material as LootId);
    addToBag(hero.bag, item);
    gainXp(hero, HERO_XP);
    this.host.report({ kind: 'crafted', item });
    practise(hero, SKILL, recipe.needs, roll(501), this.host.report);
    return true;
  }
}

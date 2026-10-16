// Alchemy's brewing (skills.ts; its picking: herbalism.ts): the herbs of the wilds (loot/herbs.ts), with the caves'
// spider silk, venom glands and bat wings and a bear's honeycomb, brewed into potions (loot/potions.ts), as a cook
// cooks (cooking.ts): at a cauldron (a herbalist's, the hedge-witch's, the hero's own: any on a ground floor, stood
// before it), or with a brewer's kit in the bag by any fire (a little slower: KIT_SLOWER). A recipe picked (the skill's
// window: controller/skills/alchemyBook.ts), brewed one at a time (a few seconds each, a bar filling; walking off,
// another trade or going to work stops it), as many as asked or the bag allows; each takes its herbs from the bag and
// puts the brew in it. Healing and vigour by tier (the herbalists' six, and a superior of each), cures (an antidote,
// a purge, the pox's salve), draughts (a well's blessing for a while) and a love-philtre to sell. Each raises the
// skill as its difficulty allows, worth two tries a picked herb's one (BREW_WORTH: a brew's several herbs picked),
// and gives some of the hero's own experience.

import { hashUnit } from '../../util/random';
import { addToBag, takeFromBag } from '../hero/bag';
import { canSwap } from '../hero/bagSlots';
import { gainXp } from '../hero/heroStats';
import type { Furniture } from '../interiors/furniture';
import type { LootId } from '../loot/loot';
import type { PotionId } from '../loot/potions';
import type { GameEvent, Hero } from '../types';
import { beforeBench } from './salvage';
import { practise, skillOf } from './skills';

const SKILL = 'alchemy';
const HERO_XP = 2; // the hero's own experience, a brew
export const BREW_WORTH = 2; // tries a brew teaches (skills.ts practise's worth)
export const KIT_SLOWER = 1.5; // a brew's seconds, times, by a fire with a kit

export type BrewGroup = 'Healing' | 'Vigour' | 'Cures' | 'Draughts' | 'Oddities';
export const BREW_GROUPS: readonly BrewGroup[] = ['Healing', 'Vigour', 'Cures', 'Draughts', 'Oddities'];

export interface BrewRecipe {
  name: string;
  group: BrewGroup;
  needs: number; // the skill it wants (and its difficulty goes by)
  from: Partial<Record<LootId, number>>; // its herbs and parts, each how many
  makes: PotionId;
  seconds: number; // to brew one, at a cauldron
}

// The recipes, in the order of the skill they want: a minor health potion of either of the first herbs (spring's
// chamomile, autumn's rosehips: one for every season), each of the herbalists' six as its herbs are reached, then the
// cures, draughts and superiors.
export const BREW_RECIPES = {
  minorHealth: { name: 'Minor health potion', group: 'Healing', needs: 1, from: { chamomile: 2 }, makes: 'minorHealthPotion', seconds: 3 },
  minorHealthHips: { name: 'Minor health potion, of rosehips', group: 'Healing', needs: 1, from: { rosehip: 2 }, makes: 'minorHealthPotion', seconds: 3 },
  minorEnergy: { name: 'Minor energy potion', group: 'Vigour', needs: 25, from: { nettle: 1 }, makes: 'minorEnergyPotion', seconds: 3 },
  antidote: { name: 'Antidote', group: 'Cures', needs: 40, from: { venomGland: 1, nettle: 1 }, makes: 'antidote', seconds: 3.5 },
  purge: { name: 'Purge', group: 'Cures', needs: 60, from: { mistletoe: 1, nettle: 1 }, makes: 'purge', seconds: 3 },
  lovePhiltre: { name: 'Love-philtre', group: 'Oddities', needs: 65, from: { rosehip: 2, yarrow: 1 }, makes: 'lovePhiltre', seconds: 3.5 },
  lesserHealth: { name: 'Lesser health potion', group: 'Healing', needs: 75, from: { yarrow: 2, chamomile: 1 }, makes: 'lesserHealthPotion', seconds: 3.5 },
  lesserEnergy: { name: 'Lesser energy potion', group: 'Vigour', needs: 90, from: { woundwort: 1 }, makes: 'lesserEnergyPotion', seconds: 3.5 },
  swiftDraught: { name: 'Draught of swiftness', group: 'Draughts', needs: 100, from: { yarrow: 1, batWing: 1 }, makes: 'swiftDraught', seconds: 4 },
  poxSalve: { name: 'Pox salve', group: 'Cures', needs: 120, from: { lavender: 1, woundwort: 1 }, makes: 'poxSalve', seconds: 4 },
  shadowDraught: { name: 'Shadow draught', group: 'Draughts', needs: 130, from: { snowdrop: 1, batWing: 1, mistletoe: 1 }, makes: 'shadowDraught', seconds: 4 },
  greaterHealth: { name: 'Greater health potion', group: 'Healing', needs: 150, from: { comfrey: 2, woundwort: 1, spiderSilk: 1 }, makes: 'greaterHealthPotion', seconds: 4.5 },
  greaterEnergy: { name: 'Greater energy potion', group: 'Vigour', needs: 165, from: { foxglove: 1 }, makes: 'greaterEnergyPotion', seconds: 4.5 },
  oxDraught: { name: 'Ox draught', group: 'Draughts', needs: 175, from: { flyAgaric: 1, venomGland: 1 }, makes: 'oxDraught', seconds: 4.5 },
  barkDraught: { name: 'Bark-skin draught', group: 'Draughts', needs: 200, from: { hellebore: 1, mistletoe: 1, spiderSilk: 1 }, makes: 'barkDraught', seconds: 5 },
  superiorHealth: { name: 'Superior health potion', group: 'Healing', needs: 240, from: { mandrake: 1, comfrey: 2, honeycomb: 1 }, makes: 'superiorHealthPotion', seconds: 5.5 },
  superiorEnergy: { name: 'Superior energy potion', group: 'Vigour', needs: 255, from: { wolfsbane: 1, foxglove: 1, batWing: 1 }, makes: 'superiorEnergyPotion', seconds: 5.5 },
  hawkDraught: { name: 'Hawk-eye draught', group: 'Draughts', needs: 270, from: { mandrake: 1, wolfsbane: 1, snowdrop: 1 }, makes: 'hawkDraught', seconds: 6 },
} satisfies Record<string, BrewRecipe>;
export type BrewRecipeId = keyof typeof BREW_RECIPES;
export const BREW_RECIPE_IDS = Object.keys(BREW_RECIPES) as BrewRecipeId[];
const recipeOf = (id: BrewRecipeId): BrewRecipe => BREW_RECIPES[id];

// Where the hero brews: a cauldron stood before, or a fire in reach with a kit in the bag.
export interface Still {
  kind: 'cauldron' | 'kit';
  x: number;
  z: number;
}

export interface AlchemyHost {
  readonly hero: Hero;
  readonly inside: { furniture: readonly Furniture[]; below?: unknown } | null;
  readonly cooking: { readonly making: unknown; readonly fireInReach: { x: number; z: number } | null; stop(): void };
  readonly lumber: { readonly chopping: unknown; stop(): void };
  readonly woodworking: { readonly making: unknown; stop(): void };
  readonly smithing: { readonly making: unknown; stop(): void };
  readonly salvage: { readonly breaking: unknown; stop(): void };
  readonly fishing: { readonly line: unknown; stop(): void };
  readonly mining: { readonly striking: unknown; stop(): void };
  readonly work: { readonly shift: unknown };
  report(event: GameEvent): void;
}

export class Alchemy {
  making: { recipe: BrewRecipeId; left: number; of: number; t: number } | null = null; // what's brewing, how many more (of how many asked), seconds into the one under way
  private made = 0; // in all, for each its own roll

  constructor(private readonly host: AlchemyHost) {}

  // The cauldron the hero stands before (on a ground floor), if any.
  get cauldronInReach(): Furniture | null {
    const { inside, hero } = this.host;
    if (!inside || inside.below) return null;
    return inside.furniture.find((f) => f.kind === 'cauldron' && beforeBench(f, hero)) ?? null;
  }

  // Where they'd brew just now: a cauldron before them, else a fire in reach with a kit in the bag; none, nowhere.
  get stillInReach(): Still | null {
    const cauldron = this.cauldronInReach;
    if (cauldron) return { kind: 'cauldron', x: cauldron.x, z: cauldron.z };
    const fire = (this.host.hero.bag.brewersKit ?? 0) > 0 ? this.host.cooking.fireInReach : null;
    return fire ? { kind: 'kit', x: fire.x, z: fire.z } : null;
  }

  // Seconds a recipe takes where they are (a kit's, slower).
  secondsOf(id: BrewRecipeId): number {
    return recipeOf(id).seconds * (this.stillInReach?.kind === 'kit' ? KIT_SLOWER : 1);
  }

  // Whether the skill's reached a recipe (known).
  knows(id: BrewRecipeId): boolean {
    return skillOf(this.host.hero, SKILL).level >= recipeOf(id).needs;
  }

  // How many of a recipe the bag would brew (0: none, or not known yet), wherever they stand.
  canMake(id: BrewRecipeId): number {
    if (!this.knows(id)) return 0;
    const { bag } = this.host.hero;
    return Math.min(...Object.entries(recipeOf(id).from).map(([item, n]) => Math.floor((bag[item as LootId] ?? 0) / n!)));
  }

  // Whether the brew would go in the bag.
  roomFor(id: BrewRecipeId): boolean {
    return canSwap(this.host.hero, recipeOf(id).from, [recipeOf(id).makes]);
  }

  // `count` of a recipe begun (Infinity: all the bag makes); whether it was (known, at a still, the herbs for one, room
  // for it), the hero turned to it; the other trades stopped for it; at work, nothing's begun.
  start(id: BrewRecipeId, count = 1): boolean {
    const still = this.stillInReach;
    if (this.host.work.shift || !still || this.canMake(id) === 0 || count < 1 || !this.roomFor(id)) return false;
    const { lumber, woodworking, cooking, smithing, salvage, fishing, mining, hero } = this.host;
    [lumber.stop(), woodworking.stop(), cooking.stop(), smithing.stop(), salvage.stop(), fishing.stop(), mining.stop()];
    hero.facing = Math.atan2(still.x - hero.x, still.z - hero.z);
    const left = Math.min(count, this.canMake(id));
    this.making = { recipe: id, left, of: left, t: 0 };
    return true;
  }

  stop(): void {
    this.making = null;
  }

  // How far through the one under way (0..1), brewing; else null (its bar).
  get progress(): number | null {
    return this.making ? Math.min(1, this.making.t / this.secondsOf(this.making.recipe)) : null;
  }

  // A moment of it: stopped by walking off (or from the still), another trade taken up, going to work; else on, one
  // brewed each recipe's seconds.
  update(dt: number, moving: boolean): void {
    const making = this.making;
    if (!making) return;
    const { lumber, woodworking, cooking, smithing, salvage, fishing, mining, work } = this.host;
    const busy = lumber.chopping || woodworking.making || cooking.making || smithing.making || salvage.breaking || fishing.line || mining.striking || work.shift;
    if (moving || busy || !this.stillInReach) return this.stop();
    if ((making.t += dt) < this.secondsOf(making.recipe)) return;
    making.t = 0;
    if (!this.brewOne(making.recipe) || --making.left <= 0) this.stop();
  }

  // One brewed: its herbs out of the bag, the brew in (no room, or herbs gone: none, stopped, told why), the skill up as
  // its difficulty allows, some of the hero's own experience; told. Whether it was.
  private brewOne(id: BrewRecipeId): boolean {
    const recipe = recipeOf(id);
    const { hero } = this.host;
    if (this.canMake(id) === 0) return false;
    if (!this.roomFor(id)) return this.host.report({ kind: 'poor', text: 'Your bag is full' }), false;
    this.made++;
    for (const [item, n] of Object.entries(recipe.from)) for (let i = 0; i < n!; i++) takeFromBag(hero.bag, item as LootId);
    addToBag(hero.bag, recipe.makes);
    gainXp(hero, HERO_XP);
    this.host.report({ kind: 'crafted', item: recipe.makes });
    practise(hero, SKILL, recipe.needs, hashUnit(this.made, skillOf(hero, SKILL).level, 1401), this.host.report, undefined, BREW_WORTH);
    return true;
  }
}

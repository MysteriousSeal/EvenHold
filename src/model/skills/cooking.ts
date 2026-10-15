// Cooking (skills.ts): the meat beasts drop and the fish caught from a shore made into meals (loot/meals.ts), as a WoW
// cook does, and only by a fire: a bandit camp's, a campfire the hero kindles anywhere outdoors (of a pedlar's bundle of
// firewood, or two logs), or a
// hearth indoors (an inn's, a home's). A recipe picked (the skill's window: controller/skills/cookBook.ts), cooked one
// at a time (a few seconds each, a bar filling; walking off, chopping or going to work stops it, and so does the fire
// going out or being left), as many as asked for or all the bag allows; each takes its makings from the bag and puts
// the meal in it. Roasts and fish over any fire; the stews, pies and feasts want a hearth, their pot and oven. Each
// raises the skill as its difficulty allows (skills.ts: orange always … grey never), and gives some of the hero's own
// experience.

import { hashUnit } from '../../util/random';
import { addToBag, takeFromBag } from '../hero/bag';
import { canSwap } from '../hero/bagSlots';
import { gainXp } from '../hero/heroStats';
import type { Camp } from '../camps/camps';
import type { Furniture } from '../interiors/furniture';
import type { LootId } from '../loot/loot';
import type { MealId } from '../loot/meals';
import type { GameEvent, Hero } from '../types';
import { practise, skillOf } from './skills';

const SKILL = 'cooking';
const HERO_XP = 2; // the hero's own experience, a meal cooked

export type CookRecipeId = MealId; // (each recipe makes the meal of its name)

// What a recipe makes, to list it under (the skill's window: its sections).
export type CookGroup = 'Roasts' | 'Fish' | 'Stews' | 'Pies' | 'Feasts';
export const COOK_GROUPS: readonly CookGroup[] = ['Roasts', 'Fish', 'Stews', 'Pies', 'Feasts'];

export interface CookRecipe {
  name: string;
  group: CookGroup;
  needs: number; // the skill it wants (and its difficulty goes by)
  from: Partial<Record<LootId, number>>; // its makings, each how many
  makes: MealId;
  seconds: number; // to cook one
  hearth?: boolean; // wants a hearth (a pot, an oven), not any fire
}

// The recipes, in the order of the skill they want: plain roasts first, the fish as they're caught (small fry from
// the start, in a cake with bought flour and a chowder with salt; roach from 40, trout and perch from 75, eel and bream
// from 110, grayling, char and pike from 150, salmon from 240, sturgeon from 250), then a
// hearth's stews, pies and feasts. Meat's a hunt's worth, not a shore's afternoon: a cut to a dish, and a roast of it
// Well fed twice a fish's while (loot/meals.ts).
export const COOK_RECIPES: Record<CookRecipeId, CookRecipe> = {
  roastedFry: { name: 'Roasted small fry', group: 'Fish', needs: 1, from: { smallFry: 2 }, makes: 'roastedFry', seconds: 2 },
  roastBoar: { name: 'Roast boar', group: 'Roasts', needs: 1, from: { rawBoarMeat: 1 }, makes: 'roastBoar', seconds: 2.5 },
  fryCake: { name: 'Fry cake', group: 'Fish', needs: 15, from: { smallFry: 2, flour: 1 }, makes: 'fryCake', seconds: 3 },
  wolfSkewer: { name: 'Wolf skewer', group: 'Roasts', needs: 25, from: { rawWolfMeat: 1 }, makes: 'wolfSkewer', seconds: 2.5 },
  friedRoach: { name: 'Fried roach', group: 'Fish', needs: 40, from: { roach: 1 }, makes: 'friedRoach', seconds: 2.5 },
  searedLynx: { name: 'Seared lynx', group: 'Roasts', needs: 45, from: { leanLynxMeat: 1 }, makes: 'searedLynx', seconds: 2.5 },
  fryChowder: { name: 'Fry chowder', group: 'Fish', needs: 55, from: { smallFry: 3, salt: 1 }, makes: 'fryChowder', seconds: 3.5 },
  bearSteak: { name: 'Bear steak', group: 'Roasts', needs: 60, from: { rawBearMeat: 1 }, makes: 'bearSteak', seconds: 3 },
  grilledTrout: { name: 'Grilled trout', group: 'Fish', needs: 75, from: { riverTrout: 1 }, makes: 'grilledTrout', seconds: 3 },
  saltedPerch: { name: 'Salt-baked perch', group: 'Fish', needs: 90, from: { lakePerch: 1, salt: 1 }, makes: 'saltedPerch', seconds: 3 },
  boarStew: { name: 'Boar stew', group: 'Stews', needs: 100, from: { rawBoarMeat: 2, salt: 1 }, makes: 'boarStew', seconds: 4, hearth: true },
  smokedEel: { name: 'Smoked eel', group: 'Fish', needs: 110, from: { eel: 1, salt: 1 }, makes: 'smokedEel', seconds: 3.5 },
  fishStew: { name: "Fisherman's stew", group: 'Stews', needs: 115, from: { riverTrout: 1, lakePerch: 1, salt: 1 }, makes: 'fishStew', seconds: 4, hearth: true },
  bakedBream: { name: 'Baked bream', group: 'Fish', needs: 120, from: { bream: 2, flour: 1 }, makes: 'bakedBream', seconds: 3.5 },
  honeyBear: { name: 'Honey-glazed bear', group: 'Stews', needs: 130, from: { rawBearMeat: 1, honeycomb: 1 }, makes: 'honeyBear', seconds: 4, hearth: true },
  roastPike: { name: 'Roast pike', group: 'Fish', needs: 150, from: { pike: 1, salt: 1 }, makes: 'roastPike', seconds: 3.5 },
  huntersPie: { name: "Hunter's pie", group: 'Pies', needs: 160, from: { rawBoarMeat: 1, leanLynxMeat: 1, flour: 1 }, makes: 'huntersPie', seconds: 4.5, hearth: true },
  graylingPie: { name: 'Grayling pie', group: 'Pies', needs: 165, from: { grayling: 1, flour: 1, salt: 1 }, makes: 'graylingPie', seconds: 4.5, hearth: true },
  pikePie: { name: 'Pike pie', group: 'Pies', needs: 180, from: { pike: 1, flour: 1, salt: 1 }, makes: 'pikePie', seconds: 4.5, hearth: true },
  searedChar: { name: 'Seared char', group: 'Fish', needs: 185, from: { char: 1, salt: 1 }, makes: 'searedChar', seconds: 3.5 },
  honeyCake: { name: 'Honey cake', group: 'Pies', needs: 200, from: { honeycomb: 1, flour: 1 }, makes: 'honeyCake', seconds: 4.5, hearth: true },
  huntersFeast: { name: "Hunter's feast", group: 'Feasts', needs: 225, from: { rawBearMeat: 1, rawBoarMeat: 1, leanLynxMeat: 1, rawWolfMeat: 1, salt: 1 }, makes: 'huntersFeast', seconds: 6, hearth: true },
  grilledSalmon: { name: 'Grilled salmon', group: 'Fish', needs: 240, from: { salmon: 1, salt: 1 }, makes: 'grilledSalmon', seconds: 3.5 },
  riverFeast: { name: 'River feast', group: 'Feasts', needs: 250, from: { pike: 1, riverTrout: 1, lakePerch: 1, smallFry: 2, flour: 1 }, makes: 'riverFeast', seconds: 6, hearth: true },
  smokedSturgeon: { name: 'Smoked sturgeon', group: 'Fish', needs: 260, from: { sturgeon: 1, salt: 1 }, makes: 'smokedSturgeon', seconds: 4 },
  lordsFeast: { name: "Lord's feast", group: 'Feasts', needs: 275, from: { rawBearMeat: 2, honeycomb: 1, flour: 2, salt: 1 }, makes: 'lordsFeast', seconds: 7, hearth: true },
  anglersFeast: { name: "Angler's feast", group: 'Feasts', needs: 290, from: { sturgeon: 1, char: 1, eel: 1, grayling: 1, flour: 1 }, makes: 'anglersFeast', seconds: 7, hearth: true },
};
export const COOK_RECIPE_IDS = Object.keys(COOK_RECIPES) as CookRecipeId[];

// What a dish teaches, in tries (skills.ts practise's worth): one of a hunt's meat or honeycomb, dear to come by (a
// beast to find and kill for each), HUNTED_WORTH; a shore's or a shop's, one.
const HUNTED: ReadonlySet<LootId> = new Set(['rawBoarMeat', 'rawWolfMeat', 'rawBearMeat', 'leanLynxMeat', 'honeycomb']);
export const HUNTED_WORTH = 3;
export const huntedWorth = (id: CookRecipeId): number => (Object.keys(COOK_RECIPES[id].from).some((item) => HUNTED.has(item as LootId)) ? HUNTED_WORTH : 1);

// A fire to cook at: a hearth indoors, or a campfire (a camp's, or one kindled).
export interface Fire {
  kind: 'hearth' | 'campfire';
  x: number;
  z: number;
}

// A campfire the hero's kindled: where, and how long it has left to burn.
export interface Kindled {
  x: number;
  z: number;
  left: number;
}

export const FIRE_REACH = 1.5; // from a campfire's middle, near enough to cook over it
export const KINDLE_LOGS = 2; // logs a campfire takes (any, birch first)
export const KINDLED_BURNS = 8 * 60; // seconds of play it burns
const LOGS: readonly LootId[] = ['birchLog', 'pineLog', 'oakLog'];

export interface CookingHost {
  readonly hero: Hero;
  readonly inside: { furniture: readonly Furniture[]; below?: unknown; walls?: unknown } | null;
  readonly camps: readonly Camp[];
  readonly yard?: unknown;
  readonly lumber: { readonly chopping: unknown; stop(): void };
  readonly woodworking: { stop(): void };
  readonly fishing: { readonly line: unknown; stop(): void }; // (a line out: reeled in to cook; cast, the cooking stopped)
  readonly work: { readonly shift: unknown };
  isOpenTile(x: number, z: number): boolean; // (ground a fire may be lit on: no water, nothing standing there)
  report(event: GameEvent): void;
}

// Whether the hero stands right before a hearth (on the back wall: the tile before it, close up, along it; a step
// back, and the armchairs facing it are what's in reach).
export function beforeHearth(hearth: Furniture, hero: { x: number; z: number }): boolean {
  const out = hero.z - hearth.z;
  return hero.x >= hearth.x - 0.8 && hero.x <= hearth.x + hearth.w - 0.2 && out >= 0.4 && out <= 1.1;
}

export class Cooking {
  making: { recipe: CookRecipeId; left: number; of: number; t: number } | null = null; // what's cooking, how many more (of how many asked), seconds into the one under way
  kindled: Kindled | null = null; // the campfire the hero's lit, while it burns
  private made = 0; // in all, for each its own roll

  constructor(private readonly host: CookingHost) {}

  // The fire the hero stands by, if any: a hearth before them indoors (on a building's ground floor); outdoors, a
  // camp's fire or their own.
  get fireInReach(): Fire | null {
    const { inside, hero } = this.host;
    if (inside) {
      if (inside.below || inside.walls) return null; // (upstairs, or underground)
      const hearth = inside.furniture.find((f) => f.kind === 'hearth' && beforeHearth(f, hero));
      return hearth ? { kind: 'hearth', x: hearth.x + (hearth.w - 1) / 2, z: hearth.z } : null; // (its middle)
    }
    if (this.host.yard) return null;
    const near = (x: number, z: number) => Math.hypot(x - hero.x, z - hero.z) <= FIRE_REACH;
    if (this.kindled && near(this.kindled.x, this.kindled.z)) return { kind: 'campfire', x: this.kindled.x, z: this.kindled.z };
    const camp = this.host.camps.find((c) => near(c.x, c.z));
    return camp ? { kind: 'campfire', x: camp.x, z: camp.z } : null;
  }

  // Whether the fire in reach will do for a recipe (any, or a hearth for the stews on).
  byFireFor(id: CookRecipeId): boolean {
    const fire = this.fireInReach;
    return !!fire && (!COOK_RECIPES[id].hearth || fire.kind === 'hearth');
  }

  // Whether the skill's reached a recipe (known).
  knows(id: CookRecipeId): boolean {
    return skillOf(this.host.hero, SKILL).level >= COOK_RECIPES[id].needs;
  }

  // How many of a recipe the makings in the bag would make (0: none, or not known yet), wherever they stand.
  canMake(id: CookRecipeId): number {
    if (!this.knows(id)) return 0;
    const { bag } = this.host.hero;
    return Math.min(...Object.entries(COOK_RECIPES[id].from).map(([item, n]) => Math.floor((bag[item as LootId] ?? 0) / n!)));
  }

  // Whether the meal would go in the bag (a stack of it with room, or a slot free: the last of its makings' among them).
  roomFor(id: CookRecipeId): boolean {
    return canSwap(this.host.hero, COOK_RECIPES[id].from, [COOK_RECIPES[id].makes]);
  }

  // `count` of a recipe begun (Infinity: all the makings make); whether it was (known, by a fire it'll do over, the
  // makings for one, room for it), the hero turned to the fire. Chopping, woodworking and a line out stop for it; at work, nothing's
// begun.
  start(id: CookRecipeId, count = 1): boolean {
    if (this.host.work.shift || this.canMake(id) === 0 || count < 1 || !this.roomFor(id) || !this.byFireFor(id)) return false;
    this.host.lumber.stop();
    this.host.woodworking.stop();
    this.host.fishing.stop();
    const fire = this.fireInReach!;
    this.host.hero.facing = Math.atan2(fire.x - this.host.hero.x, fire.z - this.host.hero.z);
    const left = Math.min(count, this.canMake(id));
    this.making = { recipe: id, left, of: left, t: 0 };
    return true;
  }

  stop(): void {
    this.making = null;
  }

  // The campfire they've lit, for a save (none: null); and back from one, while it has a while left to burn (a damaged
  // one's: none).
  saved(): Kindled | null {
    return this.kindled && { ...this.kindled };
  }
  restore(saved: unknown): void {
    const k = (saved && typeof saved === 'object' ? saved : {}) as Partial<Record<keyof Kindled, unknown>>;
    const sound = [k.x, k.z, k.left].every((v) => typeof v === 'number' && Number.isFinite(v)) && (k.left as number) > 0;
    this.kindled = sound ? { x: k.x as number, z: k.z as number, left: Math.min(KINDLED_BURNS, k.left as number) } : null;
  }

  // How far through the one under way (0..1), cooking; else null (its bar).
  get progress(): number | null {
    return this.making ? Math.min(1, this.making.t / COOK_RECIPES[this.making.recipe].seconds) : null;
  }

  // Whether the bag has the makings of a campfire: a bundle of firewood, or two logs.
  get canKindle(): boolean {
    const { bag } = this.host.hero;
    return (bag.firewood ?? 0) > 0 || LOGS.reduce((n, log) => n + (bag[log] ?? 0), 0) >= KINDLE_LOGS;
  }

  // A campfire kindled at the hero's feet, outdoors, of a bundle of firewood from the bag, else two logs (birch first):
  // whether it was (told why not). One at a time: another puts the last out.
  kindle(): boolean {
    const { hero, inside } = this.host;
    if (inside || this.host.yard || this.host.work.shift) return this.host.report({ kind: 'poor', text: 'Kindle a fire outdoors' }), false;
    if (!this.canKindle) return this.host.report({ kind: 'poor', text: `Firewood, or ${KINDLE_LOGS} logs, to kindle a fire` }), false;
    if (!takeFromBag(hero.bag, 'firewood')) for (let i = 0; i < KINDLE_LOGS; i++) takeFromBag(hero.bag, LOGS.find((log) => (hero.bag[log] ?? 0) > 0)!);
    // A little before them, not under their feet; on open ground (a shore's fisher facing the lake: behind them, or
    // beside; nowhere about: at their feet).
    const ahead = 0.8;
    const spots = [0, Math.PI, Math.PI / 2, -Math.PI / 2].map((turn) => ({ x: hero.x + Math.sin(hero.facing + turn) * ahead, z: hero.z + Math.cos(hero.facing + turn) * ahead }));
    const { x, z } = spots.find((p) => this.host.isOpenTile(Math.round(p.x), Math.round(p.z))) ?? hero;
    this.kindled = { x, z, left: KINDLED_BURNS };
    return true;
  }

  // A moment of it: the kindled fire burning down; the cooking stopped by walking off, chopping, a line cast, going to work, or
  // the fire no longer there; else on, one cooked each recipe's seconds.
  update(dt: number, moving: boolean): void {
    if (this.kindled && (this.kindled.left -= dt) <= 0) this.kindled = null;
    const making = this.making;
    if (!making) return;
    if (moving || this.host.lumber.chopping || this.host.fishing.line || this.host.work.shift || !this.byFireFor(making.recipe)) return this.stop();
    if ((making.t += dt) < COOK_RECIPES[making.recipe].seconds) return;
    making.t = 0;
    if (!this.cookOne(making.recipe) || --making.left <= 0) this.stop();
  }

  // One cooked: its makings out of the bag, the meal in (no room, or makings gone: none, stopped, told why), the skill
  // up as its difficulty allows, some of the hero's own experience; told. Whether it was.
  private cookOne(id: CookRecipeId): boolean {
    const recipe = COOK_RECIPES[id];
    const { hero } = this.host;
    if (this.canMake(id) === 0) return false;
    if (!this.roomFor(id)) return this.host.report({ kind: 'poor', text: 'Your bag is full' }), false;
    this.made++;
    for (const [making, n] of Object.entries(recipe.from)) for (let i = 0; i < n!; i++) takeFromBag(hero.bag, making as LootId);
    addToBag(hero.bag, recipe.makes);
    gainXp(hero, HERO_XP);
    this.host.report({ kind: 'crafted', item: recipe.makes });
    practise(hero, SKILL, recipe.needs, hashUnit(this.made, skillOf(hero, SKILL).level, 601), this.host.report, undefined, huntedWorth(id));
    return true;
  }
}

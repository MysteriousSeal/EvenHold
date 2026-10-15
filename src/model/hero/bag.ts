// The hero's bag: how many of each thing they carry, loot (loot/) and gear
// (human/items/) alike. Their ids never clash, so one record holds both.

import { SLOT_NAMES } from '../human/equipment';
import { gearName, rarityOf, slotOfGear, type GearKey, type Rarity } from '../human/items/gear';
import { LOOT, LOOT_QUALITY, type LootId, type LootQuality } from '../loot/loot';
import { MEAL_SECONDS, PROVISIONS, isProvision } from '../loot/provisions';
import { POTIONS, POTION_COOLDOWN, isPotion, type Potion } from '../loot/potions';
import type { Hero } from '../types';
import { maxEnergyOf, maxHpOf } from './attributes';

export type BagItem = LootId | GearKey;
// How an item's name is colored: loot has its quality; gear its rarity (items/gear.ts).
export type Quality = LootQuality | Rarity;

export const isLootItem = (item: BagItem): item is LootId => item in LOOT;
export const nameOf = (item: BagItem): string => (isLootItem(item) ? LOOT[item].name : gearName(item));
export const qualityOf = (item: BagItem): Quality => (isLootItem(item) ? LOOT_QUALITY[item] : rarityOf(item));

// What kind of thing it is ("Junk", "Food", "Head"; the bag's tooltips, what's picked up): loot by its quality (food and drink apart), gear by
// what it's worn on.
const KIND_NAMES: Record<Exclude<LootQuality, 'common'>, string> = { junk: 'Junk', ingredient: 'Crafting material', quest: 'Quest item', bag: 'Bag', potion: 'Potion', tool: 'Tool' };
export function kindOf(item: BagItem): string {
  if (!isLootItem(item)) return SLOT_NAMES[slotOfGear(item)];
  if (isProvision(item)) return PROVISIONS[item].drink ? 'Drink' : 'Food';
  return KIND_NAMES[LOOT_QUALITY[item] as Exclude<LootQuality, 'common'>];
}
export type Bag = Partial<Record<BagItem, number>>;

export function addToBag(bag: Bag, item: BagItem): void {
  bag[item] = (bag[item] ?? 0) + 1;
}

// Takes one `item` out; returns whether there was one.
export function takeFromBag(bag: Bag, item: BagItem): boolean {
  const count = bag[item] ?? 0;
  if (count <= 0) return false;
  if (count === 1) delete bag[item];
  else bag[item] = count - 1;
  return true;
}

// The bag's rows by what things are, in this order (each its own rows, under its title).
export type BagGroup = 'gear' | 'provision' | 'potion' | 'tool' | 'ingredient' | 'quest' | 'bag' | 'junk';
export const BAG_GROUPS: ReadonlyArray<{ group: BagGroup; title: string }> = [
  { group: 'gear', title: 'Gear' },
  { group: 'provision', title: 'Food & drink' },
  { group: 'potion', title: 'Potions' },
  { group: 'tool', title: 'Tools' },
  { group: 'ingredient', title: 'Crafting materials' },
  { group: 'quest', title: 'Quest items' },
  { group: 'bag', title: 'Bags' },
  { group: 'junk', title: 'Junk' },
];
const GROUP_OF: Record<LootQuality, BagGroup> = { common: 'provision', potion: 'potion', tool: 'tool', ingredient: 'ingredient', quest: 'quest', bag: 'bag', junk: 'junk' };
export const groupOf = (item: BagItem): BagGroup => (isLootItem(item) ? GROUP_OF[LOOT_QUALITY[item]] : 'gear');

// Starts eating or drinking one of `item` from the hero's bag, sat down on the ground: food for its share of their
// most health, drink for its share of their most energy, back over a while (getting up stops it: GameModel.ts,
// combatMoves.ts; a blow taken, fighting.ts); whether they did (it's food or drink, carried, and they're not still
// at another).
export function eatOrDrink(hero: Hero, item: BagItem): boolean {
  if (!isProvision(item) || hero.eating || !takeFromBag(hero.bag, item)) return false;
  const { heal = 0, energy = 0, fed } = PROVISIONS[item];
  hero.eating = { heal: heal * maxHpOf(hero), energy: energy * maxEnergyOf(hero), left: MEAL_SECONDS, seconds: MEAL_SECONDS, item, ...(fed && { fed }) }; // (a cook's meal: its blessing once eaten through)
  return true;
}

// A meal from the bag half eaten, as a save keeps it (so a reload neither loses it nor gives it back whole): sound,
// what's left of it; else none. Its blessing, as its food gives (never the save's word).
export function readMeal(hero: Hero, saved: unknown): Hero['eating'] {
  const m = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>;
  const n = (v: unknown, most: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(most, Math.max(0, v)) : NaN);
  const [heal, energy, left] = [n(m.heal, maxHpOf(hero)), n(m.energy ?? 0, maxEnergyOf(hero)), n(m.left, MEAL_SECONDS)];
  if (typeof m.item !== 'string' || !isProvision(m.item) || ![heal, energy, left].every(Number.isFinite) || left <= 0) return null;
  const { fed } = PROVISIONS[m.item];
  return { heal, energy, left, seconds: MEAL_SECONDS, item: m.item, ...(fed && { fed }) };
}

// Why potion `item` can't be drunk just now, if it can't: one drunk too lately, or nothing for it to give back (their
// health, or energy, full already: not wasted); null, it can (or it's none of theirs to drink).
export function potionRefused(hero: Hero, item: BagItem): string | null {
  if (!isPotion(item)) return null;
  if ((hero.potionCooldown ?? 0) > 0) return `Not yet: another potion in ${Math.ceil(hero.potionCooldown!)} s.`;
  const { heal = 0, energy = 0 } = POTIONS[item] as Potion;
  const full = (heal <= 0 || hero.hp >= maxHpOf(hero)) && (energy <= 0 || hero.energy >= maxEnergyOf(hero));
  return full ? (heal > 0 ? "You're already at full health." : 'Your energy is already full.') : null;
}

// Drinks one of potion `item` from the hero's bag, at once (standing, mid-fight): its share of their most health or
// energy back; then none for POTION_COOLDOWN seconds (heroStats.ts recover counts it down); whether they did (a
// potion, carried, none drunk too lately, and something for it to give back: potionRefused).
export function drinkPotion(hero: Hero, item: BagItem): boolean {
  if (!isPotion(item) || potionRefused(hero, item) || !takeFromBag(hero.bag, item)) return false;
  const { heal = 0, energy = 0 } = POTIONS[item] as Potion;
  hero.hp = Math.min(maxHpOf(hero), hero.hp + heal * maxHpOf(hero));
  hero.energy = Math.min(maxEnergyOf(hero), hero.energy + energy * maxEnergyOf(hero));
  hero.potionCooldown = POTION_COOLDOWN;
  return true;
}

// A piece of gear as found: its item (items/*.ts), its level and its rarity, and a roll for its extra lines, all in
// its key ("shortSword@12r348": a short sword, level 12, rare, roll 348), so a bag, a slot, a shop or a save keeps it
// as any item (and two the same stack). A plain id ("shortSword") is a level 1 common one (the starter set, what the
// smith forges plain, what folk in the world wear).
// - Its level: its armour and stats grow with it, and the hero must be that level to wear it.
// - Its rarity: common, uncommon, rare, epic, legendary: each a line more over its own (none, to four), each line a
//   stat (Strength, Agility, Stamina, Endurance) or Armour; from rare up, maybe a special one (crit, dodge, health
//   back over time, pace, life on hit). Worth more the rarer and higher it is.

import type { EquipSlot } from '../equipment';
import type { Stat } from '../../hero/statKinds';
import { STATS, isStat } from '../../hero/statKinds';
import { hashUnit, oneOf } from '../../../util/random';
import { ITEMS, type ItemId } from './index';
import type { WeaponType } from './held';
import { NAMED, namedOf, type NamedId } from './namedGear';

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];
export const RARITY_NAMES: Record<Rarity, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
export const RARITY_COLORS: Record<Rarity, string> = { common: '#e8e2d4', uncommon: '#5ed65e', rare: '#4aa0ff', epic: '#b45cff', legendary: '#ff9a2e' };
const LETTER: Record<Rarity, string> = { common: 'c', uncommon: 'u', rare: 'r', epic: 'e', legendary: 'l' };
const OF_LETTER = Object.fromEntries(RARITIES.map((r) => [LETTER[r], r])) as Record<string, Rarity>;

// The special lines (from rare up): what each does, and what it's called.
export const AFFIXES = ['crit', 'dodge', 'regen', 'speed', 'leech'] as const;
export type Affix = (typeof AFFIXES)[number];

export type GearKey = ItemId | `${ItemId}@${string}`;

export interface Gear {
  item: ItemId;
  level: number;
  rarity: Rarity;
  roll: number;
}

// One line of what a piece gives: its own (`extra` false) or its rarity's.
export interface SpecLine {
  kind: Stat | 'armor' | Affix;
  amount: number;
  extra: boolean;
}

export interface GearSpecs {
  armor: number;
  stats: Record<Stat, number>;
  affixes: Record<Affix, number>; // crit, dodge: chance (0..1); regen: health a 10 seconds; speed, leech: a share (0..1)
  lines: SpecLine[];
}

const KEY = /^([a-zA-Z]+)@(\d+)([curel])(\d+)$/;
const parsed = new Map<string, Gear>();

export const isGear = (key: string): key is GearKey => Object.hasOwn(ITEMS, key) || (KEY.test(key) && Object.hasOwn(ITEMS, key.split('@')[0])); // (own: never a record's `toString`)

// What a key holds (a plain id: level 1, common).
export function gearOf(key: GearKey): Gear {
  let gear = parsed.get(key);
  if (!gear) {
    const m = KEY.exec(key);
    gear = m ? { item: m[1] as ItemId, level: Math.max(1, +m[2]), rarity: OF_LETTER[m[3]], roll: +m[4] } : { item: key as ItemId, level: 1, rarity: 'common', roll: 0 };
    parsed.set(key, gear);
  }
  return gear;
}

// A piece's key (level 1 and common, its plain id).
export const gearKey = ({ item, level, rarity, roll }: Gear): GearKey =>
  level <= 1 && rarity === 'common' ? item : (`${item}@${Math.floor(level)}${LETTER[rarity]}${Math.floor(roll)}` as GearKey);

export const baseOf = (key: GearKey): ItemId => gearOf(key).item;
// What kind of weapon a piece of gear is (held.ts: its item's, whatever its level and rarity), or null: not a weapon.
export const weaponTypeOf = (key: GearKey): WeaponType | null => {
  const item = ITEMS[baseOf(key)] as { type?: WeaponType };
  return item.type ?? null;
};
export const slotOfGear = (key: GearKey): EquipSlot => ITEMS[baseOf(key)].slot;
export const levelOf = (key: GearKey): number => gearOf(key).level;
export const rarityOf = (key: GearKey): Rarity => gearOf(key).rarity;
export const tierOf = (rarity: Rarity): number => RARITIES.indexOf(rarity); // (its extra lines: 0 to 4)

// Its name as shown (a plain one's own; the rest the same: the level and rarity told beside it; a named piece's, its own).
export const gearName = (key: GearKey): string => namedIn(key)?.name ?? ITEMS[baseOf(key)].name;

// The named piece a key holds (namedGear.ts: one of a kind, its name and lines its own), or null.
export const namedIn = (key: GearKey) => namedOf(gearOf(key).item, gearOf(key).roll);
// A named piece's key, at `level` (never rolled: no found piece's roll is its number).
export const namedGear = (id: NamedId, level: number): GearKey => gearKey({ item: NAMED[id].item, level: Math.max(1, Math.floor(level)), rarity: NAMED[id].rarity, roll: id });

// Whether a hero of `level` may wear it.
export const canWear = (key: GearKey, level: number): boolean => levelOf(key) <= level;

const grows = (level: number) => 1 + (level - 1) * 0.12; // its own stats and armour, a level on
const STAT_LINE = (level: number, tier: number) => 1 + Math.floor(level / 4) + (tier - 1); // an extra stat line's
const ARMOR_LINE = (level: number, tier: number) => 1 + Math.floor(level / 3) + tier;
const AFFIX_LINE: Record<Affix, (level: number, tier: number) => number> = {
  crit: (level, tier) => 0.01 * (1 + Math.floor(level / 12) + (tier - 2)),
  dodge: (level, tier) => 0.01 * (1 + Math.floor(level / 12) + (tier - 2)),
  regen: (level, tier) => 1 + Math.floor(level / 8) + (tier - 2),
  speed: (_level, tier) => 0.02 + 0.01 * (tier - 2),
  leech: (_level, tier) => 0.02 + 0.01 * (tier - 2),
};
const SPECIAL_ODDS = 0.35; // an extra line's chance of being a special one (rare and up)
// A set's piece rolls its crit and dodge at half: a whole set worn (the Sunward's, at the top of the loot) would
// otherwise reach their caps a tier early (hero/attributes.ts), and play easier at 16 than at 12.
const SET_EDGE = 0.5;
const edged = (kind: string, amount: number, inSet: boolean): number => (inSet && (kind === 'crit' || kind === 'dodge') ? amount * SET_EDGE : amount);

const specsMade = new Map<string, GearSpecs>();

// Nothing given (an empty slot's).
export const noSpecs = (): GearSpecs => ({
  armor: 0,
  stats: Object.fromEntries(STATS.map((s) => [s, 0])) as Record<Stat, number>,
  affixes: Object.fromEntries(AFFIXES.map((a) => [a, 0])) as Record<Affix, number>,
  lines: [],
});

// What a piece gives, all told: its own armour and stats (grown with its level), then its rarity's lines.
export function gearSpecs(key: GearKey): GearSpecs {
  const made = specsMade.get(key);
  if (made) return made;
  const { item, level, rarity, roll } = gearOf(key);
  const entry = ITEMS[item];
  const specs = noSpecs();
  const add = (kind: SpecLine['kind'], amount: number, extra: boolean) => {
    if (amount <= 0) return;
    if (kind === 'armor') specs.armor += amount;
    else if (isStat(kind)) specs.stats[kind] += amount;
    else specs.affixes[kind as Affix] += amount;
    specs.lines.push({ kind, amount, extra });
  };
  if (entry.armor) add('armor', Math.round(entry.armor * grows(level)), false);
  for (const [stat, n] of Object.entries(entry.stats ?? {})) add(stat as Stat, Math.round(n * grows(level)), false);
  const tier = tierOf(rarity);
  const taken = new Set<string>();
  const fixed = namedOf(item, roll)?.lines; // (a named piece's: listed, not rolled)
  for (const kind of fixed ?? []) add(kind, kind === 'armor' ? ARMOR_LINE(level, tier) : isStat(kind) ? STAT_LINE(level, tier) : edged(kind, AFFIX_LINE[kind as Affix](level, tier), !!entry.set), true);
  for (let i = 0; i < (fixed ? 0 : tier); i++) {
    const pick = (salt: number) => hashUnit(roll, i, 9100 + salt);
    const special = tier >= 2 && pick(1) < SPECIAL_ODDS;
    const pool = (special ? [...AFFIXES] : [...STATS, 'armor' as const]).filter((k) => !taken.has(k));
    const kind = oneOf(pool, pick(2)) ?? STATS.find((s) => !taken.has(s))!;
    taken.add(kind);
    const amount = kind === 'armor' ? ARMOR_LINE(level, tier) : isStat(kind) ? STAT_LINE(level, tier) : edged(kind, AFFIX_LINE[kind as Affix](level, tier), !!entry.set);
    add(kind, amount, true);
  }
  specsMade.set(key, specs);
  return specs;
}

// What it's worth, in copper: its item's (or scrap's), more for each level, much more the rarer.
const RARITY_WORTH: Record<Rarity, number> = { common: 1, uncommon: 1.8, rare: 3, epic: 5, legendary: 9 };
export const gearWorth = (key: GearKey, base: number): number => Math.round(base * (1 + (levelOf(key) - 1) * 0.15) * RARITY_WORTH[rarityOf(key)]);

// A rarity rolled (`u`, 0..1), the odds leaning rarer by `luck` (a boss's, a chest's), at least `least`.
const ODDS: Record<Rarity, number> = { common: 0.6, uncommon: 0.26, rare: 0.1, epic: 0.035, legendary: 0.005 };
export function rollRarity(u: number, luck = 1, least: Rarity = 'common'): Rarity {
  const from = tierOf(least);
  const weights = RARITIES.map((r, i) => (i < from ? 0 : ODDS[r] * (i === 0 ? 1 : luck ** i)));
  let left = u * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < RARITIES.length; i++) if ((left -= weights[i]) < 0) return RARITIES[i];
  return RARITIES[from];
}

// Whether `item` is found at `level` (items.ts `level`: some never lower).
export const foundAt = (item: ItemId, level: number): boolean => (ITEMS[item].level ?? 1) <= level;

// A piece of `item` found at `level`, its rarity and roll from `rng` (never under its own least level and rarity).
export function rollGear(item: ItemId, level: number, rng: () => number, luck = 1, least: Rarity = 'common'): GearKey {
  const { level: low = 1, rarity: plainest = 'common' } = ITEMS[item];
  const floor = tierOf(plainest) > tierOf(least) ? plainest : least;
  return gearKey({ item, level: Math.max(1, low, Math.floor(level)), rarity: rollRarity(rng(), luck, floor), roll: Math.floor(rng() * 1000) });
}

// What a piece is worth, all told: its armour and its stats together (at its level and rarity).
export const gearPower = (key: GearKey): number => {
  const { armor, stats } = gearSpecs(key);
  return armor + Object.values(stats).reduce((a, b) => a + b, 0);
};

// Whether `key` would be worth wearing over what's worn in its slot (and the hero's of its level): nothing worn
// there, or less.
export const betterThanWorn = (key: GearKey, hero: { level: number; equipment: Partial<Record<EquipSlot, GearKey>> }): boolean => {
  const worn = hero.equipment[slotOfGear(key)];
  return canWear(key, hero.level) && (!worn || gearPower(key) > gearPower(worn));
};

// What the hero wears, worn down by use: a weapon a little by every blow it lands, what they wear against blows (a
// shield too) by every one that hurts them, everything worn a good deal more by a fall (setbacks.ts). Each piece's
// wear (0 to BROKEN) kept by the piece (its key: one of a kind worn, its wear its own); badly worn (WORN), told once;
// broken, told, and it gives nothing (no armour, no stats: attributes.ts) till a smith mends it, for coin, the more
// the dearer the piece and the more it's worn (smithy panel: Mend). Jewellery never wears. Kept in the save.

import { ARMOR_SLOTS, HELD_SLOTS, ITEMS, type EquipSlot } from '../human/equipment';
import { baseOf, gearName, gearWorth, isGear, type GearKey } from '../human/items/gear';
import type { GameEvent, Hero } from '../types';

export const BROKEN = 100;
export const WORN = 75; // badly worn from here: told
const BLOW = 0.4; // a blow landed, on the weapon (250 to break it)
const HARM = 0.12; // a point of harm taken, on each piece worn against blows
const FALL = 12; // a fall, on everything that wears
const MEND_SHARE = 0.35; // of what a piece costs at a smith, mending it from broken (less, less worn)
const NO_PRICE = 20; // copper, what a piece no smith sells is priced at (smithy/smithShop.ts gearPrice's)

type Wearer = Pick<Hero, 'equipment'> & { wear?: Record<string, number>; bag?: Hero['bag'] };
const GUARDING: readonly EquipSlot[] = [...ARMOR_SLOTS, 'offHand'];
const WEARING: readonly EquipSlot[] = [...ARMOR_SLOTS, ...HELD_SLOTS];

export const wearOf = (hero: Wearer, key: string): number => hero.wear?.[key] ?? 0;
export const isBroken = (hero: Wearer, key: string): boolean => wearOf(hero, key) >= BROKEN;
// What's worn that's broken, as one string (what the hero wears adds up again only as it changes: attributes.ts).
export const brokenKey = (hero: Wearer): string => (hero.wear ? Object.values(hero.equipment).filter((k) => k && isBroken(hero, k)).join('|') : '');

// The pieces in `slots` worn down by `by`; told as one goes badly worn, or breaks.
function wearDown(hero: Wearer, slots: readonly EquipSlot[], by: number, report: (e: GameEvent) => void): void {
  for (const slot of slots) {
    const key = hero.equipment[slot];
    if (!key || !isGear(key)) continue;
    const was = wearOf(hero, key);
    if (was >= BROKEN) continue;
    const now = Math.min(BROKEN, was + by);
    (hero.wear ??= {})[key] = Math.round(now * 100) / 100;
    if (now >= BROKEN) report({ kind: 'poor', text: `Your ${gearName(key)} has broken · a smith can mend it` });
    else if (was < WORN && now >= WORN) report({ kind: 'poor', text: `Your ${gearName(key)} is badly worn` });
  }
}

export const wearOnBlow = (hero: Wearer, report: (e: GameEvent) => void): void => wearDown(hero, ['mainHand'], BLOW, report);
export const wearOnHarm = (hero: Wearer, harm: number, report: (e: GameEvent) => void): void => void (harm > 0 && wearDown(hero, GUARDING, harm * HARM, report));
export const wearOnFall = (hero: Wearer, report: (e: GameEvent) => void): void => wearDown(hero, WEARING, FALL, report);

// What mending a piece costs (none: unworn), in copper.
export function mendCost(hero: Wearer, key: string): number {
  const wear = wearOf(hero, key);
  if (wear <= 0 || !isGear(key)) return 0;
  return Math.max(1, Math.ceil(gearWorth(key as GearKey, ITEMS[baseOf(key as GearKey)].value ?? NO_PRICE) * MEND_SHARE * (wear / BROKEN)));
}

// What they wear (or carry, taken off worn) that's worn at all, each with its mending's cost; all of it.
export function mendBill(hero: Wearer): { pieces: Array<{ key: GearKey; wear: number; cost: number }>; total: number } {
  const held = new Set([...WEARING.map((slot) => hero.equipment[slot]), ...Object.keys(hero.bag ?? {})]);
  const pieces = [...held].filter((k): k is GearKey => !!k && isGear(k) && wearOf(hero, k) > 0).map((key) => ({ key, wear: wearOf(hero, key), cost: mendCost(hero, key) }));
  return { pieces, total: pieces.reduce((n, p) => n + p.cost, 0) };
}

// Everything they wear mended, paid for: 'mended', 'none' (nothing worn), 'too poor'.
export function mendAll(hero: Wearer & Pick<Hero, 'money'>): 'mended' | 'none' | 'too poor' {
  const { pieces, total } = mendBill(hero);
  if (!pieces.length) return 'none';
  if (hero.money < total) return 'too poor';
  hero.money -= total;
  for (const { key } of pieces) delete hero.wear![key];
  return 'mended';
}

// A piece's wear forgotten once the hero holds none of it (sold, given up): one like it got again comes whole.
export function wearGone(hero: Wearer, key: string): void {
  if (hero.wear?.[key] === undefined || (hero.bag?.[key as keyof Hero['bag']] ?? 0) > 0 || Object.values(hero.equipment).includes(key as GearKey)) return;
  delete hero.wear[key];
}

// A piece's wear as its tooltip tells it: nothing unworn; "Worn 40%"; badly worn; broken.
export function wearText(hero: Wearer, key: string): { text: string; bad: boolean } | null {
  const wear = wearOf(hero, key);
  if (wear < 1) return null;
  if (wear >= BROKEN) return { text: 'Broken · gives nothing till a smith mends it', bad: true };
  return { text: `${wear >= WORN ? 'Badly worn' : 'Worn'} ${Math.floor(wear)}%`, bad: wear >= WORN };
}

// Wear read back from a save (anything unsound left out).
export function readWear(saved: unknown): Record<string, number> {
  const wear: Record<string, number> = {};
  if (!saved || typeof saved !== 'object') return wear;
  for (const [key, n] of Object.entries(saved as Record<string, unknown>)) if (isGear(key) && typeof n === 'number' && Number.isFinite(n) && n > 0) wear[key] = Math.min(BROKEN, n);
  return wear;
}

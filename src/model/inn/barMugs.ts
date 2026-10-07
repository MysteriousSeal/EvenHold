// The drinks on an inn's bar, one to a stool's row: a full tankard before
// whoever's sat there drinking (a villager, or the hero), or a glass of
// wine, and the empty cup they leave. Empty ones stay till the barkeep clears them, a few of her
// rounds on (innStaff.ts). Kept per inn while the world runs (not saved:
// a fresh bar on a reload).

import type { Entrance } from '../interiors/interiors';
import type { Drink } from '../npcs/npcs';
import { kept } from '../../util/kept';

export interface BarMug {
  z: number; // the stool's row
  full: boolean;
  drink: Drink; // a tankard (ale) or a glass (wine)
  wait: number; // her rounds still to go before she'll come for it (empty)
}

const bars = kept<Entrance, BarMug[]>();

// The mugs on an inn's bar.
export const mugsAt = (inn: Entrance): BarMug[] => bars(inn, () => []);

// Sets a drink down at a row (replacing whatever was there): full, or the
// empty mug left (to be cleared `wait` of her rounds on).
export function setMug(inn: Entrance, z: number, full: boolean, wait = 3, drink: Drink = 'ale'): void {
  const mugs = mugsAt(inn);
  const at = mugs.findIndex((m) => m.z === z);
  const mug = { z, full, wait, drink };
  if (at >= 0) mugs[at] = mug;
  else mugs.push(mug);
}

// Takes the drink at a row off the bar (picked up); returns it, or null if there was none.
export function takeMug(inn: Entrance, z: number): BarMug | null {
  const mugs = mugsAt(inn);
  const at = mugs.findIndex((m) => m.z === z);
  return at >= 0 ? mugs.splice(at, 1)[0] : null;
}

// One of her rounds gone by: an empty mug ready to clear, if any (the one waited longest).
export function roundOnBar(inn: Entrance): BarMug | null {
  const empties = mugsAt(inn).filter((m) => !m.full);
  for (const m of empties) m.wait--;
  return empties.filter((m) => m.wait <= 0).sort((a, b) => a.wait - b.wait)[0] ?? null;
}

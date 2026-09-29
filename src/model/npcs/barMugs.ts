// The drinks on an inn's bar, one to a stool's row: a full tankard before
// whoever's sat there drinking (a villager, or the hero), and the empty mug
// they leave. Empty ones stay till the barkeep clears them, a few of her
// rounds on (innStaff.ts). Kept per inn while the world runs (not saved:
// a fresh bar on a reload).

import type { Entrance } from '../interiors/interiors';

export interface BarMug {
  z: number; // the stool's row
  full: boolean;
  wait: number; // her rounds still to go before she'll come for it (empty)
}

const bars = new WeakMap<Entrance, BarMug[]>();

// The mugs on an inn's bar.
export function mugsAt(inn: Entrance): BarMug[] {
  let mugs = bars.get(inn);
  if (!mugs) bars.set(inn, (mugs = []));
  return mugs;
}

// Sets a drink down at a row (replacing whatever was there): full, or the
// empty mug left (to be cleared `wait` of her rounds on).
export function setMug(inn: Entrance, z: number, full: boolean, wait = 3): void {
  const mugs = mugsAt(inn);
  const at = mugs.findIndex((m) => m.z === z);
  const mug = { z, full, wait };
  if (at >= 0) mugs[at] = mug;
  else mugs.push(mug);
}

// Takes the drink at a row off the bar (picked up); returns whether there was one.
export function takeMug(inn: Entrance, z: number): boolean {
  const mugs = mugsAt(inn);
  const at = mugs.findIndex((m) => m.z === z);
  if (at >= 0) mugs.splice(at, 1);
  return at >= 0;
}

// One of her rounds gone by: an empty mug ready to clear, if any (the one waited longest).
export function roundOnBar(inn: Entrance): BarMug | null {
  const empties = mugsAt(inn).filter((m) => !m.full);
  for (const m of empties) m.wait--;
  return empties.filter((m) => m.wait <= 0).sort((a, b) => a.wait - b.wait)[0] ?? null;
}

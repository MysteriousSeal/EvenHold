// What each stat does, in words (their effects: model/hero/attributes.ts):
// on the hero sheet's tooltips, and in the level-up window.

import type { Stat } from '../../model/hero/statKinds';

export const STAT_DOES: Record<Stat, string> = {
  strength: 'Harder blows: +1 damage for every 3',
  agility: 'A 1% chance a point to dodge a blow, and to land a critical one (double damage)',
  stamina: '+2 health a point',
  endurance: '+5 energy a point, and slower to tire',
};

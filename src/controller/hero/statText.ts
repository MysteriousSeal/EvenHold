// What each stat does, in words (their effects: model/hero/attributes.ts):
// on the hero sheet's tooltips, and in the level-up window.

import type { Stat } from '../../model/hero/statKinds';

export const STAT_DOES: Record<Stat, string> = {
  strength: 'Harder blows: +4% damage a point (gear\'s: +1 for every 4)',
  agility: 'A 1% chance a point to dodge a blow, and to land a critical one (double damage); gear gives 15% at most',
  stamina: '+3% health and 1% less of each blow taken a point, 25% at most (gear\'s: +2 health a point)',
  endurance: '+5 energy a point, and slower to tire',
};

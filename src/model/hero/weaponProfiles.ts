// How each kind of weapon fights in the hero's hand (none: fists): how long a blow takes (a dagger's quick, a war
// hammer's slow), how hard it lands for it (about as much harm a second, whatever the kind: the slow ones each blow
// the harder), how far it reaches (a spear's a step past a sword's, a dagger's short) and how wide it sweeps (a
// spear's thrust narrow, an axe's or a staff's swing wide, catching a second foe beside the first for a share of it;
// a sword's the parrying blade, its riposte the harder),
// the breath a blow takes, and how much it counts toward knocking a steady foe out of its own (enemies/poise.ts: a
// hammer's or a mace's blow as two, a dagger's as half). Told on the weapon (controller/hero/gearLines.ts).

import { isGear, weaponTypeOf, type GearKey } from '../human/items/gear';
import type { WeaponType } from '../human/items/held';
import type { Hero } from '../types';

export interface WeaponProfile {
  time: number; // a blow's length, times a sword's
  harm: number; // its harm, times a sword's
  reach: number; // tiles past a sword's
  arc: number; // degrees either side of the way they face it lands on
  breath: number; // a blow's
  poise: number; // blows it counts as, toward a steady foe's flinching
  sweep?: number; // a second foe in its arc: struck too, for this share
  riposte?: number; // a blow on a foe just parried, times (none said: hero/combatMoves.ts RIPOSTE_FACTOR)
}

export type Wielded = WeaponType | 'fists';

export const WEAPON_PROFILES: Readonly<Record<Wielded, WeaponProfile>> = {
  fists: { time: 1, harm: 1, reach: 0, arc: 70, breath: 12, poise: 1 }, // (bare-handed, as every blow was: a new hero's)
  dagger: { time: 0.72, harm: 0.72, reach: -0.15, arc: 55, breath: 8, poise: 0.5 },
  sword: { time: 1, harm: 1, reach: 0, arc: 70, breath: 12, poise: 1, riposte: 2.5 },
  axe: { time: 1, harm: 1, reach: -0.05, arc: 80, breath: 12, poise: 1, sweep: 0.5 },
  club: { time: 1.05, harm: 1.05, reach: -0.05, arc: 70, breath: 13, poise: 1.5 },
  mace: { time: 1.15, harm: 1.15, reach: -0.05, arc: 65, breath: 15, poise: 1.5 },
  hammer: { time: 1.4, harm: 1.4, reach: 0.05, arc: 60, breath: 20, poise: 2 },
  spear: { time: 1.05, harm: 0.95, reach: 0.45, arc: 30, breath: 12, poise: 1 },
  staff: { time: 0.9, harm: 0.85, reach: 0.3, arc: 85, breath: 10, poise: 1, sweep: 0.4 },
};

// What the hero has in hand (fists: nothing, or nothing that's a weapon).
export function wieldedOf(hero: Pick<Hero, 'equipment'>): Wielded {
  const key = hero.equipment.mainHand;
  return (key && isGear(key) && weaponTypeOf(key as GearKey)) || 'fists';
}

export const profileOf = (hero: Pick<Hero, 'equipment'>): WeaponProfile => WEAPON_PROFILES[wieldedOf(hero)];

// A weapon's kind, told in a few words (its tooltip): quick or slow, long or short, wide or narrow, light or heavy on
// breath, and what it does to a steady foe.
export function profileText(type: WeaponType): string {
  const p = WEAPON_PROFILES[type];
  const words = [
    p.time <= 0.8 ? 'Quick' : p.time >= 1.3 ? 'Slow, crushing' : p.time > 1.05 ? 'Heavy' : 'Even',
    p.reach >= 0.4 ? 'long reach' : p.reach >= 0.2 ? 'reaching' : p.reach <= -0.1 ? 'short reach' : null,
    p.arc <= 40 ? 'a narrow thrust' : p.sweep ? 'sweeps a second foe' : null,
    p.riposte ? 'a deadly riposte' : null,
    p.breath <= 10 ? 'light on breath' : p.breath >= 18 ? 'hard on breath' : null,
    p.poise >= 2 ? 'staggers the steady' : p.poise > 1 ? 'shakes the steady' : p.poise < 1 ? 'hardly shakes anyone' : null,
  ];
  return words.filter(Boolean).join(' · ');
}

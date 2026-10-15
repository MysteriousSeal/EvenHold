// How a blow lands, felt (model/hero/fighting.ts tells it): the world held still a few hundredths of a second (longer
// a critical one, longer a kill, longest a riposte on a foe just parried; the hero struck, a short one of theirs), by
// the weapon's weight (a dagger's quick blow the shorter, a hammer's the longer: its length, weaponProfiles.ts); and
// the camera kicked, by the harm done and how hard the weapon shakes a foe (its poise: a hammer's hard, a dagger's
// barely), never past MAX_SHAKE.

import { WEAPON_PROFILES } from '../model/hero/weaponProfiles';
import type { GameEvent } from '../model/types';

export const HIT_STOP = { hit: 0.04, crit: 0.075, kill: 0.1, riposte: 0.12, parry: 0.09, struck: 0.03 }; // seconds held still (a sword's; a parry's: GameController)
const MOST_STOP = 0.15; // seconds, at the most (a hammer's riposte: no longer than this)
export const MAX_SHAKE = 0.06; // world units the camera's kicked, at the most (a few pixels: felt, never swimming)
const SHAKE = { least: 0.008, byHarm: 0.024 }; // a sword's kick: the least, and the more by the share of its health a blow took (full by two-thirds)
const FIERCE = 1.3; // a critical blow's, or a kill's, kick the harder

// How long the world's held still and how hard the camera's kicked, for a hit.
export function hitFeel(event: Extract<GameEvent, { kind: 'hit' }>): { stop: number; shake: number } {
  const harm = SHAKE.least + SHAKE.byHarm * Math.min(1, (event.share ?? 0) * 1.5);
  if (event.on === 'hero') return { stop: HIT_STOP.struck, shake: Math.min(MAX_SHAKE, harm * FIERCE) };
  const weapon = WEAPON_PROFILES[event.weapon ?? 'sword']; // (a spell's: as a sword's)
  const base = Math.max(event.riposte ? HIT_STOP.riposte : 0, event.killed ? HIT_STOP.kill : 0, event.crit ? HIT_STOP.crit : 0, HIT_STOP.hit);
  return { stop: Math.min(MOST_STOP, base * weapon.time), shake: Math.min(MAX_SHAKE, harm * weapon.poise * (event.crit || event.killed ? FIERCE : 1)) };
}

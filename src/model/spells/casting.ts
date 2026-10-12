// A spell cast (spells.ts): at the foe the hero's focused on, if it's in range; none focused, at the nearest in range
// ahead of them. Known, its wait over, a foe to cast at and the Breath for it: the Breath spent, the hero turned to
// the foe, the harm done (hero/fighting.ts strike: as a blow's, the foe's death and what it leaves the same), told
// ('cast': for the view), and its wait begun.
import { strike, type Fight } from '../hero/fighting';
import { blowOf } from '../hero/attributes';
import { blowDamage } from '../hero/blessing';
import type { Enemy } from '../types';
import { SPELLS, knows, waitOf, type SpellId } from './spells';

export interface Caster extends Fight {
  readonly moves: Fight['moves'] & { spend(amount: number): boolean; readonly breath: number };
}

export type CastResult = 'cast' | 'unknown' | 'waiting' | 'noFoe' | 'breath';
const AHEAD = 0.3; // how squarely before the hero an unfocused foe must stand (the cosine of the angle, at least)

// Who `id` would be cast at now, if anyone.
export function castTarget(caster: Pick<Fight, 'hero' | 'foes' | 'focused'>, id: SpellId): Enemy | null {
  const { hero, focused } = caster;
  const { range } = SPELLS[id];
  const far = (e: Enemy) => Math.hypot(e.x - hero.x, e.z - hero.z);
  if (focused && focused.state !== 'dead') return far(focused) <= range ? focused : null;
  const ahead = (e: Enemy) => ((e.x - hero.x) * Math.sin(hero.facing) + (e.z - hero.z) * Math.cos(hero.facing)) / Math.max(far(e), 1e-6) >= AHEAD;
  return caster.foes.filter((e) => e.state !== 'dead' && far(e) <= range && ahead(e)).sort((a, b) => far(a) - far(b))[0] ?? null;
}

export function castSpell(caster: Caster, id: SpellId): CastResult {
  const { hero } = caster;
  const spell = SPELLS[id];
  if (!knows(hero, id)) return 'unknown';
  if (waitOf(hero, id) > 0) return 'waiting';
  const target = castTarget(caster, id);
  if (!target) return 'noFoe';
  if (!caster.moves.spend(spell.breath)) return 'breath';
  hero.spellWait = { ...hero.spellWait, [id]: spell.cooldown };
  hero.facing = Math.atan2(target.x - hero.x, target.z - hero.z);
  caster.report({ kind: 'cast', spell: id, x: target.x, y: target.y, z: target.z });
  strike(caster, target, blowDamage(hero, blowOf(hero)) * spell.harm, false);
  return 'cast';
}

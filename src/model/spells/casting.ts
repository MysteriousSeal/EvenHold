// A spell cast (spells.ts), at whom its kind allows. One for foes only: at the foe the hero's focused on, if it's in
// range; none focused, at the nearest in range ahead of them; never at anyone picked out who's no foe. One for
// anyone: at whoever the hero has picked out, foe or not (hero/selection.ts), in range; no one, at themselves.
// Known, its wait over, someone to cast at and the Breath for it: the Breath spent, the hero turned to them, what it
// does done (harm: hero/fighting.ts strike, as a blow's, the foe's death and what it leaves the same; mending: health
// back, never past whole), told ('cast': for the view), and its wait begun.
import { strike, type Fight } from '../hero/fighting';
import { blowOf, maxHpOf } from '../hero/attributes';
import { blowDamage } from '../hero/blessing';
import { healthOf, type Person } from '../hero/selection';
import type { MapSize } from '../map/grid';
import type { Enemy } from '../types';
import { mayTurn, type Chickens } from './turned';
import { maySwap, whyNoSwap, type Swaps } from './swaps';
import { SPELLS, knows, waitOf, type SpellId } from './spells';

export interface Caster extends Fight {
  readonly moves: Fight['moves'] & { spend(amount: number): boolean; readonly breath: number };
  readonly chosen?: { readonly person: Person | null }; // whoever's picked out, no foe
  readonly size: MapSize;
  readonly chickens?: Pick<Chickens, 'turn' | 'may'> & Partial<Pick<Chickens, 'whyNot'>>;
  readonly swaps?: Pick<Swaps, 'swap'>;
}

// Someone no foe, as what a mending mends: their health as it stands (whole, till said otherwise).
function personBody(person: Person, size: MapSize): { one: { hp: number }; max: number } {
  const { hp, max } = healthOf(person, size);
  person.hp = hp;
  return { one: person as Person & { hp: number }, max };
}

export type CastResult = 'cast' | 'unknown' | 'waiting' | 'noTarget' | 'breath';
export type CastAt = { foe: Enemy } | { person: Person } | { self: true };
const AHEAD = 0.3; // how squarely before the hero an unfocused foe must stand (the cosine of the angle, at least)

// Who `id` would be cast at now, if anyone.
export function castTarget(caster: Pick<Caster, 'hero' | 'foes' | 'focused' | 'chosen'>, id: SpellId): CastAt | null {
  const { hero, focused } = caster;
  const { range, aim } = SPELLS[id];
  const far = (e: { x: number; z: number }) => Math.hypot(e.x - hero.x, e.z - hero.z);
  if (focused && focused.state !== 'dead') return far(focused) <= range ? { foe: focused } : null;
  if (aim === 'anyone') {
    const person = caster.chosen?.person;
    return person ? (far(person) <= range ? { person } : null) : SPELLS[id].needsTarget ? null : { self: true };
  }
  const ahead = (e: Enemy) => ((e.x - hero.x) * Math.sin(hero.facing) + (e.z - hero.z) * Math.cos(hero.facing)) / Math.max(far(e), 1e-6) >= AHEAD;
  const foe = caster.foes.filter((e) => e.state !== 'dead' && far(e) <= range && ahead(e)).sort((a, b) => far(a) - far(b))[0];
  return foe ? { foe } : null;
}

export function castSpell(caster: Caster, id: SpellId): CastResult {
  const { hero } = caster;
  const spell = SPELLS[id];
  if (!knows(hero, id)) return 'unknown';
  if (waitOf(hero, id) > 0) return 'waiting';
  const at = castTarget(caster, id);
  // (A charm that turns them, where it can't here: said why, so it's not a key pressed and nothing.)
  // (And the one that changes their sex, at what has no such body: a beast.)
  const why = !at || 'self' in at ? null : spell.turns ? caster.chickens?.whyNot?.('foe' in at ? at.foe : at.person, spell.turns) : spell.swaps ? whyNoSwap('foe' in at ? at.foe : at.person) : null;
  if (why) caster.report({ kind: 'banner', title: spell.name, line: why });
  if (!at || (spell.swaps && ('self' in at || !maySwap('foe' in at ? at.foe : at.person))) || (spell.turns && ('self' in at || !(caster.chickens ? caster.chickens.may('foe' in at ? at.foe : at.person, spell.turns) : mayTurn('foe' in at ? at.foe : at.person))))) return 'noTarget'; // (a boss: not to be turned)
  if (!caster.moves.spend(spell.breath)) return 'breath';
  hero.spellWait = { ...hero.spellWait, [id]: spell.cooldown };
  const whom = 'foe' in at ? at.foe : 'person' in at ? at.person : hero;
  if (whom !== hero) hero.facing = Math.atan2(whom.x - hero.x, whom.z - hero.z);
  // Mending: of their whole health, never past whole.
  const body: { one: { hp: number }; max: number } = 'foe' in at ? { one: at.foe, max: at.foe.maxHp } : 'self' in at ? { one: hero, max: maxHpOf(hero) } : personBody(at.person, caster.size);
  const mended = spell.heal ? Math.max(0, Math.min(Math.ceil(body.max - body.one.hp), Math.round(body.max * spell.heal))) : 0;
  if (mended > 0) body.one.hp = Math.min(body.max, body.one.hp + mended);
  caster.report({ kind: 'cast', spell: id, x: whom.x, y: whom.y, z: whom.z, ...(spell.heal ? { mended } : {}) });
  if (spell.swaps && !('self' in at)) caster.swaps?.swap('foe' in at ? at.foe : at.person);
  if (spell.turns && !('self' in at)) caster.chickens?.turn('foe' in at ? at.foe : at.person, spell.turns);
  if (spell.harm && 'foe' in at) strike(caster, at.foe, blowDamage(hero, blowOf(hero)) * spell.harm, false);
  return 'cast';
}

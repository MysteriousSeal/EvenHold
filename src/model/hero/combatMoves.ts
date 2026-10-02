// The hero's moves in a fight: the blow (Space), landing partway through; a roll (Shift) that carries
// them a few tiles, untouchable for most of it, out of a foe's marked
// ground; a guard (hold Q) that cuts the blows it takes, and, raised just as
// one lands, parries it: no harm, the foe staggered, its next blow from the
// hero a critical one. Each spends Breath, a short-term bar under health:
// a blow, a roll, a blow blocked, each takes some; it refills a moment after,
// slower behind a raised guard; tired (energy low: heroStats.ts), it holds
// less and refills slower. Short of a blow's or a roll's breath, neither;
// short of a block's, the guard breaks.

import type { ItemId } from '../human/equipment';
import type { Enemy, Hero } from '../types';
import { TIRED } from './heroStats';
import { ATTACK_DURATION, ATTACK_STRIKE } from '../constants';

export const BREATH = 100; // the most, rested
export const TIRED_BREATH = 60; // the most, tired
const REFILL = 45; // a second, once it's begun refilling
const TIRED_REFILL = 0.5; // (how much slower, tired)
const GUARD_REFILL = 0.35; // (and behind a raised guard)
const PAUSE = 0.6; // seconds after it's spent before it refills
export const COST = { blow: 12, roll: 28 };
const BLOCK_COST = 8; // a blow blocked: this, and 1.5 a point of its harm
const BLOCK_COST_PER = 1.5;

export const GUARD_PACE = 0.5; // a walk behind a raised guard, as a share of one

export const ROLL_TIME = 0.45; // seconds a roll lasts
export const ROLL_SAFE = 0.32; // seconds of it nothing touches the hero
export const ROLL_REACH = 2.4; // tiles it carries them

export const PARRY = 0.18; // seconds after the guard's raised that a blow landing is parried
const KEEN_PARRY = 0.3; // with what's made for it: a buckler, a parrying dagger
const KEEN: ReadonlySet<ItemId> = new Set(['buckler', 'parryingDagger']);
export const STAGGER = 0.9; // seconds a parried foe reels (its blow and any told move lost)
const RIPOSTE = 1.5; // seconds the hero has to strike it, critically
export const RIPOSTE_FACTOR = 2; // that blow's harm, times

// How much of a blow the guard takes off, by what's in the off hand: bare-handed (or a torch, a book) half;
// a buckler more; a shield most; a great wall of one, all.
const GUARDS: Partial<Record<ItemId, number>> = { buckler: 0.7, plankShield: 0.85, heaterShield: 0.85, crestShield: 0.85, bronzeTarge: 0.85, pavise: 0.95, towerShield: 1 };
export const guardOf = (offHand: ItemId | undefined): number => (offHand && GUARDS[offHand]) || 0.5;
export const parryWindow = (offHand: ItemId | undefined): number => (offHand && KEEN.has(offHand) ? KEEN_PARRY : PARRY);

// What became of a blow aimed at the hero.
export type Guarded = 'rolled' | 'parried' | 'blocked' | 'broken' | 'taken';

export class CombatMoves {
  breath = BREATH;
  roll: { dx: number; dz: number; t: number } | null = null; // under way: its way (a unit vector), seconds into it
  guard: number | null = null; // raised: seconds since; else null
  private riposte: { foe: Enemy; left: number } | null = null; // a foe just parried, open to a critical blow
  private blow: { t: number; landed: boolean } | null = null; // a blow under way: seconds into it, whether it's landed (once)
  private wait = 0; // seconds before breath refills

  constructor(private readonly hero: Hero) {}

  // The most breath the hero has now (less, tired).
  get most(): number {
    return this.hero.energy < TIRED ? TIRED_BREATH : BREATH;
  }

  // Spends `amount`; false (none spent) if there isn't that much.
  spend(amount: number): boolean {
    if (this.breath < amount) return false;
    this.breath -= amount;
    this.wait = PAUSE;
    return true;
  }

  // Starts a blow (not mid-blow or mid-roll, breath to spend), the guard lowered; whether it did.
  startBlow(): boolean {
    if (this.blow || this.roll || !this.spend(COST.blow)) return false;
    this.blow = { t: 0, landed: false };
    this.guard = null;
    return true;
  }

  // How far through the blow they are, 0..1, or null.
  get blowProgress(): number | null {
    return this.blow ? Math.min(1, this.blow.t / ATTACK_DURATION) : null;
  }

  // Rolls along (dirX, dirZ) (still: backwards, away from `facing`); whether they did (not mid-blow or mid-roll,
  // breath to spend).
  startRoll(dirX: number, dirZ: number, facing: number): boolean {
    if (this.blow || this.roll || !this.spend(COST.roll)) return false;
    const len = Math.hypot(dirX, dirZ);
    const [dx, dz] = len > 1e-6 ? [dirX / len, dirZ / len] : [-Math.sin(facing), -Math.cos(facing)];
    this.roll = { dx, dz, t: 0 };
    this.guard = null; // (a guard dropped to roll)
    return true;
  }

  // The guard raised (held) or lowered; not mid-blow or mid-roll.
  raise(on: boolean): void {
    if (!on || this.roll || this.blow) this.guard = null;
    else this.guard ??= 0;
  }

  // Whether nothing can touch the hero now (early in a roll).
  get untouchable(): boolean {
    return !!this.roll && this.roll.t < ROLL_SAFE;
  }

  // How far through the roll they are, 0..1, or null.
  get rollProgress(): number | null {
    return this.roll ? Math.min(1, this.roll.t / ROLL_TIME) : null;
  }

  // A moment on: breath refilling, the guard held, a riposte's chance passing, a blow landing partway through
  // (`land`: on whoever's in reach; none, where there's no one to hit, the swing just playing out), the roll
  // carrying them (`slide`: a step, with what's in the way in it).
  update(dt: number, slide: (dx: number, dz: number) => void, land: (() => void) | null): void {
    const blow = this.blow;
    if (blow) {
      blow.t += dt;
      if (!blow.landed && blow.t >= ATTACK_STRIKE * ATTACK_DURATION) [blow.landed] = [true, land?.()];
      if (blow.t >= ATTACK_DURATION) this.blow = null;
    }
    if (this.wait > 0) this.wait = Math.max(0, this.wait - dt);
    else this.breath += REFILL * (this.hero.energy < TIRED ? TIRED_REFILL : 1) * (this.guard !== null ? GUARD_REFILL : 1) * dt;
    this.breath = Math.min(this.most, this.breath);
    if (this.guard !== null) this.guard += dt;
    if (this.riposte && (this.riposte.left -= dt) <= 0) this.riposte = null;
    const roll = this.roll;
    if (!roll) return;
    const at = (t: number) => 1 - (1 - Math.min(1, t / ROLL_TIME)) ** 2; // (fast, easing out)
    const step = (at(roll.t + dt) - at(roll.t)) * ROLL_REACH;
    roll.t += dt;
    const steps = Math.max(1, Math.ceil(step / 0.2));
    for (let i = 0; i < steps; i++) slide((roll.dx * step) / steps, (roll.dz * step) / steps);
    if (roll.t >= ROLL_TIME) this.roll = null;
  }

  // A blow of `damage` aimed at the hero (by `by`, if someone): rolled through (none), parried (none; the foe
  // staggered, open to a riposte), blocked (cut by the guard, breath spent), the guard broken (no breath left to
  // block: all of it, the guard lowered), or taken; what's left of it.
  struck(damage: number, by: Enemy | null): { damage: number; guarded: Guarded } {
    if (this.untouchable) return { damage: 0, guarded: 'rolled' };
    if (this.guard === null) return { damage, guarded: 'taken' };
    const offHand = this.hero.equipment.offHand;
    if (this.guard <= parryWindow(offHand)) {
      if (by) {
        Object.assign(by, { swingFor: null, hurtFor: STAGGER }); // (reeling: its blow, and any move it was telling, lost)
        this.riposte = { foe: by, left: RIPOSTE };
      }
      return { damage: 0, guarded: 'parried' };
    }
    const cost = BLOCK_COST + damage * BLOCK_COST_PER;
    if (this.breath < cost) {
      [this.breath, this.guard, this.wait] = [0, null, PAUSE];
      return { damage, guarded: 'broken' };
    }
    this.spend(cost);
    return { damage: Math.round(damage * (1 - guardOf(offHand))), guarded: 'blocked' }; // (whole points, as every blow's)
  }

  // How much harder the hero's blow on `foe` lands: a riposte on one just parried (used up), else 1.
  riposteOn(foe: Enemy): number {
    if (this.riposte?.foe !== foe) return 1;
    this.riposte = null;
    return RIPOSTE_FACTOR;
  }
}

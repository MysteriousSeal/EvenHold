// The wells' blessings: toss a silver coin into a village's well (E beside
// it) for one of eight, at random, for half an hour of play (counting down
// only while playing, and kept in a save). One at a time from a well:
// another toss rerolls it, the half hour afresh (a cheat can grant all).

import type { Hero, Village } from '../types';
import { COPPER_PER_SILVER } from './money';
import { maxHpOf } from './attributes';

export type BlessingKind = 'swift' | 'strong' | 'tough' | 'lucky' | 'wise' | 'quiet' | 'second' | 'keen' | 'weary';
export interface Blessing {
  kind: BlessingKind;
  left: number; // seconds of it left
}

export const BLESSINGS: Record<BlessingKind, { name: string; about: string }> = {
  swift: { name: 'Swift feet', about: 'You walk 20% faster.' },
  strong: { name: 'Strong arm', about: 'Your blows deal 1 more damage.' },
  tough: { name: 'Tough skin', about: 'Hits on you deal 1 less damage.' },
  lucky: { name: 'Lucky coin', about: 'Foes drop 50% more coins.' },
  wise: { name: 'Wise mind', about: 'You gain 25% more experience.' },
  quiet: { name: 'Quiet step', about: 'Foes notice you from half as far.' },
  second: { name: 'Second wind', about: 'Each foe you slay heals you 1.' },
  keen: { name: 'Keen eye', about: 'Foes drop loot and quest items more often.' },
  weary: { name: 'Weary', about: 'After a fall or a collapse: your blows deal 1 less damage, and hits on you 1 more.' }, // (no well's: a fall's, or a collapse's, mark)
};
const BLESSING_KINDS = (Object.keys(BLESSINGS) as BlessingKind[]).filter((k) => k !== 'weary'); // the wells'
export const WEARY_TIME = 5 * 60; // seconds of play Weary after a fall (or collapsing, out of energy)
export const BLESSING_TIME = 30 * 60; // seconds
export const WELL_TOSS = COPPER_PER_SILVER; // a silver coin
const WELL_REACH = 1.15; // from the well's middle: right beside it

const on = (who: { blessings?: Blessing[] }, kind: BlessingKind) => !!who.blessings?.some((b) => b.kind === kind);
export const walkFactor = (hero: Hero) => (on(hero, 'swift') ? 1.2 : 1);
export const blowDamage = (hero: Hero, base: number) => Math.max(1, base + (on(hero, 'strong') ? 1 : 0) - (on(hero, 'weary') ? 1 : 0));
export const hitTaken = (hero: Hero, damage: number) => Math.max(1, damage - (on(hero, 'tough') ? 1 : 0) + (on(hero, 'weary') ? 1 : 0));
export const coinsFound = (hero: Hero, copper: number) => (on(hero, 'lucky') ? Math.round(copper * 1.5) : copper);
export const xpGained = (hero: Hero, xp: number) => (on(hero, 'wise') ? Math.round(xp * 1.25) : xp);
export const noticeFactor = (who: { blessings?: Blessing[] }) => (on(who, 'quiet') ? 0.5 : 1); // on foes' sight and hearing
export const dropFactor = (hero: Hero) => (on(hero, 'keen') ? 1.5 : 1); // on the chance of loot, and of quest items

// A foe slain: with Second wind, a little health back (never past their most).
export function healOnKill(hero: Hero): void {
  if (on(hero, 'second')) hero.hp = Math.min(maxHpOf(hero), hero.hp + 1);
}

// A fall, or a collapse: Weary for a while (afresh, if already).
export function makeWeary(hero: Hero): void {
  hero.blessings = [...(hero.blessings ?? []).filter((b) => b.kind !== 'weary'), { kind: 'weary', left: WEARY_TIME }];
}

// Counts the blessings down; each gone once spent.
export function tickBlessing(hero: Hero, dt: number): void {
  if (!hero.blessings?.length) return;
  for (const b of hero.blessings) b.left -= dt;
  hero.blessings = hero.blessings.filter((b) => b.left > 0);
}

// Every blessing at once, each for the half hour (a cheat).
export function blessAll(hero: Hero): void {
  hero.blessings = BLESSING_KINDS.map((kind) => ({ kind, left: BLESSING_TIME }));
}

// The village well the hero stands beside, by its village's index; else null.
export function wellInReach(villages: readonly Village[], hero: Hero): number | null {
  const i = villages.findIndex((v) => Math.hypot(v.x - hero.x, v.z - hero.z) <= WELL_REACH);
  return i < 0 ? null : i;
}

// A silver coin into the well, for a blessing (`roll` in 0..1 picks which);
// null if the purse hasn't a silver's worth.
export function tossCoin(hero: Hero, roll: number): BlessingKind | null {
  if (hero.money < WELL_TOSS) return null;
  hero.money -= WELL_TOSS;
  const kind = BLESSING_KINDS[Math.min(BLESSING_KINDS.length - 1, Math.floor(roll * BLESSING_KINDS.length))];
  hero.blessings = [...(hero.blessings ?? []).filter((b) => b.kind === 'weary'), { kind, left: BLESSING_TIME }]; // the well's is the only one (a fall's Weary stays)
  return kind;
}

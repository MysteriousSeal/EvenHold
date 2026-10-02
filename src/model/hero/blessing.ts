// The wells' blessings: toss a silver coin into a village's well (E beside
// it) for one of eight, at random, for half an hour of play (counting down
// only while playing, and kept in a save). One at a time from a well:
// another toss rerolls it, the half hour afresh (a cheat can grant all).

import type { Hero, Village } from '../types';
import { COPPER_PER_SILVER } from './money';
import { maxHpOf } from './attributes';

export type BlessingKind = 'swift' | 'strong' | 'tough' | 'lucky' | 'wise' | 'quiet' | 'second' | 'keen' | 'weary' | 'chilled' | 'webbed';
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
  chilled: { name: 'Chilled', about: "Frost on you (a draugr's breath, a ghost's touch): you walk 45% slower." }, // (no well's: a draugr's breath, crypts/frostBreath.ts; a ghost's touch, hero/fighting.ts)
  webbed: { name: 'Webbed', about: "A cave spider's web clings to you: you walk 60% slower." }, // (no well's: a spider's spat web, caves/caveFoes.ts)
};
const BANES: ReadonlySet<BlessingKind> = new Set(['weary', 'chilled', 'webbed']); // a fall's mark, a draugr's frost, a spider's web: no well's, and kept through one
const BLESSING_KINDS = (Object.keys(BLESSINGS) as BlessingKind[]).filter((k) => !BANES.has(k)); // the wells'
const CHILL_PACE = 0.55; // how fast the hero walks, chilled
const WEB_PACE = 0.4; // and webbed (both: slower still)
export const WEARY_TIME = 5 * 60; // seconds of play Weary after a fall (or collapsing, out of energy)
export const BLESSING_TIME = 30 * 60; // seconds
export const WELL_TOSS = COPPER_PER_SILVER; // a silver coin
const WELL_REACH = 1.15; // from the well's middle: right beside it

const on = (who: { blessings?: Blessing[] }, kind: BlessingKind) => !!who.blessings?.some((b) => b.kind === kind);
export const walkFactor = (hero: Hero) => (on(hero, 'swift') ? 1.2 : 1) * (on(hero, 'chilled') ? CHILL_PACE : 1) * (on(hero, 'webbed') ? WEB_PACE : 1);
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

// A draugr's frost: Chilled for `seconds` (afresh, if already).
export function makeChilled(hero: Hero, seconds: number): void {
  hero.blessings = [...(hero.blessings ?? []).filter((b) => b.kind !== 'chilled'), { kind: 'chilled', left: seconds }];
}

// A spider's web: Webbed for `seconds` (afresh, if already).
export function makeWebbed(hero: Hero, seconds: number): void {
  hero.blessings = [...(hero.blessings ?? []).filter((b) => b.kind !== 'webbed'), { kind: 'webbed', left: seconds }];
}

// Whether it's a bane (Weary, Chilled, Webbed), not a gift.
export const isBane = (kind: BlessingKind): boolean => BANES.has(kind);

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
  hero.blessings = [...(hero.blessings ?? []).filter((b) => BANES.has(b.kind)), { kind, left: BLESSING_TIME }]; // the well's is the only one (a fall's Weary, a draugr's chill, stay)
  return kind;
}

// Taken by the witch-finders (questioning.ts, patrols.ts): never burnt, but a day in the stocks on the nearest
// village's square and a fine to the bishop's poor box. The hero, put out on the square by its well, the clock
// on to the evening of the next day (at least half a day on: let out at dusk), the fine taken (all their purse
// holds, if it holds less), what's heard of them wiped clean (paid for), the hunts called off. Healed (fed on
// what was thrown), Weary. Told as a talk with a night in it (the talk panel's black: "A day in the stocks").
import { nextHour } from '../clock';
import { maxHpOf } from '../hero/attributes';
import { makeWeary } from '../hero/blessing';
import { villageName } from '../villages/villageNames';
import type { Talk } from '../story/storyTypes';
import type { GameModel } from '../GameModel';
import type { Village } from '../types';

const FINE = 40; // copper, and FINE_LEVEL more a level of the hero's
const FINE_LEVEL = 20;
export const RAN = 1.5; // the fine, for a run that was caught
export const FOUGHT = 2; // and for a fight lost
const LET_OUT = 18; // the hour they're let out at
const AT_LEAST = 12 * 60; // game minutes in the stocks, at the least

// The fine, at the hero's level (`times`: for how they were taken).
export const fineFor = (level: number, times = 1): number => Math.round((FINE + FINE_LEVEL * level) * times);

// When they're let out, taken at `minutes`.
export const letOutAt = (minutes: number): number => nextHour(minutes + AT_LEAST, LET_OUT);

export interface Arrest {
  fine: number; // what's asked
  paid: number; // what was had (their purse, if it held less), once served
  village: Village | null;
  served: boolean;
}

// The stocks, served: see above. Once (served again, nothing more).
export function serve(model: GameModel, arrest: Arrest): void {
  if (arrest.served) return;
  arrest.served = true;
  const { hero } = model;
  arrest.paid = Math.min(hero.money, arrest.fine);
  hero.money -= arrest.paid;
  model.roads.patrols.endHunts();
  model.heat.calmAll();
  [hero.knock, hero.y, model.moves.roll, model.moves.guard] = [undefined, 0, null, null];
  const village = arrest.village ?? model.heat.nearest(hero);
  const spot = village ? squareSpot(model, village) : hero;
  model.teleport(spot.x, spot.z); // (out of doors, whatever they'd got into)
  model.minutes = letOutAt(model.minutes);
  hero.hp = maxHpOf(hero);
  makeWeary(hero);
  for (const e of model.enemies) if (e.state === 'chase') e.state = 'wander';
}

// An open tile on the square, by its well (the square's middle): the nearest, ring by ring.
function squareSpot(model: GameModel, village: Village): { x: number; z: number } {
  const [cx, cz] = [Math.round(village.x), Math.round(village.z)];
  for (let r = 2; r < 12; r++) for (let dx = -r; dx <= r; dx++) for (const dz of [-r, r]) if (model.isOpenTile(cx + dx, cz + dz)) return { x: cx + dx, z: cz + dz };
  return { x: village.x, z: village.z };
}

// The arrest, told: who took them says the sentence; the black, a day in the stocks; then the beadle lets them out.
// (Served in the dark; and by the answer, if the black's passed some other way.)
export function arrestTalk(model: GameModel, arrest: Arrest, speaker: string, how: 'quietly' | 'caught' | 'felled'): Talk {
  const where = arrest.village ? villageName(arrest.village, model.seed) : 'the nearest village';
  const opening = {
    quietly: "Sensible. The bishop is merciful to those who come quietly. More or less.",
    caught: "Got you. Running only makes it worse, you know. It always makes it worse.",
    felled: "Still breathing? Good. The bishop wants you fined, not buried. Up you get.",
  }[how];
  return {
    speaker,
    lines: [
      opening,
      `By the bishop's writ: a day in the stocks at ${where}, and ${arrest.fine} copper to the poor box. Nobody burns. Not this time.`,
      `The beadle: "Time's up. That's ${Math.min(model.hero.money, arrest.fine)} copper had of you, and good riddance. Go and wash, you smell of turnip."`,
    ],
    night: () => serve(model, arrest),
    later: 'A day in the stocks: turnips, eggs, a chamber pot, a sermon',
    answers: [{ label: 'Limp off', primary: true, pick: () => serve(model, arrest) }],
  };
}

// An arrest, on its way: the fine by the hero's level and how they were taken, at the village nearest them.
export function arrestFor(model: GameModel, times = 1): Arrest {
  return { fine: fineFor(model.hero.level, times), paid: 0, village: model.heat.nearest(model.hero), served: false };
}

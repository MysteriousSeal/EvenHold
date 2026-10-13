// A bandit stronghold's name (strongholds.ts), from the seed and where its
// gate stands, the same every time: what the countryfolk call a fort gone to
// outlaws, for who holds it or what's said of it: "the Red Hand's Keep",
// "the Gallows Hold", "Crowgard". And its king's own name, who holds it:
// "Black Wat, the bandit king". (The camps' names: camps/campNames.ts; the
// caves': caves/caveNames.ts.)

import { hashUnit, pickAt } from '../../util/random';

export const STRONGHOLD_NAMES = {
  forts: ['Hold', 'Keep', 'Fort', 'Fastness', 'Redoubt', 'Garrison', 'Stockade', 'Bastion', 'Tower', 'Burh'],
  // Whose it is: "the Red Hand's Keep".
  owners: ["the Red Hand's", "the Reavers'", "the Wolfsheads'", "the Hanged Men's", "the Broken Oath's", "the Crows'", "the Cutpurses'", "the Lawless'", "the Black Company's", "the Knives'", "the Forsworn's", "the Gallows Birds'"],
  // What's said of it: "the Gallows Hold".
  kinds: ['Gallows', 'Broken', 'Black', 'Burnt', 'Crooked', 'Bloody', 'Stolen', 'Lawless', 'Iron', 'Rotten', 'Raven', 'Nameless', 'Forsaken', 'Thorned', 'Smoking', 'Sunken'],
  // A word made of two: "Crowgard".
  heads: ['Crow', 'Grim', 'Black', 'Wolf', 'Knife', 'Gallow', 'Rook', 'Iron', 'Thorn', 'Ash', 'Raven', 'Blood', 'Storm', 'Dread'],
  tails: ['gard', 'hold', 'keep', 'watch', 'moat', 'wall', 'gate', 'burh', 'fast', 'holt'],
  // Its king: "Black Wat".
  bynames: ['Black', 'Red', 'One-Eyed', 'Mad', 'Old', 'Lean', 'Bloody', 'Scarred', 'Grey', 'Laughing', 'Iron', 'Crooked'],
  kings: ['Wat', 'Garrick', 'Hob', 'Rolf', 'Osric', 'Dunstan', 'Aldous', 'Brand', 'Godric', 'Ulf', 'Harald', 'Tam', 'Wulfric', 'Ansel'],
} as const;

export function strongholdName({ x, z }: { x: number; z: number }, seed: number): string {
  const { forts, owners, kinds, heads, tails } = STRONGHOLD_NAMES;
  const pick = pickAt(x, z, seed * 173);
  const form = hashUnit(x, z, seed * 173 + 600);
  if (form < 0.35) return `${pick(owners, 601)} ${pick(forts, 602)}`;
  if (form < 0.75) return `the ${pick(kinds, 603)} ${pick(forts, 604)}`;
  return `${pick(heads, 605)}${pick(tails, 606)}`;
}

// Who holds it: its king's name, over his kind's.
export function kingName({ x, z }: { x: number; z: number }, seed: number): string {
  const pick = pickAt(x, z, seed * 179);
  return `${pick(STRONGHOLD_NAMES.bynames, 611)} ${pick(STRONGHOLD_NAMES.kings, 612)}, the bandit king`;
}

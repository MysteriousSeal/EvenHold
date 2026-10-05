// A cave's name (caves.ts), from the seed and where it opens, the same every
// time: what the countryfolk call a hole in the hills they keep clear of,
// for what's down it or what it looks like: "Spinner's Hollow", "the Weeping
// Burrow", "Gloomdelve", "the Silk Warren". Names of dread, not of the dead
// (the crypts': cryptNames.ts).

import { hashUnit, pickAt } from '../../util/random';

export const CAVE_NAMES = {
  holes: ['Hollow', 'Burrow', 'Warren', 'Delve', 'Hole', 'Den', 'Pit', 'Holt', 'Deep', 'Grotto', 'Cleft', 'Sink', 'Gullet', 'Throat', 'Mouth', 'Lair'],
  // Who (or what) it's known by: "Spinner's Hollow".
  owners: ["Spinner's", "Weaver's", "Crawler's", "Brood's", "Old Mother's", "Many-Legs'", "the Widow's", "Grub's", "the Wyrm's", "Hob's", "Shrieker's", "the Blind One's", "Gnaw's", "the Hungry One's", "Silkmother's"],
  // What it's like: "the Weeping Burrow".
  kinds: ['Weeping', 'Silk', 'Gloom', 'Dripping', 'Black', 'Whispering', 'Hungry', 'Hollow', 'Echoing', 'Crawling', 'Bone', 'Sunless', 'Webbed', 'Moaning', 'Rotting', 'Glimmering', 'Deep', 'Cold', 'Gnawed', 'Shrieking'],
  // A word made of two: "Gloomdelve".
  heads: ['Gloom', 'Silk', 'Murk', 'Grim', 'Dim', 'Mire', 'Rot', 'Bone', 'Web', 'Sludge', 'Black', 'Grub', 'Moth', 'Fang', 'Shade'],
  tails: ['delve', 'hole', 'warren', 'burrow', 'holt', 'hollow', 'pit', 'deep', 'den', 'gullet'],
} as const;

export function caveName({ x, z }: { x: number; z: number }, seed: number): string {
  const { holes, owners, kinds, heads, tails } = CAVE_NAMES;
  const pick = pickAt(x, z, seed * 137);
  const form = hashUnit(x, z, seed * 137 + 500);
  if (form < 0.35) return `${pick(owners, 501)} ${pick(holes, 502)}`;
  if (form < 0.75) return `the ${pick(kinds, 503)} ${pick(holes, 504)}`;
  return `${pick(heads, 505)}${pick(tails, 506)}`;
}

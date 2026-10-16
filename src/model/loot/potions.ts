// Potions: health (red) and energy (blue), each in three sizes, drunk at once
// (standing, mid-fight, unlike food: provisions.ts) for a share of the hero's
// most, then POTION_COOLDOWN seconds before another, any (hero/bag.ts
// drinkPotion). A lesser or a greater health potion gives part at once and the
// rest over the seconds after (`mend`): one a fight, it carries them through
// it, healing as the blows come, where a big heal at once would spill over the
// top. Sold by pedlars and the villages' herbalists; nothing drops them.
// And an alchemist's brews besides (skills/alchemy.ts), drunk as any potion: a superior health or energy potion past
// the greater; cures (an antidote shakes off a web or a frost, a purge a fall's weariness, and whatever was last
// eaten with it, a salve the pox); draughts, each a well's blessing for a while in place of the well's
// (hero/blessing.ts quaff); and a love-philtre, for selling (it only makes the drinker sweat). The herbalists sell the
// stronger of them as the hero levels (herbalist/herbalistShop.ts).

import type { BlessingKind } from '../hero/blessing';
import type { LootEntry } from './lootEntry';

export interface Potion extends LootEntry {
  heal?: number; // health back at once, as a share of their most (0..1)
  mend?: number; // and more over the `mendFor` seconds after, likewise (hero.draught: blows don't stop it)
  mendFor?: number;
  energy?: number; // energy back, likewise
  cures?: readonly BlessingKind[]; // banes it sees off (bag.ts drinkPotion: not drunk with none of them on)
  empties?: boolean; // and the last meal's blessing with them (a purge)
  gives?: BlessingKind; // a blessing, for `lasts` seconds, in place of a well's (blessing.ts quaff)
  lasts?: number;
  does?: string; // what it does, said short (where it isn't health or energy back)
  sweat?: boolean; // does nothing but make the drinker sweat: to sell, not to drink (a love-philtre)
  about: string;
}

const DRAUGHT = 10 * 60; // seconds of play a draught's blessing lasts (a well's half hour, a third of it: chosen, not rolled)

export const POTIONS = {
  minorHealthPotion: { name: 'Minor health potion', value: 20, heal: 0.25, droppedBy: {}, about: 'A small flask of something red and bitter.' },
  lesserHealthPotion: { name: 'Lesser health potion', value: 50, heal: 0.2, mend: 0.3, mendFor: 6, droppedBy: {}, about: 'Red as a robin, warm going down.' },
  greaterHealthPotion: { name: 'Greater health potion', value: 120, heal: 0.25, mend: 0.6, mendFor: 10, droppedBy: {}, about: 'It glows a little, and so will you.' },
  minorEnergyPotion: { name: 'Minor energy potion', value: 11, energy: 0.25, droppedBy: {}, about: 'Blue, fizzing, and strong enough.' },
  lesserEnergyPotion: { name: 'Lesser energy potion', value: 20, energy: 0.45, droppedBy: {}, about: 'Like a night\'s sleep in a mouthful.' },
  greaterEnergyPotion: { name: 'Greater energy potion', value: 31, energy: 0.7, droppedBy: {}, about: 'The herbalist won\'t say what\'s in it.' },
  // An alchemist's (skills/alchemy.ts), and the herbalists' as the hero levels.
  superiorHealthPotion: { name: 'Superior health potion', value: 180, heal: 0.3, mend: 0.8, mendFor: 12, droppedBy: {}, about: 'Mandrake in it. Hold your nose.' },
  superiorEnergyPotion: { name: 'Superior energy potion', value: 44, energy: 1, droppedBy: {}, about: 'Your heart will pound for an hour. That means it works.' },
  antidote: { name: 'Antidote', value: 25, cures: ['webbed', 'chilled'], does: 'Shakes off a web or a frost (Webbed, Chilled)', droppedBy: {}, about: 'Bitter as a widow. Warm as a fire.' },
  purge: { name: 'Purge', value: 15, cures: ['weary'], empties: true, does: 'Sees off Weary, and whatever you last ate with it', droppedBy: {}, about: 'Drink it near a privy. Not in one; near one.' },
  poxSalve: { name: 'Pox salve', value: 60, cures: ['poxed'], does: 'Sees off the pox', droppedBy: {}, about: 'Rubbed in where it itches. You know where.' },
  swiftDraught: { name: 'Draught of swiftness', value: 30, gives: 'swift', lasts: DRAUGHT, does: 'Swift feet for 10 min: you walk 20% faster', droppedBy: {}, about: 'Yarrow and a bat\'s wing. Your feet itch to go.' },
  shadowDraught: { name: 'Shadow draught', value: 35, gives: 'quiet', lasts: DRAUGHT, does: 'Quiet step for 10 min: foes notice you from half as far', droppedBy: {}, about: 'Dark as a cellar, and it makes you feel like one.' },
  oxDraught: { name: 'Ox draught', value: 45, gives: 'strong', lasts: DRAUGHT, does: 'Strong arm for 10 min: your blows deal 20% more damage', droppedBy: {}, about: 'Red caps and venom. The northmen swear by it.' },
  barkDraught: { name: 'Bark-skin draught', value: 50, gives: 'tough', lasts: DRAUGHT, does: 'Tough skin for 10 min: hits on you deal 15% less damage', droppedBy: {}, about: 'Your skin goes stiff and grey for a while. It passes.' },
  hawkDraught: { name: 'Hawk-eye draught', value: 55, gives: 'keen', lasts: DRAUGHT, does: 'Keen eye for 10 min: foes drop loot and quest items more often', droppedBy: {}, about: 'Everything glitters. Some of it is even worth taking.' },
  lovePhiltre: { name: 'Love-philtre', value: 40, sweat: true, does: 'Sold to the lovelorn. It only makes the drinker sweat', droppedBy: {}, about: 'Rosehip-pink and sickly sweet. Swears it works.' },
} satisfies Record<string, Potion>; // (health, a copper a share point the lesser, 1.4 the greater, against food's half: paid for drunk standing, mid-fight; energy's cheaper than health: about 0.44 copper a share point, half again an ale's, 0.3, for a flask on the road)

export type PotionId = keyof typeof POTIONS;
export const POTION_IDS = Object.keys(POTIONS) as PotionId[];
// The six sold everywhere (the pedlars', every herbalist's at any level); the rest an alchemist's brews.
export const SHOP_POTIONS: readonly PotionId[] = ['minorHealthPotion', 'lesserHealthPotion', 'greaterHealthPotion', 'minorEnergyPotion', 'lesserEnergyPotion', 'greaterEnergyPotion'];
export const isPotion = (item: string): item is PotionId => item in POTIONS;

export const POTION_COOLDOWN = 30; // seconds after one before another, any

// What one costs (its value), or fetches sold back (half).
export const potionPrice = (id: PotionId, selling: boolean): number => (selling ? Math.floor(POTIONS[id].value / 2) : POTIONS[id].value);

// What one gives back, said short: "Restores 25% health at once" (", and 60% more over 10 s"); a cure's or a
// draught's, what it does.
export const potionText = (id: PotionId): string => {
  const { heal, energy, mend, mendFor, does } = POTIONS[id] as Potion;
  if (does) return does;
  const more = mend ? `, and ${Math.round(mend * 100)}% more over ${mendFor} s` : '';
  return `Restores ${Math.round((heal ?? energy ?? 0) * 100)}% ${heal ? 'health' : 'energy'} at once${more}`;
};

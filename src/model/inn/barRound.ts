// A round bought for the bar (asked of a patron sat beside the hero, in a word with them: npcs/chat.ts): the price of
// an ale for each villager sat at it, paid to the inn; each orders theirs (barPatrons.ts), the barmaid calls it, and
// they raise a cheer. The first of a day a little experience for the hero, besides (the goodwill of a village).

import { clockAt } from '../clock';
import { gainXp } from '../hero/heroStats';
import type { Hero } from '../types';
import type { Inside } from '../interiors/indoors';
import { doorNumber } from '../interiors/interiors';
import type { Npc } from '../npcs/npcs';
import { say } from '../npcs/speech';
import type { Talk } from '../story/story';
import { oneOf, hashUnit } from '../../util/random';
import { busyAtBar, order } from './barPatrons';
import { buyPrice, shopAt, type Shop } from './tavernShop';

export const ROUND_XP = 6; // the hero's own, the first round of a day
const CHEERS = ['To your health!', "Now that's a friend!", 'Cheers!', 'A toast! To the one with the coin!', "I'll drink to that!", 'Long may you live!'];
const BARMAID = ['A round on {name}, everyone!', 'Drinks on {name}! Mind, they pay, not me.', "{name}'s buying! Don't all rush at once."];
const rounded = new WeakMap<Hero, number>(); // the day of the hero's last round (while the game runs)

interface Bar {
  hero: Hero;
  folk: readonly Npc[];
  inside: Inside | null;
  shops: Map<number, Shop>;
  seed: number;
  minutes: number;
}

// The villagers sat at the inn's bar now.
const atTheBar = (bar: Bar): Npc[] => bar.folk.filter((n) => n.role === 'villager' && n.where === bar.inside?.entrance && n.seat?.piece.kind === 'barStool');

// What a round comes to here: the patrons it's for, and its price.
export function roundHere(bar: Bar): { patrons: Npc[]; price: number } {
  const patrons = atTheBar(bar);
  return { patrons, price: patrons.length * buyPrice('ale') };
}

// Buys it: paid, an ale ordered for each not already waiting on one or drinking, the bar's cheer; the day's first, the
// hero's experience. Why not, if not.
export function buyRound(bar: Bar): 'bought' | 'too poor' | 'sold out' | 'no one' {
  const { patrons, price } = roundHere(bar);
  if (!patrons.length || !bar.inside) return 'no one';
  const shop = shopAt(bar.shops, bar.seed, doorNumber(bar.inside.entrance));
  if ((shop.stock.ale ?? 0) < patrons.length) return 'sold out';
  if (bar.hero.money < price) return 'too poor';
  bar.hero.money -= price;
  shop.money += price;
  shop.stock.ale! -= patrons.length;
  for (const npc of patrons) if (!busyAtBar(npc)) order(npc, bar.folk, npc.seat!.piece);
  const barmaid = bar.folk.find((n) => n.role === 'barkeep' && n.where === bar.inside!.entrance);
  const n = Math.floor(bar.minutes);
  if (barmaid) say(barmaid, oneOf(BARMAID, hashUnit(n, 1, 91)).replace('{name}', bar.hero.name));
  for (const [i, npc] of patrons.slice(0, 3).entries()) say(npc, oneOf(CHEERS, hashUnit(npc.id, n + i, 92)));
  const day = clockAt(bar.minutes).day;
  if (rounded.get(bar.hero) !== day) {
    rounded.set(bar.hero, day);
    gainXp(bar.hero, ROUND_XP);
  }
  return 'bought';
}

// A word with a patron at the bar, with a round to be bought among what the hero may say (the talk's own after it).
export function withRound(bar: Bar, talk: Talk): Talk {
  const { patrons, price } = roundHere(bar);
  if (!patrons.length) return talk;
  const said: Record<Exclude<ReturnType<typeof buyRound>, 'bought'>, string> = {
    'too poor': "You count your coin. Not enough for the whole bar.",
    'sold out': "The barmaid shakes her head: the barrel won't stretch to a round.",
    'no one': 'There is no one left at the bar to buy for.',
  };
  const round = {
    label: `Buy a round for the bar · ${price} copper`,
    pick: (): Talk => {
      const done = buyRound(bar);
      return { speaker: talk.speaker, lines: [done === 'bought' ? "You're a good sort, you are. Drink up, all!" : said[done]], answers: talk.answers.filter((a) => a !== round) };
    },
  };
  return { ...talk, answers: [round, ...talk.answers] };
}

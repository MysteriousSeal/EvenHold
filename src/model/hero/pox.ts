// The pox (blessing.ts: a bane, caught at work in an inn's room: jobs/roomShift.ts), seen to: any herbalist, spoken
// to with it, says so before anything else, and has a salve for it at a price (into their purse); paid, it's gone.
// Woken for it at night, they sell it all the same (their wares, though, wait for the morning: herbalistWork.ts).
import type { Talk } from '../story/story';
import type { Hero } from '../types';
import type { Npc } from '../npcs/npcs';
import type { Shop } from '../shops/shopStock';
import { herbalistShopAt } from '../herbalist/herbalistShop';
import { herbalistAbed } from '../herbalist/herbalistWork';
import { curePox, hasPox } from './blessing';

export const SALVE = 60; // copper

// The visits (the hero's time in a room: GameModel.inside, made afresh each time they come in) the salve's been offered
// in full: after that, the visit through, only a short word on it.
const pitched = new WeakSet<object>();

// What a herbalist says to a hero with the pox (null: they haven't it): the salve bought, or not just now; their
// wares an answer away (by day), and after their word on the salve too.
// (`then`: what else they have to say, if anything: said next, the salve left for later or bought.)
export function poxTalk(model: { hero: Hero; shops: Map<number, Shop>; seed: number; minutes: number; inside?: object | null }, herbalist: Pick<Npc, 'name' | 'id'>, then?: () => Talk | null): Talk | null {
  const { hero } = model;
  if (!hasPox(hero)) return null;
  const night = herbalistAbed(model.minutes);
  const told = !!model.inside && pitched.has(model.inside); // (said in full already, this visit: a word to remind them)
  if (model.inside) pitched.add(model.inside);
  const wares = night ? [] : [{ label: 'Show me your wares.', trade: true, pick: () => {} }];
  const says = (line: string, bye: string): Talk => ({ speaker: herbalist.name, lines: [line], answers: [{ label: bye, out: true, pick: () => then?.() ?? undefined }, ...wares] });
  return {
    speaker: herbalist.name,
    lines: told ? [`Still scratching? The salve's ${SALVE} copper, whenever you want it.`] : [`${night ? 'You woke me for- oh. I see. ' : ''}Stand still. That rash, and the way you're walking: you've caught the pox. I see it every week from the inn's rooms.`, `I have a salve that sees it off. It costs ${SALVE} copper. Without it you will go on tiring half as fast again, for a long while.`],
    answers: [
      {
        label: `Pay ${SALVE} copper for the salve.`,
        primary: true,
        pick: () => {
          if (hero.money < SALVE) return says(`You're ${SALVE - hero.money} copper short. Come back when you have it. It won't kill you, but it won't leave on its own soon either.`, 'Later.');
          hero.money -= SALVE;
          herbalistShopAt(model.shops, model.seed, herbalist).money += SALVE;
          curePox(hero);
          return says('There. Rub it in now, and again tonight. And tell whoever gave it to you to come and see me too.', 'Thank you.');
        },
      },
      { label: 'Later.', out: true, pick: () => then?.() ?? undefined },
      ...wares,
    ],
  };
}

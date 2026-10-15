// The pox (blessing.ts: a bane, caught at work in an inn's room: jobs/roomShift.ts), seen to: any herbalist, spoken
// to with it, says so before anything else, and has a salve for it at a price (into their purse); paid, it's gone.
import type { Talk } from '../story/story';
import type { Hero } from '../types';
import type { Npc } from '../npcs/npcs';
import type { Shop } from '../shops/shopStock';
import { herbalistShopAt } from '../herbalist/herbalistShop';
import { curePox, hasPox } from './blessing';

export const SALVE = 60; // copper

// What a herbalist says to a hero with the pox (null: they haven't it): the salve bought, or not just now; their
// wares an answer away, as ever, and after their word on the salve too.
// (`then`: what else they have to say, if anything: said next, the salve left for later or bought.)
export function poxTalk(model: { hero: Hero; shops: Map<number, Shop>; seed: number }, herbalist: Pick<Npc, 'name' | 'id'>, then?: () => Talk | null): Talk | null {
  const { hero } = model;
  if (!hasPox(hero)) return null;
  const wares = { label: 'Show me your wares.', trade: true, pick: () => {} };
  const says = (line: string, bye: string): Talk => ({ speaker: herbalist.name, lines: [line], answers: [{ label: bye, out: true, pick: () => then?.() ?? undefined }, wares] });
  return {
    speaker: herbalist.name,
    lines: ["Stand still. That rash, and the way you're walking: you've caught the pox. I see it every week from the inn's rooms.", `I have a salve that sees it off. It costs ${SALVE} copper. Without it you will go on tiring half as fast again, for a long while.`],
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
      wares,
    ],
  };
}

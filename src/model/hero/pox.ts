// The pox (blessing.ts: a bane, caught at work in an inn's room: jobs/roomShift.ts), seen to: any herbalist, spoken
// to with it, says so before anything else, and has a salve for it at a price; paid, it's gone.
import type { Talk } from '../story/story';
import type { GameEvent, Hero } from '../types';
import { curePox, hasPox } from './blessing';

export const SALVE = 60; // copper

// What a herbalist says to a hero with the pox (null: they haven't it): the salve bought, or not just now; their
// wares an answer away, as ever.
// (`then`: what else they have to say, if anything: said next, the salve left for later.)
export function poxTalk(model: { hero: Hero; report(event: GameEvent): void }, herbalist: { name: string }, then?: () => Talk | null): Talk | null {
  const { hero } = model;
  if (!hasPox(hero)) return null;
  const says = (line: string): Talk => ({ speaker: herbalist.name, lines: [line], answers: [] });
  return {
    speaker: herbalist.name,
    lines: ["Stand still. That rash, and the way you're walking: you've caught the pox. I see it every week from the inn's rooms.", `I have a salve that clears it in a day. It costs ${SALVE} copper. Without it you will go on tiring half as fast again, for a long while.`],
    answers: [
      {
        label: `Pay ${SALVE} copper for the salve.`,
        primary: true,
        pick: () => {
          if (hero.money < SALVE) return says("You haven't the coin for it. Come back when you have. It won't kill you, but it won't leave on its own soon either.");
          hero.money -= SALVE;
          curePox(hero);
          return says('Rub it in twice a day. And tell whoever gave it to you to come and see me too.');
        },
      },
      { label: 'Later.', out: true, pick: () => then?.() ?? undefined },
      { label: 'Show me your wares.', trade: true, pick: () => {} },
    ],
  };
}

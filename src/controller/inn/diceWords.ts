// What the dice window says (dicePanel.ts): the rules, plainly; a villager's word across the table (a sharp has their
// own: model/inn/diceSharps.ts); the tell, seen; and a die's face, its pips drawn.

import { el } from '../../view/ui/dom';
import { STAKE_CAP } from '../../model/inn/diceTable';

export const DICE_RULES: ReadonlyArray<readonly [string, string]> = [
  ['The call', 'You cast. Call a main, any of five to nine, and put your stake down; whoever sits across covers it. Even money.'],
  ['The first throw', 'Throw your main and you win (a nick). Two or three and you lose (crabs). Eleven wins on a main of seven, and loses on any other; twelve wins on a six or an eight, and loses on any other.'],
  ['Your chance', 'Anything else is your chance. Throw on: the chance again and you win, the main and you lose.'],
  ['The odds', 'Every main leaves you a shade under evens: about 49 in 100 on a seven, a five or a nine, 48 in 100 on a six or an eight. Hover a main to see it.'],
  ['The stakes', `Small at a village inn, more further out on the roads, never more than ${STAKE_CAP} copper. Walk away mid-game and the stake on the table is theirs.`],
  ['Sharps', 'Some evenings a cheat sits waiting with fullams up a sleeve: loaded dice that come up aces (or sixes) again and again. If you think the dice are loaded, cry fullams mid-game. Right, and you get your stake back, theirs, and everything they took off you tonight. Wrong, and you lose the stake and as much again for the insult. Watch their hands, and watch the dice.'],
];

// A villager across the table (their word, by how it's going).
export const HONEST = {
  hello: ["Go on then, a few throws. Small stakes, mind.", 'Dice? Why not. My wife thinks I am at the well.', "I'll play you. Don't cry when you lose.", 'Sit, sit. I need someone worse at this than me.'],
  theyWon: ['Ha! Pay up.', "That's my ale paid for.", 'The bones like me tonight.', 'Better luck next throw.'],
  theyLost: ['Ah, bugger.', 'Well thrown, curse you.', 'Again. I want that back.', "Take it, then. I didn't need it."],
  'cleaned out': ["That's my last copper. You've cleaned me out.", "I'm skint. My wife will kill me. Then you."],
  enough: ["That'll do me for tonight.", "I'm done. My head's swimming.", "Enough. I'll keep what's left, thanks."],
  caught: ['Caught?'],
  wronged: ['Loaded? These are my own dice, you lout! Pay up for that.', 'You call me a cheat? In my own village? Pay, then get away from me.'],
} as const;

// Their hand seen going to their sleeve as the game began: the tell, told in the window.
export const SEEN = "You saw {name}'s hand dip into a sleeve as the cup came over.";

// A die's face: its pips on a three-by-three.
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
export function diceFace(n: number): HTMLElement {
  const face = el('span', `dice-face${n === 1 ? ' ace' : ''}`);
  face.setAttribute('aria-label', `${n}`);
  for (let i = 0; i < 9; i++) face.append(el('span', PIPS[n].includes(i) ? 'pip' : 'blank'));
  return face;
}

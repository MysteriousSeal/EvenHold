// Ordering an ale, sat on a stool at the bar (F): the barmaid calls that
// she's coming, then a moment later pours one from her stock (npcs/tavernShop.ts), at her price, and the hero drinks it
// there and then for its good; she says a word either way. Sold out, she
// says when the next barrel's up; too poor, she says so.

import type { GameModel } from '../model/GameModel';
import { buy, buyPrice, restockIn, shopAt, type Shop } from '../model/npcs/tavernShop';
import type { Npc } from '../model/npcs/npcs';

const POURED = ["Here's your ale, love.", 'One ale, frothing over.', "Drink up, it's a cold night out there.", 'Fresh from the cellar. Mind the foam.', "On its way. Don't spill it on the floor, it's new."];
const COMING = ['Coming, love!', "One moment, I'll be right with you.", 'Just a tick, pouring it now.'];
const TOO_POOR = ["That's not enough coin for an ale, love.", 'Short a copper or two there.', "I don't pour on a promise, love."];
const pick = (lines: readonly string[]) => lines[Math.floor(Math.random() * lines.length)];
const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// The barmaid's shop, where the hero is (in her inn).
const shopHere = (model: GameModel): Shop => shopAt(model.shops, model.seed, model.entrances.indexOf(model.inside!.entrance));

// Whether the hero's sat on a stool at the bar (where F orders).
export const atTheBar = (model: GameModel) => model.inside?.seated?.seat.piece.kind === 'barStool';

// The inn's barmaid, wherever she is in it (she's the one who pours); else null.
export const barmaidHere = (model: GameModel): Npc | null => model.npcs.find((n) => n.role === 'barkeep' && n.where === model.inside?.entrance) ?? null;

// What the prompt says: the order and its price, or when she'll have more.
export function orderLabel(model: GameModel): { label: string; soldOut: boolean } {
  if (!barmaidHere(model)) return { label: 'No one behind the bar', soldOut: true };
  const shop = shopHere(model);
  if ((shop.stock.ale ?? 0) <= 0) return { label: `Out of ale · back in ${clock(restockIn(shop))}`, soldOut: true };
  return { label: `Order an ale · ${buyPrice('ale')} copper`, soldOut: false };
}

// F pressed: what she calls back straight away (coming, or why not), and
// whether she's coming (then orderAle pours it a moment later).
export function callForAle(model: GameModel): { said: string; coming: boolean } {
  const shop = shopHere(model);
  if ((shop.stock.ale ?? 0) <= 0) return { said: `The barrel's dry, love. Back in ${clock(restockIn(shop))}.`, coming: false };
  if (model.hero.money < buyPrice('ale')) return { said: pick(TOO_POOR), coming: false };
  return { said: pick(COMING), coming: true };
}

// Orders one: returns what she says, and whether the hero drank.
export function orderAle(model: GameModel): { said: string; drank: boolean } {
  const shop = shopHere(model);
  const result = buy(shop, model.hero, 'ale');
  if (result === 'sold out') return { said: `The barrel's dry, love. Back in ${clock(restockIn(shop))}.`, drank: false };
  if (result === 'too poor') return { said: pick(TOO_POOR), drank: false };
  model.consume('ale'); // down in one
  return { said: pick(POURED), drank: true };
}

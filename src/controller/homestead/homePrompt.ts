// The words over what E does at the hero's cottage (model/homestead/home.ts), and over a cottage's door: the reeve's
// notice (its price, or why not yet), a spot chalked on the floor (what's to be built there, and its price), the
// trophy wall.

import type { GameModel } from '../../model/GameModel';
import { COTTAGE_PRICE, QUESTS_KNOWN, UPGRADES, isCottage, offerOf, ownsHere } from '../../model/homestead/cottage';
import type { HomeAction } from '../../model/homestead/home';
import type { Entrance } from '../../model/interiors/interiors';
import { middleOf } from '../../model/interiors/furniture';
import { COPPER_PER_SILVER } from '../../model/hero/money';
import type { PromptTarget } from '../../view/hud/lootPrompt';

const silver = (copper: number) => `${copper / COPPER_PER_SILVER} silver`;

export function homePrompt(model: GameModel, action: HomeAction): PromptTarget {
  const piece = action.kind === 'buy' ? action.notice : action.kind === 'build' ? action.spot : action.wall;
  const { x, z } = middleOf(piece);
  const at = { x, y: 0.95, z };
  if (action.kind === 'trophies') return { label: 'Look at your trophies', ...at };
  if (action.kind === 'build') {
    const { name, price } = UPGRADES[action.upgrade];
    return { label: `Build ${name.toLowerCase()} · ${silver(price)}`, muted: model.hero.money < price, ...at };
  }
  const offer = offerOf(model, model.inside!.entrance);
  if (offer.ok || offer.why === 'poor') return { label: `Buy the cottage · ${silver(COTTAGE_PRICE)}`, muted: !offer.ok, ...at };
  if (offer.why === 'home') return { label: 'For sale · you have a cottage already', muted: true, ...at };
  return { label: `For sale to those the village knows · its board's quests ${offer.done}/${QUESTS_KNOWN}`, muted: true, ...at };
}

// A cottage's door, from outside: the hero's own, or one for sale; null, any other house's.
export const cottageDoor = (model: GameModel, door: Entrance): string | null =>
  ownsHere(model.hero, door) ? 'Enter your cottage' : door.type === 'house' && isCottage(door) ? 'Enter the empty cottage · for sale' : null;

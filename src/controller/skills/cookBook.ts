// Cooking's page of the skill's window (skillWindow.ts): the recipe book (recipeBook.ts) with cooking's recipes
// (model/skills/cooking.ts), each meal told as food (what it heals, its blessing after), cooked only by a fire (said
// so, picked, when there's none, or a campfire where it wants a hearth); over it, the fire the hero stands by, or a
// button to kindle one (of a bundle of firewood, or two logs).

import type { GameModel } from '../../model/GameModel';
import { COOK_GROUPS, COOK_RECIPES, COOK_RECIPE_IDS, KINDLE_LOGS, dishWorth, type CookRecipeId } from '../../model/skills/cooking';
import { givesText } from '../../model/loot/provisions';
import { el } from '../../view/ui/dom';
import { recipeBook, type BookState, type Craft } from './recipeBook';

export const COOKING: Craft = {
  skill: 'cooking',
  name: 'Cooking',
  recipes: COOK_RECIPES,
  ids: COOK_RECIPE_IDS,
  groups: COOK_GROUPS,
  crafter: (model) => model.cooking,
  kind: (id) => `Food · ${givesText(id as CookRecipeId)}`,
  worth: (id) => dishWorth(id as CookRecipeId), // (a dish of a hunt's meat teaches as much as so many)
  notHere: (model, id) => {
    const fire = model.cooking.fireInReach;
    if (!fire) return 'Stand by a fire to cook: a camp’s, a hearth indoors, or one you kindle.';
    return COOK_RECIPES[id as CookRecipeId].hearth && fire.kind !== 'hearth' ? 'It wants a hearth (an inn’s, a home’s): a campfire won’t do.' : '';
  },
  verb: 'Cook',
  empty: 'Nothing you can cook with what’s in your bag. Hunt, fish, or untick the filter to see every recipe.',
};

// The line over the book: the fire they're by (and how long a kindled one has left), or none, and a button to kindle
// one outdoors (with the logs for it).
function fireLine(model: GameModel, redraw: () => void): HTMLElement {
  const { cooking, hero } = model;
  const fire = cooking.fireInReach;
  if (fire) {
    const own = fire.kind === 'campfire' && cooking.kindled && fire.x === cooking.kindled.x && fire.z === cooking.kindled.z;
    const said = fire.kind === 'hearth' ? 'By a hearth: everything can be cooked here.' : own ? `By your campfire (${Math.ceil(cooking.kindled!.left / 60)} min left): roasts and fish.` : 'By a campfire: roasts and fish.';
    return el('p', 'cook-fire lit', said);
  }
  const kindle = el('button', 'book-craft quiet', (hero.bag.firewood ?? 0) > 0 ? 'Kindle a campfire (firewood)' : `Kindle a campfire (${KINDLE_LOGS} logs)`);
  kindle.disabled = !!model.inside || !cooking.canKindle;
  kindle.addEventListener('click', () => [cooking.kindle(), redraw()]);
  return el('p', 'cook-fire', model.inside ? 'No fire here: find the hearth.' : 'No fire here.', ...(model.inside ? [] : [kindle]));
}

export function cookBook(model: GameModel, state: BookState, redraw: () => void): HTMLElement {
  return el('div', 'cook-page', fireLine(model, redraw), recipeBook(model, state, redraw, COOKING));
}

// What the fire line shows, in a word (to know when to draw it again).
export const fireState = (model: GameModel): string => `${model.cooking.fireInReach?.kind ?? ''}|${Math.ceil((model.cooking.kindled?.left ?? 0) / 60)}`;

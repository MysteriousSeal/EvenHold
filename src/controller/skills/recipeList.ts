// A crafting skill's recipes (model/skills/woodworking.ts), as WoW's profession window lists them, in the skills
// window under the skill: a row each, what it makes (its icon), its name in the colour of how much it'd still teach
// (skills.ts difficulty: orange … grey), its materials with how many are in the bag (short, in red), and buttons to
// make one or all the bag allows; one not reached yet faded, the level it wants; the one being made, how far along,
// lit, in progress. What's being made told of on its own (craftStatus: shown beside the list, in the skill's window):
// what, how many of how many, a bar filling toward the next (kept filling by recipeProgress, each frame), a button to stop.

import type { GameModel } from '../../model/GameModel';
import { nameOf } from '../../model/hero/bag';
import type { LootId } from '../../model/loot/loot';
import { difficulty, skillOf } from '../../model/skills/skills';
import { RECIPES, RECIPE_IDS, type RecipeId } from '../../model/skills/woodworking';
import { bagIcon } from '../../view/ui/itemIcons';
import { el } from '../../view/ui/dom';

const ICON = 38;

export function recipeList(model: GameModel, redraw: () => void): HTMLElement {
  const { woodworking, hero } = model;
  const level = skillOf(hero, 'woodworking').level;
  const list = el('ol', 'recipe-list');
  for (const id of RECIPE_IDS) list.append(row(id));
  return list;

  function row(id: RecipeId): HTMLElement {
    const recipe = RECIPES[id];
    const known = woodworking.knows(id);
    const makes = typeof recipe.makes === 'string' ? recipe.makes : recipe.makes.item;
    const name = el('span', 'recipe-name', recipe.name);
    if (known) name.style.color = difficulty(recipe.needs, level).color;
    const materials = el('span', 'recipe-from');
    for (const [item, n] of Object.entries(recipe.from)) {
      const have = hero.bag[item as LootId] ?? 0;
      materials.append(el('span', have >= n! ? 'recipe-material' : 'recipe-material short', `${n} ${nameOf(item as LootId)} `, el('em', undefined, `${have}/${n}`)));
    }
    const can = woodworking.canMake(id);
    const making = woodworking.making?.recipe === id ? woodworking.making : null;
    const buttons = el('span', 'recipe-buttons');
    if (!known) buttons.append(el('span', 'recipe-needs', `Needs ${recipe.needs}`));
    else if (making) buttons.append(el('span', 'recipe-left', 'In progress'));
    else {
      const one = el('button', 'recipe-go', 'Craft');
      const all = el('button', 'recipe-go', `All (${can})`);
      one.disabled = all.disabled = can === 0;
      one.addEventListener('click', () => [woodworking.start(id, 1), redraw()]);
      all.addEventListener('click', () => [woodworking.start(id, Infinity), redraw()]);
      buttons.append(one, all);
    }
    const icon = el('span', 'recipe-icon', bagIcon(makes)(ICON));
    const item = el('li', known ? (making ? 'recipe making' : 'recipe') : 'recipe locked', icon, el('span', 'recipe-text', name, materials), buttons);
    item.dataset.recipe = id;
    return item;
  }
}

// What's being made, as a card (none: nothing): its icon and name, how many of how many, a bar filling toward the
// next, a button to stop it.
export function craftStatus(model: GameModel, redraw: () => void): HTMLElement | null {
  const making = model.woodworking.making;
  if (!making) return null;
  const recipe = RECIPES[making.recipe];
  const makes = typeof recipe.makes === 'string' ? recipe.makes : recipe.makes.item;
  const stop = el('button', 'recipe-go stop', 'Stop');
  stop.addEventListener('click', () => [model.woodworking.stop(), redraw()]);
  return el(
    'div',
    'craft-status',
    el('span', 'craft-status-label', 'Crafting'),
    el('div', 'craft-status-head', el('span', 'recipe-icon', bagIcon(makes)(ICON)), el('span', 'craft-status-text', el('b', undefined, recipe.name), el('span', undefined, `Making ${making.of - making.left + 1} of ${making.of}`)), stop),
    el('span', 'recipe-progress', el('i')),
  );
}

// The bar of what's being made, filled as far as it's come (each frame: the card's only drawn again as things change).
export function recipeProgress(model: GameModel, root: ParentNode = document): void {
  const fill = root.querySelector<HTMLElement>('.craft-status .recipe-progress > i');
  if (fill) fill.style.width = `${Math.round((model.woodworking.progress ?? 0) * 1000) / 10}%`;
}

// What a recipe list shows, in a word (to know when to draw it again): the skill, the bag's materials, what's made.
export function recipeState(model: GameModel): string {
  const { woodworking, hero } = model;
  const materials = new Set(RECIPE_IDS.flatMap((id) => Object.keys(RECIPES[id].from)));
  return `${skillOf(hero, 'woodworking').level}|${[...materials].map((m) => hero.bag[m as LootId] ?? 0).join(',')}|${woodworking.making ? `${woodworking.making.recipe}:${woodworking.making.left}` : ''}`;
}

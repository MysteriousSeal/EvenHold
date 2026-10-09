// A crafting skill's recipes (model/skills/woodworking.ts), as WoW's tradeskill window has them, in the skill's own
// window (skillWindow.ts): on the left, the recipes under what they make (materials, goods, weapons, shields), each
// in the colour of how much it'd still teach (skills.ts difficulty), how many the bag would make now, the best to
// learn from starred; those not reached faded, the level they want; a "can make now" filter, the colours' key. On the
// right, the one picked: what it makes (a material; goods and what they sell for; gear, its level, rarity and what
// it gives), what it wants of the skill and how much it'd teach, its materials (each had, of wanted), how many to
// make, and the buttons; under them, what's being made (its bar kept filling by recipeProgress, each frame).

import type { GameModel } from '../../model/GameModel';
import { nameOf, qualityOf } from '../../model/hero/bag';
import { LOOT, type LootId } from '../../model/loot/loot';
import { gearKey } from '../../model/human/items/gear';
import { difficulty, skillOf } from '../../model/skills/skills';
import { bookLegend, bookRow, needsLine } from './bookParts';
import { RECIPES, RECIPE_GROUPS, RECIPE_IDS, type RecipeId } from '../../model/skills/woodworking';
import { bagIcon } from '../../view/ui/itemIcons';
import { QUALITY_INK } from '../../view/hud/lootPrompt';
import { lineText } from '../../view/ui/menu';
import { el } from '../../view/ui/dom';
import { gearLines } from '../hero/gearLines';

// What the window keeps between draws: the recipe picked, the filter, how many to make.
export interface BookState {
  picked: RecipeId | null;
  canOnly: boolean;
  count: number;
}
export const newBook = (): BookState => ({ picked: null, canOnly: false, count: 1 });

const makesOf = (id: RecipeId) => {
  const m = RECIPES[id].makes;
  return typeof m === 'string' ? m : gearKey({ ...m, roll: 0 });
};

// The best of the recipes to learn from now: of those the bag would make, the one likeliest to raise the skill (the
// hardest, of those as likely); none, if none.
export function bestRecipe(model: GameModel): RecipeId | null {
  const level = skillOf(model.hero, 'woodworking').level;
  const can = RECIPE_IDS.filter((id) => model.woodworking.canMake(id) > 0 && difficulty(RECIPES[id].needs, level).chance > 0);
  return can.sort((a, b) => difficulty(RECIPES[b].needs, level).chance - difficulty(RECIPES[a].needs, level).chance || RECIPES[b].needs - RECIPES[a].needs)[0] ?? null;
}

export function recipeBook(model: GameModel, state: BookState, redraw: () => void): HTMLElement {
  const { woodworking } = model;
  const level = skillOf(model.hero, 'woodworking').level;
  const best = bestRecipe(model);
  if (!state.picked) state.picked = best ?? RECIPE_IDS.filter((id) => woodworking.knows(id)).at(-1) ?? RECIPE_IDS[0];

  // The list: a filter, the recipes under what they make, the colours' key.
  const filter = el('label', 'book-filter', el('input'), 'Can make now');
  const box = filter.querySelector('input')!;
  box.type = 'checkbox';
  box.checked = state.canOnly;
  box.addEventListener('change', () => [(state.canOnly = box.checked), redraw()]);
  const list = el('div', 'book-list');
  list.setAttribute('role', 'listbox');
  for (const group of RECIPE_GROUPS) {
    const ids = RECIPE_IDS.filter((id) => RECIPES[id].group === group && (!state.canOnly || woodworking.canMake(id) > 0));
    if (ids.length === 0) continue;
    list.append(el('div', 'book-group', group));
    for (const id of ids) list.append(row(id));
  }
  if (!list.querySelector('.book-row')) list.append(el('p', 'book-empty', 'Nothing you can make with what’s in your bag. Fell some trees, or untick the filter to see every recipe.'));
  return el('div', 'book', el('div', 'book-side', filter, list, bookLegend()), detail(state.picked));

  function row(id: RecipeId): HTMLElement {
    const recipe = RECIPES[id];
    const can = woodworking.canMake(id);
    const count = woodworking.knows(id) ? (can > 0 ? String(can) : '') : String(recipe.needs); // (how many now; not reached: the level it wants)
    const button = bookRow({ id, kind: 'recipe', name: recipe.name, needs: recipe.needs, level, picked: id === state.picked, best: id === best, count, onPick: () => [(state.picked = id), (state.count = 1), redraw()] });
    if (woodworking.making?.recipe === id) button.classList.add('making');
    return button;
  }

  function detail(id: RecipeId): HTMLElement {
    const recipe = RECIPES[id];
    const known = woodworking.knows(id);
    const can = woodworking.canMake(id);
    const item = makesOf(id);
    const gear = typeof recipe.makes !== 'string';
    const title = el('h3', 'book-title', gear ? `${recipe.name}` : nameOf(item));
    title.style.color = gear ? QUALITY_INK[qualityOf(item)] : '';
    const kind = gear ? gearLines(item as never).map((l, i) => el('span', i === 0 ? 'book-kind' : 'book-stat', lineText(l))) : [el('span', 'book-kind', LOOT[item as LootId] && (RECIPES[id].group === 'Goods' ? `Trade good · sells for ${LOOT[item as LootId].value} copper` : 'Crafting material'))];
    const needs = needsLine('Woodworking', recipe.needs, level);
    const materials = el('ul', 'book-materials');
    for (const [material, n] of Object.entries(recipe.from)) {
      const have = model.hero.bag[material as LootId] ?? 0;
      materials.append(el('li', have >= n! ? 'had' : 'short', el('span', 'book-material-icon', bagIcon(material as LootId)(30)), el('span', 'book-material-name', nameOf(material as LootId)), el('b', undefined, `${have}/${n}`)));
    }
    state.count = Math.max(1, Math.min(state.count, Math.max(1, can)));
    const count = el('span', 'book-count-now', String(state.count));
    const step = (by: number) => {
      const b = el('button', 'book-step', by < 0 ? '−' : '+');
      b.disabled = by < 0 ? state.count <= 1 : state.count >= can;
      b.setAttribute('aria-label', by < 0 ? 'One fewer' : 'One more');
      b.addEventListener('click', () => [(state.count += by), redraw()]);
      return b;
    };
    const craft = el('button', 'book-craft', can > 1 && state.count > 1 ? `Craft ${state.count}` : 'Craft');
    const all = el('button', 'book-craft quiet', can > 0 ? `Craft all (${can})` : 'Craft all');
    const room = woodworking.roomFor(id);
    craft.disabled = all.disabled = can === 0 || !room || !!woodworking.making;
    craft.addEventListener('click', () => [woodworking.start(id, state.count), redraw()]);
    all.addEventListener('click', () => [woodworking.start(id, Infinity), redraw()]);
    const why = !known ? `Reach Woodworking ${recipe.needs} to learn it.` : can === 0 ? 'Not enough materials in your bag.' : !room ? 'No room in your bag for it.' : '';
    return el(
      'div',
      'book-detail',
      el('div', 'book-head', el('span', 'book-icon', bagIcon(typeof recipe.makes === 'string' ? recipe.makes : recipe.makes.item)(56)), el('div', 'book-what', title, ...kind)),
      needs,
      el('span', 'book-label', 'Materials'),
      materials,
      el('div', 'book-actions', el('span', 'book-stepper', step(-1), count, step(1)), craft, all),
      ...(why ? [el('p', 'book-why', why)] : []),
      ...(craftStatus(model, redraw) ? [craftStatus(model, redraw)!] : []),
    );
  }
}

// What's being made, as a card (none: nothing): its icon and name, how many of how many, a bar filling toward the
// next, a button to stop it.
export function craftStatus(model: GameModel, redraw: () => void): HTMLElement | null {
  const making = model.woodworking.making;
  if (!making) return null;
  const recipe = RECIPES[making.recipe];
  const makes = typeof recipe.makes === 'string' ? recipe.makes : recipe.makes.item;
  const stop = el('button', 'book-craft quiet', 'Stop');
  stop.addEventListener('click', () => [model.woodworking.stop(), redraw()]);
  return el(
    'div',
    'craft-status',
    el('div', 'craft-status-head', el('span', 'book-material-icon', bagIcon(makes)(30)), el('span', 'craft-status-text', el('b', undefined, `Crafting ${recipe.name}`), el('span', undefined, `${making.of - making.left + 1} of ${making.of}`)), stop),
    el('span', 'craft-progress', el('i')),
  );
}

// The bar of what's being made, filled as far as it's come (each frame: the window's only drawn again as things change).
export function recipeProgress(model: GameModel, root: ParentNode = document): void {
  for (const fill of Array.from(root.querySelectorAll<HTMLElement>('.craft-progress > i'))) fill.style.width = `${Math.round((model.woodworking.progress ?? 0) * 1000) / 10}%`;
}

// What the recipe book shows, in a word (to know when to draw it again): the skill, the bag's materials, what's made.
export function recipeState(model: GameModel): string {
  const { woodworking, hero } = model;
  const materials = new Set(RECIPE_IDS.flatMap((id) => Object.keys(RECIPES[id].from)));
  return `${skillOf(hero, 'woodworking').level}|${[...materials].map((m) => hero.bag[m as LootId] ?? 0).join(',')}|${woodworking.making ? `${woodworking.making.recipe}:${woodworking.making.left}` : ''}`;
}

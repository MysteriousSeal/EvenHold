// A crafting skill's recipes (model/skills/woodworking.ts; and cooking.ts's, by its own Craft: cookBook.ts), as WoW's
// tradeskill window has them, in the skill's own window (skillWindow.ts): on the left, the recipes under what they make (materials, goods, weapons, shields), each
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
import { RECIPES, RECIPE_GROUPS, RECIPE_IDS } from '../../model/skills/woodworking';
import type { ItemId } from '../../model/human/equipment';
import type { Rarity } from '../../model/human/items/gear';
import { bagIcon } from '../../view/ui/itemIcons';
import { QUALITY_INK } from '../../view/hud/lootPrompt';
import { lineText } from '../../view/ui/menu';
import { el } from '../../view/ui/dom';
import { gearLines } from '../hero/gearLines';

// What the window keeps between draws: the recipe picked, the filter, how many to make.
export interface BookState {
  picked: string | null;
  canOnly: boolean;
  count: number;
}
export const newBook = (): BookState => ({ picked: null, canOnly: false, count: 1 });

// A crafting skill as the book shows it: its recipes under their groups, who makes them (knows them, counts what the
// bag would make, starts and stops), what a made thing is called ("Trade good", "Food"), why not here, and its words.
export interface CraftRecipe {
  name: string;
  group: string;
  needs: number;
  from: Partial<Record<LootId, number>>;
  makes: LootId | { item: ItemId; level: number; rarity: Rarity };
}
export interface Crafter {
  readonly making: { recipe: string; left: number; of: number } | null;
  readonly progress: number | null;
  knows(id: string): boolean;
  canMake(id: string): number;
  roomFor(id: string): boolean;
  start(id: string, count?: number): boolean;
  stop(): void;
}
export interface Craft {
  skill: 'woodworking' | 'cooking';
  name: string; // the skill's ("Woodworking")
  recipes: Readonly<Record<string, CraftRecipe>>;
  ids: readonly string[];
  groups: readonly string[];
  crafter(model: GameModel): Crafter;
  kind(id: string): string; // what a material or goods made is, under its name
  notHere?(model: GameModel, id: string): string; // why it can't be made where the hero stands ('': it can)
  verb: string; // "Craft", "Cook"
  empty: string; // nothing to make with what's in the bag
}
export const WOODWORKING: Craft = {
  skill: 'woodworking',
  name: 'Woodworking',
  recipes: RECIPES,
  ids: RECIPE_IDS,
  groups: RECIPE_GROUPS,
  crafter: (model) => model.woodworking,
  kind: (id) => (RECIPES[id as keyof typeof RECIPES].group === 'Goods' ? `Trade good · sells for ${LOOT[RECIPES[id as keyof typeof RECIPES].makes as LootId].value} copper` : 'Crafting material'),
  verb: 'Craft',
  empty: 'Nothing you can make with what’s in your bag. Fell some trees, or untick the filter to see every recipe.',
};

const makesOf = (craft: Craft, id: string) => {
  const m = craft.recipes[id].makes;
  return typeof m === 'string' ? m : gearKey({ ...m, roll: 0 });
};

// The best of the recipes to learn from now: of those the bag would make, the one likeliest to raise the skill (the
// hardest, of those as likely); none, if none.
export function bestRecipe(model: GameModel, craft: Craft = WOODWORKING): string | null {
  const level = skillOf(model.hero, craft.skill).level;
  const needs = (id: string) => craft.recipes[id].needs;
  const can = craft.ids.filter((id) => craft.crafter(model).canMake(id) > 0 && difficulty(needs(id), level).chance > 0);
  return can.sort((a, b) => difficulty(needs(b), level).chance - difficulty(needs(a), level).chance || needs(b) - needs(a))[0] ?? null;
}

export function recipeBook(model: GameModel, state: BookState, redraw: () => void, craft: Craft = WOODWORKING): HTMLElement {
  const crafter = craft.crafter(model);
  const { recipes, ids } = craft;
  const level = skillOf(model.hero, craft.skill).level;
  const best = bestRecipe(model, craft);
  if (!state.picked || !(state.picked in recipes)) state.picked = best ?? ids.filter((id) => crafter.knows(id)).at(-1) ?? ids[0];

  // The list: a filter, the recipes under what they make, the colours' key.
  const filter = el('label', 'book-filter', el('input'), 'Can make now');
  const box = filter.querySelector('input')!;
  box.type = 'checkbox';
  box.checked = state.canOnly;
  box.addEventListener('change', () => [(state.canOnly = box.checked), redraw()]);
  const list = el('div', 'book-list');
  list.setAttribute('role', 'listbox');
  for (const group of craft.groups) {
    const shown = ids.filter((id) => recipes[id].group === group && (!state.canOnly || crafter.canMake(id) > 0));
    if (shown.length === 0) continue;
    list.append(el('div', 'book-group', group));
    for (const id of shown) list.append(row(id));
  }
  if (!list.querySelector('.book-row')) list.append(el('p', 'book-empty', craft.empty));
  return el('div', 'book', el('div', 'book-side', filter, list, bookLegend()), detail(state.picked));

  function row(id: string): HTMLElement {
    const recipe = recipes[id];
    const can = crafter.canMake(id);
    const count = crafter.knows(id) ? (can > 0 ? String(can) : '') : String(recipe.needs); // (how many now; not reached: the level it wants)
    const button = bookRow({ id, kind: 'recipe', name: recipe.name, needs: recipe.needs, level, picked: id === state.picked, best: id === best, count, onPick: () => [(state.picked = id), (state.count = 1), redraw()] });
    if (crafter.making?.recipe === id) button.classList.add('making');
    return button;
  }

  function detail(id: string): HTMLElement {
    const recipe = recipes[id];
    const known = crafter.knows(id);
    const can = crafter.canMake(id);
    const item = makesOf(craft, id);
    const gear = typeof recipe.makes !== 'string';
    const title = el('h3', 'book-title', gear ? `${recipe.name}` : nameOf(item));
    title.style.color = gear ? QUALITY_INK[qualityOf(item)] : '';
    const kind = gear ? gearLines(item as never).map((l, i) => el('span', i === 0 ? 'book-kind' : 'book-stat', lineText(l))) : [el('span', 'book-kind', LOOT[item as LootId] && craft.kind(id))];
    const needs = needsLine(craft.name, recipe.needs, level);
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
    const verb = craft.verb;
    const one = el('button', 'book-craft', can > 1 && state.count > 1 ? `${verb} ${state.count}` : verb);
    const all = el('button', 'book-craft quiet', can > 0 ? `${verb} all (${can})` : `${verb} all`);
    const room = crafter.roomFor(id);
    const notHere = known && can > 0 ? (craft.notHere?.(model, id) ?? '') : '';
    one.disabled = all.disabled = can === 0 || !room || !!crafter.making || !!notHere;
    one.addEventListener('click', () => [crafter.start(id, state.count), redraw()]);
    all.addEventListener('click', () => [crafter.start(id, Infinity), redraw()]);
    const why = !known ? `Reach ${craft.name} ${recipe.needs} to learn it.` : can === 0 ? 'Not enough materials in your bag.' : !room ? 'No room in your bag for it.' : notHere;
    return el(
      'div',
      'book-detail',
      el('div', 'book-head', el('span', 'book-icon', bagIcon(typeof recipe.makes === 'string' ? recipe.makes : recipe.makes.item)(56)), el('div', 'book-what', title, ...kind)),
      needs,
      el('span', 'book-label', 'Materials'),
      materials,
      el('div', 'book-actions', el('span', 'book-stepper', step(-1), count, step(1)), one, all),
      ...(why ? [el('p', 'book-why', why)] : []),
      ...(craftStatus(model, redraw, craft) ? [craftStatus(model, redraw, craft)!] : []),
    );
  }
}

// What's being made, as a card (none: nothing): its icon and name, how many of how many, a bar filling toward the
// next, a button to stop it.
export function craftStatus(model: GameModel, redraw: () => void, craft: Craft = WOODWORKING): HTMLElement | null {
  const crafter = craft.crafter(model);
  const making = crafter.making;
  if (!making) return null;
  const recipe = craft.recipes[making.recipe];
  const makes = typeof recipe.makes === 'string' ? recipe.makes : recipe.makes.item;
  const stop = el('button', 'book-craft quiet', 'Stop');
  stop.addEventListener('click', () => [crafter.stop(), redraw()]);
  return el(
    'div',
    'craft-status',
    el('div', 'craft-status-head', el('span', 'book-material-icon', bagIcon(makes)(30)), el('span', 'craft-status-text', el('b', undefined, `${craft.verb === 'Cook' ? 'Cooking' : 'Crafting'} ${recipe.name}`), el('span', undefined, `${making.of - making.left + 1} of ${making.of}`)), stop),
    el('span', 'craft-progress', el('i')),
  );
}

// The bar of what's being made, filled as far as it's come (each frame: the window's only drawn again as things change).
export function recipeProgress(model: GameModel, root: ParentNode = document, craft: Craft = WOODWORKING): void {
  for (const fill of Array.from(root.querySelectorAll<HTMLElement>('.craft-progress > i'))) fill.style.width = `${Math.round((craft.crafter(model).progress ?? 0) * 1000) / 10}%`;
}

// What the recipe book shows, in a word (to know when to draw it again): the skill, the bag's materials, what's made.
export function recipeState(model: GameModel, craft: Craft = WOODWORKING): string {
  const { hero } = model;
  const crafter = craft.crafter(model);
  const materials = new Set(craft.ids.flatMap((id) => Object.keys(craft.recipes[id].from)));
  return `${skillOf(hero, craft.skill).level}|${[...materials].map((m) => hero.bag[m as LootId] ?? 0).join(',')}|${crafter.making ? `${crafter.making.recipe}:${crafter.making.left}` : ''}|${craft.ids.map((id) => craft.notHere?.(model, id) ?? '').join('')}`;
}

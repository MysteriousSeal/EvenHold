// Alchemy's page of the skill's window (skillWindow.ts), two halves under a switch: Brewing, the recipe book
// (recipeBook.ts) with alchemy's recipes (model/skills/alchemy.ts), each brew told as a potion (what it does), brewed
// only at a still (said so, picked, when there's none), the still they stand by over it; and Herbs, the guide to
// what's picked (model/loot/herbs.ts): on the left the herbs, each in the colour of how much it'd still teach, those up
// this season marked; on the right the one picked: where it grows and when, whether it's up now, what's brewed of it.

import type { GameModel } from '../../model/GameModel';
import { BREW_GROUPS, BREW_RECIPES, BREW_RECIPE_IDS, KIT_SLOWER, type BrewRecipeId } from '../../model/skills/alchemy';
import { HERBS, HERB_IDS, type HerbId } from '../../model/loot/herbs';
import { SEASONS } from '../../model/clock';
import { potionText } from '../../model/loot/potions';
import { nameOf } from '../../model/hero/bag';
import { skillOf } from '../../model/skills/skills';
import { capitalize } from '../../util/text';
import { bagIcon } from '../../view/ui/itemIcons';
import { el } from '../../view/ui/dom';
import { recipeBook, type BookState, type Craft } from './recipeBook';
import { bookLegend, bookRow, needsLine } from './bookParts';

export const ALCHEMY: Craft = {
  skill: 'alchemy',
  name: 'Alchemy',
  recipes: BREW_RECIPES,
  ids: BREW_RECIPE_IDS,
  groups: BREW_GROUPS,
  crafter: (model) => model.alchemy,
  kind: (id) => `Potion · ${potionText(BREW_RECIPES[id as BrewRecipeId].makes)}`,
  notHere: (model) => (model.alchemy.stillInReach ? '' : 'Stand before a cauldron to brew (a herbalist’s, your own), or by a fire with a brewer’s kit.'),
  verb: 'Brew',
  empty: 'Nothing you can brew with what’s in your bag. Pick herbs (see Herbs above), or untick the filter to see every recipe.',
};

// What the page keeps between draws: which half, the recipe picked (the book's), the herb picked.
export interface AlchemyPage {
  half: 'brew' | 'herbs';
  book: BookState;
  herb: HerbId | null;
}

// The line over the book: the still they're by, or none (and how to have one).
function stillLine(model: GameModel): HTMLElement {
  const still = model.alchemy.stillInReach;
  if (still) return el('p', 'cook-fire lit', still.kind === 'cauldron' ? 'At a cauldron: everything can be brewed here.' : `By a fire with your brewer’s kit: everything, a little slower (×${KIT_SLOWER}).`);
  const kit = (model.hero.bag.brewersKit ?? 0) > 0;
  return el('p', 'cook-fire', kit ? 'No still here: stand by a fire with your kit, or before a cauldron.' : 'No still here: a cauldron (a herbalist’s, your own), or a brewer’s kit by a fire (the herbalists sell them).');
}

// The herbs: each by the colour of how much it'd teach, the level it wants, those up this season marked.
function herbGuide(model: GameModel, page: AlchemyPage, redraw: () => void): HTMLElement {
  const level = skillOf(model.hero, 'alchemy').level;
  const season = model.herbs.season;
  page.herb ??= [...HERB_IDS].reverse().find((id) => HERBS[id].needs <= level && HERBS[id].seasons.includes(season)) ?? HERB_IDS[0];
  const list = el('div', 'book-list');
  list.setAttribute('role', 'listbox');
  list.append(el('div', 'book-group', `Herbs · ${capitalize(season)} now`));
  for (const id of HERB_IDS) {
    const up = HERBS[id].seasons.includes(season);
    list.append(bookRow({ id, kind: 'grade', name: nameOf(id), needs: HERBS[id].needs, level, picked: id === page.herb, best: false, count: up ? 'in season' : '', onPick: () => [(page.herb = id), redraw()] }));
  }
  return el('div', 'book', el('div', 'book-side', list, bookLegend()), detail(page.herb));

  function detail(id: HerbId): HTMLElement {
    const herb = HERBS[id];
    const up = herb.seasons.includes(season);
    const brews = BREW_RECIPE_IDS.filter((r) => id in BREW_RECIPES[r].from).map((r) => BREW_RECIPES[r].name);
    const facts = el(
      'dl',
      'book-facts',
      el('dt', undefined, 'Grows in'),
      el('dd', undefined, herb.in.map((b) => (b === 'heath' ? 'the moors' : b === 'hills' ? 'the hills' : b === 'forest' ? 'the woods' : b === 'marsh' ? 'the marsh' : 'the meadows')).join(', ')),
      el('dt', undefined, 'Up in'),
      el('dd', undefined, SEASONS.filter((s) => herb.seasons.includes(s)).join(', ')),
      el('dt', undefined, 'A second herb'),
      el('dd', undefined, model.herbs.secondHerbChance(level) > 0 ? `${Math.round(model.herbs.secondHerbChance(level) * 100)}% a pick` : 'From Alchemy 100'),
      el('dt', undefined, 'Brewed into'),
      el('dd', undefined, brews.length ? brews.join(', ') : 'Nothing yet: sold to a herbalist'),
    );
    return el(
      'div',
      'book-detail',
      el('div', 'book-head', el('span', 'book-icon', bagIcon(id)(56)), el('div', 'book-what', el('h3', 'book-title', nameOf(id)), el('span', 'book-kind', herb.about))),
      needsLine('Alchemy', herb.needs, level),
      facts,
      el('p', up ? 'book-tool had' : 'book-tool short', up ? `In season: up now, in ${season}.` : `Out of season: not up in ${season}.`),
      el('p', 'book-why', 'Stand by a patch of it and press E: you pick on your own, a herb at a time, till it’s bare. A day after, it’s back. The same patch grows something else as the seasons turn.'),
    );
  }
}

export function alchemyBook(model: GameModel, page: AlchemyPage, redraw: () => void): HTMLElement {
  const tab = (half: AlchemyPage['half'], label: string) => {
    const b = el('button', `book-craft${page.half === half ? '' : ' quiet'}`, label);
    b.setAttribute('aria-pressed', String(page.half === half));
    b.addEventListener('click', () => [(page.half = half), redraw()]);
    return b;
  };
  const halves = el('p', 'alchemy-halves', tab('brew', 'Brewing'), tab('herbs', 'Herbs'));
  return page.half === 'herbs' ? el('div', 'cook-page', halves, herbGuide(model, page, redraw)) : el('div', 'cook-page', halves, stillLine(model), recipeBook(model, page.book, redraw, ALCHEMY));
}

// What the page shows, in a word (to know when to draw it again): its half, the still, the season.
export const alchemyState = (model: GameModel, page: AlchemyPage): string => `${page.half}|${model.alchemy.stillInReach?.kind ?? ''}|${model.herbs.season}`;

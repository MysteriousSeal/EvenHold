// Fishing's guide (model/skills/fishing.ts), in the skill's own window (skillWindow.ts), as the lumberjack's trees are
// (woodGuide.ts): on the left, what bites (small fry to what the water hides), each in the colour of how much it'd
// still teach, the level it wants, the best to learn from starred; on the right, the one picked: what it wants of the
// skill and how much it'd teach, where it bites, how often of the bites there, how long a bite's wait is for the hero,
// how quick it's off the hook, whether one bites now and then before its level;
// whether they've a rod in the bag (and where one's had); how it's done.

import type { GameModel } from '../../model/GameModel';
import { nameOf } from '../../model/hero/bag';
import { CATCHES, catchesAt, isFish, riseOf, weightOf, type Catch, type Waters } from '../../model/skills/fishing';
import type { LootId } from '../../model/loot/loot';
import { skillOf } from '../../model/skills/skills';
import { bookLegend, bookRow, needsLine } from './bookParts';
import { bagIcon } from '../../view/ui/itemIcons';
import { el } from '../../view/ui/dom';

const WHERE: Record<Waters, string> = {
  any: 'Any lake, from any shore.',
  narrows: "A lake's narrows: its thin arms and inlets, little water round the line.",
  open: "A lake's open water: wide water round the line.",
  deep: 'The deep: where the line lies far from any bank, in a broad lake.',
};
// A spot of that water (to weigh a catch against the rest that bite there).
const SPOT: Record<Waters, { narrows: boolean; deep: boolean }> = { any: { narrows: false, deep: false }, narrows: { narrows: true, deep: false }, open: { narrows: false, deep: false }, deep: { narrows: false, deep: true } };

// The best catch to learn from now: the hardest fish they can land that still teaches (not what the water hides: rare,
// and no one fishes for it); none, if none.
export function bestCatch(level: number): Catch | null {
  return [...CATCHES].reverse().find((fish) => isFish(fish.item) && fish.needs <= level && riseOf(fish, level).chance > 0) ?? null;
}

export function fishGuide(model: GameModel, state: { picked: LootId | null }, redraw: () => void): HTMLElement {
  const level = skillOf(model.hero, 'fishing').level;
  const best = bestCatch(level);
  state.picked ??= best?.item ?? CATCHES[0].item;
  const list = el('div', 'book-list');
  list.setAttribute('role', 'listbox');
  list.append(el('div', 'book-group', 'Catches'));
  for (const fish of CATCHES) {
    list.append(bookRow({ id: fish.item, kind: 'grade', name: nameOf(fish.item), needs: fish.needs, level, picked: fish.item === state.picked, best: fish === best, rise: riseOf(fish, level), count: String(fish.needs), onPick: () => [(state.picked = fish.item), redraw()] }));
  }
  return el('div', 'book', el('div', 'book-side', list, bookLegend()), detail(CATCHES.find((fish) => fish.item === state.picked) ?? CATCHES[0]));

  function detail(fish: Catch): HTMLElement {
    const needs = needsLine('Fishing', fish.needs, level, riseOf(fish, level));
    const there = catchesAt(SPOT[fish.in], Math.max(level, fish.needs)); // (what else bites there, at their level or, beyond them yet, at its)
    const at = Math.max(level, fish.needs);
    const share = weightOf(fish, at) / there.reduce((sum, f) => sum + weightOf(f, at), 0);
    const [least, most] = model.fishing.waitSeconds;
    const facts = el(
      'dl',
      'book-facts',
      el('dt', undefined, 'Bites in'),
      el('dd', undefined, WHERE[fish.in]),
      el('dt', undefined, 'Of the bites there'),
      el('dd', undefined, `${Math.max(1, Math.round(share * 100))}%`),
      el('dt', undefined, 'Wait for a bite'),
      el('dd', undefined, `${Math.round(least)}–${Math.round(most)} seconds`),
      el('dt', undefined, 'To hook it'),
      el('dd', undefined, `${fish.window} seconds, once it bites`),
      ...(fish.early !== undefined ? [el('dt', undefined, 'A lucky one'), el('dd', undefined, `Now and then from Fishing ${fish.early}, before it's yours`)] : []),
    );
    const rod = model.fishing.rod;
    return el(
      'div',
      'book-detail',
      el('div', 'book-head', el('span', 'book-icon', bagIcon(fish.item)(56)), el('div', 'book-what', el('h3', 'book-title', nameOf(fish.item)), el('span', 'book-kind', WHERE[fish.in]))),
      needs,
      facts,
      el('p', rod ? 'book-tool had' : 'book-tool short', rod ? 'You have a fishing rod in your bag.' : 'You need a fishing rod in your bag: every pedlar on the roads carries one.'),
      el('p', 'book-why', 'Stand on a lake shore facing the water and press E. When the bobber dips, press E again, quick, to hook it; walk away, or press E while you wait, to reel in.'),
    );
  }
}

// Mining's guide (model/skills/mining.ts), in the skill's own window (skillWindow.ts), as the lumberjack's trees are
// (woodGuide.ts): on the left, the veins it works (copper to star-iron), each in the colour of how much it'd still teach,
// the level it wants, the best to learn from starred; on the right, the one picked: its ore, what it wants of the skill
// and how much it'd teach, how many strikes a rock gives, the hero's own chance of a second lump, what's found with it
// now and then; whether they've a pickaxe in the bag (and where one's had); where to find that vein.

import type { GameModel } from '../../model/GameModel';
import { nameOf } from '../../model/hero/bag';
import { VEINS, riseOf, type Vein } from '../../model/skills/mining';
import { skillOf } from '../../model/skills/skills';
import { bookLegend, bookRow, needsLine } from './bookParts';
import { bagIcon } from '../../view/ui/itemIcons';
import { el } from '../../view/ui/dom';
import { capitalize } from '../../util/text';

const KINDS = Object.keys(VEINS) as Vein[];
const WHERE: Record<Vein, string> = {
  copper: 'Green-stained seams: the commonest, in rocks everywhere.',
  tin: 'Dull black grains in the stone: common, in rocks everywhere.',
  iron: 'Rust-red streaks: in one rock in five.',
  silver: 'Pale grey glints: rarer, in rocks everywhere.',
  gold: 'Yellow specks in white quartz: the rarest of the lowland veins.',
  starIron: 'Blue-black, glittering: only in the rocks of the high ground, the hills and the moor.',
};

// The best vein to learn from now: the hardest they can mine that still teaches; none, if none.
export function bestVein(level: number): Vein | null {
  return [...KINDS].reverse().find((v) => VEINS[v].needs <= level && riseOf(v, level).chance > 0) ?? null;
}

export function mineGuide(model: GameModel, state: { picked: Vein | null }, redraw: () => void): HTMLElement {
  const level = skillOf(model.hero, 'mining').level;
  const best = bestVein(level);
  state.picked ??= best ?? KINDS[0];
  const list = el('div', 'book-list');
  list.setAttribute('role', 'listbox');
  list.append(el('div', 'book-group', 'Veins'));
  for (const vein of KINDS) {
    const ore = VEINS[vein];
    list.append(bookRow({ id: vein, kind: 'grade', name: capitalize(ore.name), needs: ore.needs, level, picked: vein === state.picked, best: vein === best, rise: riseOf(vein, level), count: String(ore.needs), onPick: () => [(state.picked = vein), redraw()] }));
  }
  return el('div', 'book', el('div', 'book-side', list, bookLegend()), detail(state.picked));

  function detail(vein: Vein): HTMLElement {
    const ore = VEINS[vein];
    const needs = needsLine('Mining', ore.needs, level, riseOf(vein, level));
    const second = model.mining.secondOreChance(level);
    const facts = el(
      'dl',
      'book-facts',
      el('dt', undefined, 'Strikes in a rock'),
      el('dd', undefined, '4–6 a boulder, 8–12 an outcrop'),
      el('dt', undefined, 'Ore a strike'),
      el('dd', undefined, `1 ${nameOf(ore.ore)}`),
      el('dt', undefined, 'A second lump'),
      el('dd', undefined, second > 0 ? `${Math.round(second * 100)}% a strike` : 'From Mining 100'),
      ...(ore.finds?.length ? [el('dt', undefined, 'Found now and then'), ...ore.finds.map((find) => el('dd', undefined, `${nameOf(find.item)}: ${Math.round(find.chance * 100)}% a strike${level < find.from ? `, from ${find.from}` : ''}`))] : []),
    );
    const pick = model.mining.pick;
    return el(
      'div',
      'book-detail',
      el('div', 'book-head', el('span', 'book-icon', bagIcon(ore.ore)(56)), el('div', 'book-what', el('h3', 'book-title', capitalize(ore.name)), el('span', 'book-kind', WHERE[vein]))),
      needs,
      facts,
      el('p', pick ? 'book-tool had' : 'book-tool short', pick ? 'You have a pickaxe in your bag.' : 'You need a pickaxe in your bag: the smith sells them.'),
      el('p', 'book-why', 'Stand by a boulder or an outcrop and press E. You strike on your own; walk away or press E again to stop. A rock worked out keeps its shape, its vein gone.'),
    );
  }
}

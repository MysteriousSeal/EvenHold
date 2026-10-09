// A gathering skill's guide (lumberjacking: model/skills/lumber.ts), in the skill's own window (skillWindow.ts): on the
// left, the trees it fells (birch to ancient oak), each in the colour of how much it'd still teach, the level it
// wants, the best to learn from starred; on the right, the one picked: its log, what it wants of the skill and how
// much it'd teach, how many chops it takes, logs a chop, what's found in it now and then, the hero's own chance of a
// second log; whether they've an axe to hand (in hand or in the pack; and where one's had); where to find that kind of tree.

import type { GameModel } from '../../model/GameModel';
import { nameOf } from '../../model/hero/bag';
import { WOOD, gradeChops, type Grade } from '../../model/skills/lumber';
import { difficulty, skillOf } from '../../model/skills/skills';
import { bookLegend, bookRow, needsLine } from './bookParts';
import { bagIcon } from '../../view/ui/itemIcons';
import { el } from '../../view/ui/dom';
import { capitalize } from '../../util/text';

const GRADES = Object.keys(WOOD) as Grade[];
const WHERE: Record<Grade, string> = {
  birch: 'Slender white trunks, in every wood.',
  pine: 'Tall dark spires, thick on the hills.',
  oak: 'Broad, low crowns, all over the lowlands.',
  ancientPine: 'One pine in a dozen, grown old: a darker crown among its kind.',
  ancientOak: 'One oak in a dozen, grown old: a darker crown among its kind.',
};

// The best tree to learn from now: the hardest they can fell that still teaches; none, if none.
export function bestGrade(level: number): Grade | null {
  return [...GRADES].reverse().find((g) => WOOD[g].needs <= level && difficulty(WOOD[g].needs, level).chance > 0) ?? null;
}

export function woodGuide(model: GameModel, state: { picked: Grade | null }, redraw: () => void): HTMLElement {
  const level = skillOf(model.hero, 'lumberjacking').level;
  const best = bestGrade(level);
  state.picked ??= best ?? GRADES[0];
  const list = el('div', 'book-list');
  list.setAttribute('role', 'listbox');
  list.append(el('div', 'book-group', 'Trees'));
  for (const grade of GRADES) {
    const wood = WOOD[grade];
    list.append(bookRow({ id: grade, kind: 'grade', name: capitalize(wood.name), needs: wood.needs, level, picked: grade === state.picked, best: grade === best, count: String(wood.needs), onPick: () => [(state.picked = grade), redraw()] }));
  }
  return el('div', 'book', el('div', 'book-side', list, bookLegend()), detail(state.picked));

  function detail(grade: Grade): HTMLElement {
    const wood = WOOD[grade];
    const needs = needsLine('Lumberjacking', wood.needs, level);
    const [least, most] = gradeChops(grade);
    const second = model.lumber.secondLogChance(level);
    const facts = el(
      'dl',
      'book-facts',
      el('dt', undefined, 'Chops to fell it'),
      el('dd', undefined, least === most ? String(least) : `${least}–${most}`),
      el('dt', undefined, 'Logs a chop'),
      el('dd', undefined, `${wood.logs} ${nameOf(wood.log)}${wood.logs > 1 ? 's' : ''}`),
      el('dt', undefined, 'A second log'),
      el('dd', undefined, second > 0 ? `${Math.round(second * 100)}% a chop` : 'From Lumberjacking 100'),
      ...(wood.find ? [el('dt', undefined, 'Found now and then'), el('dd', undefined, `${nameOf(wood.find.item)}: ${Math.round(wood.find.chance * 100)}% a chop${level < wood.find.from ? `, from ${wood.find.from}` : ''}`)] : []),
    );
    const axe = model.lumber.axe;
    return el(
      'div',
      'book-detail',
      el('div', 'book-head', el('span', 'book-icon', bagIcon(wood.log)(56)), el('div', 'book-what', el('h3', 'book-title', capitalize(wood.name)), el('span', 'book-kind', WHERE[grade]))),
      needs,
      facts,
      el('p', axe ? 'book-tool had' : 'book-tool short', axe ? 'You have an axe to hand.' : 'You need an axe, in hand or in your pack: a hatchet from the smith will do.'),
      el('p', 'book-why', 'Stand by a trunk and press E. You chop on your own; walk away or press E again to stop.'),
    );
  }
}

// A gathering skill's guide (lumberjacking: model/skills/lumber.ts), in the skill's own window (skillWindow.ts): on the
// left, the trees it fells (birch to ancient oak), each in the colour of how much it'd still teach, the level it
// wants, the best to learn from starred; on the right, the one picked: its log, what it wants of the skill and how
// much it'd teach, how many chops it takes, logs a chop, what's found in it now and then, the hero's own chance of a
// second log; whether they've an axe in hand (and where one's had); where to find that kind of tree.

import type { GameModel } from '../../model/GameModel';
import { nameOf } from '../../model/hero/bag';
import { WOOD, gradeChops, type Grade } from '../../model/skills/lumber';
import { RISE, difficulty, skillOf } from '../../model/skills/skills';
import { bagIcon } from '../../view/ui/itemIcons';
import { el } from '../../view/ui/dom';

const GRADES = Object.keys(WOOD) as Grade[];
const TEACHES = ['Always teaches', 'Often teaches', 'Rarely teaches', 'Teaches nothing more'];
const WHERE: Record<Grade, string> = {
  birch: 'Slender white trunks, in every wood.',
  pine: 'Tall dark spires, thick on the hills.',
  oak: 'Broad, low crowns, all over the lowlands.',
  ancientPine: 'One pine in a dozen, grown old: a darker crown among its kind.',
  ancientOak: 'One oak in a dozen, grown old: a darker crown among its kind.',
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
    const known = level >= wood.needs;
    const button = el('button', `book-row${grade === state.picked ? ' picked' : ''}${known ? '' : ' locked'}`);
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(grade === state.picked));
    button.dataset.grade = grade;
    const dot = el('i', 'book-dot');
    const name = el('span', 'book-name', cap(wood.name));
    if (known) [dot.style.background, name.style.color] = [difficulty(wood.needs, level).color, difficulty(wood.needs, level).color];
    button.append(dot, name, ...(grade === best ? [el('span', 'book-best', '★')] : []), el('span', 'book-count', String(wood.needs)));
    button.addEventListener('click', () => [(state.picked = grade), redraw()]);
    list.append(button);
  }
  const legend = el('div', 'book-legend', ...RISE.map((_r, i) => el('span', undefined, el('i'), TEACHES[i].replace(' teaches', '').replace('Teaches nothing more', 'Never'))));
  legend.querySelectorAll('i').forEach((dot, i) => (dot.style.background = RISE[i].color));
  return el('div', 'book', el('div', 'book-side', list, legend), detail(state.picked));

  function detail(grade: Grade): HTMLElement {
    const wood = WOOD[grade];
    const known = level >= wood.needs;
    const rise = difficulty(wood.needs, level);
    const needs = el('p', known ? 'book-needs' : 'book-needs short', `Requires Lumberjacking ${wood.needs}`);
    if (known) {
      const teach = el('span', 'book-teach', ` · ${TEACHES[RISE.indexOf(rise)]}`);
      teach.style.color = rise.color;
      needs.append(teach);
    }
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
      el('div', 'book-head', el('span', 'book-icon', bagIcon(wood.log)(56)), el('div', 'book-what', el('h3', 'book-title', cap(wood.name)), el('span', 'book-kind', WHERE[grade]))),
      needs,
      facts,
      el('p', axe ? 'book-tool had' : 'book-tool short', axe ? 'You have an axe in hand.' : 'You need an axe in hand: a hatchet from the smith will do.'),
      el('p', 'book-why', 'Stand by a trunk and press E. You chop on your own; walk away or press E again to stop.'),
    );
  }
}

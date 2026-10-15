// What a skill's window's lists are made of, whatever the skill (recipeBook.ts: a crafter's recipes; woodGuide.ts: a
// gatherer's trees): a row for each thing (its diamond and name in the colour of how much it'd still teach, starred
// if it's the best to learn from, a count; picked, framed; not reached yet, faded), the colours' key under the list,
// and the line of what it wants of the skill ("Requires Woodworking 150 · Often teaches").

import { MATERIAL_RISE, RISE, difficulty } from '../../model/skills/skills';
import { el } from '../../view/ui/dom';

// What each colour of difficulty says it teaches, in full (the line) and in short (the key); a material's, less.
const TEACHES = ['Always teaches', 'Often teaches', 'Sometimes teaches', 'Teaches nothing more'];
const SHORT = ['Always', 'Often', 'Sometimes', 'Never'];
const teachesOf = (rise: Rise): string => (rise === MATERIAL_RISE ? 'Rarely teaches' : TEACHES[RISE.findIndex((r) => r.name === rise.name)]);

type Rise = (typeof RISE)[number]; // (a thing's own, where it isn't its difficulty's: lumber.ts riseOf)

// A thing in a list, as a button: picked, it's told of beside the list.
export function bookRow(o: { id: string; kind: 'recipe' | 'grade'; name: string; needs: number; level: number; picked: boolean; best: boolean; count: string; rise?: Rise; onPick(): void }): HTMLButtonElement {
  const known = o.level >= o.needs;
  const button = el('button', `book-row${o.picked ? ' picked' : ''}${known ? '' : ' locked'}`);
  button.setAttribute('role', 'option');
  button.setAttribute('aria-selected', String(o.picked));
  button.dataset[o.kind] = o.id;
  const dot = el('i', 'book-dot');
  const name = el('span', 'book-name', o.name);
  if (known) dot.style.background = name.style.color = (o.rise ?? difficulty(o.needs, o.level)).color;
  button.append(dot, name, ...(o.best ? [el('span', 'book-best', '★')] : []), el('span', 'book-count', o.count));
  button.addEventListener('click', o.onPick);
  return button;
}

// The colours' key, under a list.
export function bookLegend(): HTMLElement {
  const legend = el('div', 'book-legend', ...SHORT.map((word) => el('span', undefined, el('i'), word)));
  legend.querySelectorAll('i').forEach((dot, i) => (dot.style.background = RISE[i].color));
  return legend;
}

// What a thing wants of the skill, and (reached) how much it'd teach, in its colour.
export function needsLine(skill: string, needs: number, level: number, its?: Rise): HTMLElement {
  const known = level >= needs;
  const line = el('p', known ? 'book-needs' : 'book-needs short', `Requires ${skill} ${needs}`);
  if (known) {
    const rise = its ?? difficulty(needs, level);
    const teach = el('span', 'book-teach', ` · ${teachesOf(rise)}`);
    teach.style.color = rise.color;
    line.append(teach);
  }
  return line;
}

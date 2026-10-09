// The skill window's page on Salvaging (skillWindow.ts), a book like the wood guide's (woodGuide.ts): down the left,
// what gear is made of (iron, leather, cloth, silver, wood: each with how many such pieces are carried); on the right,
// the one picked: its scrap, what gear is of it, what a rare piece leaves besides, the ask; and where the benches are.
import type { GameModel } from '../../model/GameModel';
import { nameOf } from '../../model/hero/bag';
import { baseOf } from '../../model/human/items/gear';
import { FINER_OF, MAKE_NAMES, SCRAP_OF, makeOf, type Make } from '../../model/skills/salvage';
import { skillOf } from '../../model/skills/skills';
import { el } from '../../view/ui/dom';
import { bagIcon } from '../../view/ui/itemIcons';
import { bookLegend, bookRow } from './bookParts';

const MAKES: Record<Make, { gear: string; finer: string }> = {
  iron: { gear: 'Blades, maces, axes and hammers; mail, plate and the heavier helms', finer: 'A tempered ingot' },
  leather: { gear: 'Hide, studded and fur gear; boots, bracers and breeches', finer: 'A tempered ingot' },
  cloth: { gear: 'Padding, linen, wool and silk; hoods, hose and cloaks', finer: 'A tempered ingot' },
  silver: { gear: 'Rings and amulets (a gem shard besides, off a stone)', finer: 'A cut gem' },
  wood: { gear: 'Clubs, staves, cudgels and plank shields', finer: 'A tempered ingot' },
};

export function salvageGuide(model: GameModel, state: { picked: Make | null }, redraw: () => void): HTMLElement {
  const level = skillOf(model.hero, 'salvaging').level;
  const carried = (make: Make) => model.salvage.candidates.filter((key) => makeOf(baseOf(key)) === make).reduce((n, key) => n + (model.hero.bag[key as keyof typeof model.hero.bag] ?? 0), 0);
  const list = el('div', 'book-list', el('div', 'book-group', 'What gear is made of'));
  for (const make of Object.keys(MAKES) as Make[]) {
    const n = carried(make);
    list.append(bookRow({ id: make, kind: 'grade', name: MAKE_NAMES[make], needs: 1, level, picked: state.picked === make, best: false, count: n ? `${n} carried` : '', onPick: () => [(state.picked = make), redraw()] }));
  }
  const picked = state.picked ?? 'iron';
  const facts = el(
    'dl',
    'book-facts',
    el('dt', undefined, 'Gear of it'),
    el('dd', undefined, MAKES[picked].gear),
    el('dt', undefined, 'Leaves'),
    el('dd', undefined, `${nameOf(SCRAP_OF[picked])}: one, and one more every six levels of the piece`),
    el('dt', undefined, 'A rare piece'),
    el('dd', undefined, `${MAKES[picked].finer} besides (two from an epic, three from a legendary)`),
    el('dt', undefined, 'Asks'),
    el('dd', undefined, 'Salvaging by the piece\'s level (level 1 to 3 from the start, level 20 at 52), and more for a rare one'),
  );
  const benches = model.salvage.benches.length;
  const detail = el(
    'div',
    'book-detail',
    el('div', 'book-head', el('span', 'book-icon', bagIcon(SCRAP_OF[picked])(56)), el('div', 'book-what', el('h3', 'book-title', MAKE_NAMES[picked]), el('span', 'book-kin', `Leaves ${nameOf(SCRAP_OF[picked]).toLowerCase()}, and ${nameOf(FINER_OF[picked]).toLowerCase()} from the rare`))),
    facts,
    el('p', 'book-tool had', `The bench: on every village\'s square, a step or two in from the well (${benches} known so far).`),
    el('p', 'book-why', 'Stand by it and press E: your gear in cases, the piece picked told of, and a button to break it down. It takes a moment; walking off drops it.'),
  );
  return el('div', 'book', el('div', 'book-side', list, bookLegend()), detail);
}

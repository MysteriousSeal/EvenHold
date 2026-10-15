// The skill window's page on Salvaging (skillWindow.ts), a book like the wood guide's (woodGuide.ts): down the left,
// what gear is made of (iron, leather, cloth, silver, wood: each with how many such pieces are carried); on the right,
// the one picked: its scrap, what gear is of it, what a rare piece leaves besides, the ask; and where the bench is.
import type { GameModel } from '../../model/GameModel';
import { nameOf } from '../../model/hero/bag';
import { FINER_AT, FINER_OF, MAKE_NAMES, PER_LEVEL, SCRAP_MOST, SCRAP_OF, TOO_HARD, salvageOf, type Make } from '../../model/skills/salvage';
import { skillOf } from '../../model/skills/skills';
import { el } from '../../view/ui/dom';
import { bagIcon } from '../../view/ui/itemIcons';
import { bookLegend, bookRow } from './bookParts';

const MAKES: Record<Make, { gear: string; finer: string }> = {
  iron: { gear: 'Blades, maces, axes and hammers; mail, plate and the heavier helms; rusty buckles, blades, spoons and arrowheads', finer: 'A tempered ingot' },
  leather: { gear: 'Hide, studded and fur gear; boots, bracers and breeches; torn pouches and matted pelts', finer: 'A tempered ingot' },
  cloth: { gear: 'Padding, linen, wool and silk; hoods, hose and cloaks; tattered shrouds', finer: 'A tempered ingot' },
  silver: { gear: 'Rings and amulets (a gem shard besides, off a stone); lockets, old coins and torcs (a runestone: its stone)', finer: 'A cut gem' },
  wood: { gear: 'Clubs, staves, cudgels and plank shields', finer: 'A tempered ingot' },
};

export function salvageGuide(model: GameModel, state: { picked: Make | null }, redraw: () => void): HTMLElement {
  const level = skillOf(model.hero, 'salvaging').level;
  const carried = (make: Make) => model.salvage.candidates.filter((key) => salvageOf(key).make === make).reduce((n, key) => n + (model.hero.bag[key as keyof typeof model.hero.bag] ?? 0), 0);
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
    el('dd', undefined, `${picked === 'wood' ? 'Planks (birch to level 5, pine to 12, oak above)' : nameOf(SCRAP_OF[picked])}: one, and one more every six levels of the piece; the more skilled your hand, more (to ${SCRAP_MOST} times over) and gem shards besides, a master's near what the piece sells for whole`),
    el('dt', undefined, 'A rare piece'),
    el('dd', undefined, `${MAKES[picked].finer} besides (two from an epic, three from a legendary), from Salvaging ${FINER_AT.rare} (an epic's ${FINER_AT.epic}, a legendary's ${FINER_AT.legendary})`),
    el('dt', undefined, 'Teaches'),
    el('dd', undefined, `Any piece can be broken down. What it teaches goes by its level: ${PER_LEVEL} of Salvaging a level past the first, more for a finer one (levels 1 to 7 an apprentice's, 8 to 13 a journeyman's, 14 to 19 an expert's, 20 on an artisan's); old iron, leather, linen and silver foes leave, an apprentice's. A piece more than ${TOO_HARD} past your skill teaches nothing yet; one as a woodworker or a smith makes it teaches little, and leaves half its scrap; one found on a foe teaches as several tries, the finer the more`),
  );
  const detail = el(
    'div',
    'book-detail',
    el('div', 'book-head', el('span', 'book-icon', bagIcon(SCRAP_OF[picked])(56)), el('div', 'book-what', el('h3', 'book-title', MAKE_NAMES[picked]), el('span', 'book-kind', `Leaves ${nameOf(SCRAP_OF[picked]).toLowerCase()}, and ${nameOf(FINER_OF[picked]).toLowerCase()} from the rare`))),
    facts,
    el('p', 'book-tool had', 'The bench: in every smithy, out on the floor, its vice toward the door.'),
    el('p', 'book-why', 'Stand by it and press E: your gear in cases, the piece picked told of, and a button to break it down. It takes a moment; walking off drops it.'),
  );
  return el('div', 'book', el('div', 'book-side', list, bookLegend()), detail);
}

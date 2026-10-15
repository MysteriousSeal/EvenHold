// How the second arc stands ("The Bishop's Saint"), as the rest of the game reads it (model.story.saint): worked
// out from how its quests stand (story.ts) and the ways the hero took (storyChoices.ts), never kept apart from them.
// The cathedral town reads it for its bishop and its cells, the roads for their witch-finders and pilgrims, the
// Undercroft for its gate.
import type { Point } from '../storyCast';
import { idOf } from '../storyTypes';

export interface SaintState {
  act: 0 | 1 | 2 | 3 | 4; // not begun; the empty wagon (home); the road of fires (the witch's village); Greyminster; over (the bargain struck)
  witch: 'freed' | 'handed' | 'left' | null; // what the hero did for the witch chained to her hearth
  ending: 'exposed' | 'kept' | null; // the false saint shown up (the bishop broken, the witch-finders scattered), or his gold taken and the secret kept
  open: boolean; // the stair under the altar, down into the Undercroft: the sister's key given
  carterHeld: boolean; // the carter in the bishop's cells
  carterGone: boolean; // and so not by his wagon at home (gone up the road, till he's brought home)
  town: Point | null; // Greyminster, once seen (or reckoned)
  carterName: string;
}

const WITCH = { free: 'freed', handed: 'handed', left: 'left' } as const;
const ENDING = { expose: 'exposed', gold: 'kept' } as const;

// `state`: how each quest stands, by key; `chose`: the way taken at a quest.
export function saintOf(state: ReadonlyMap<string, 'taken' | 'done'>, chose: (id: string) => string | undefined, town: Point | null, carter: string | null): SaintState {
  const stands = (id: string) => [...state].find(([key]) => idOf(key) === id)?.[1];
  const done = (id: string) => stands(id) === 'done';
  const act = !done('theLongRoad') ? 0 : !done('theRoadOut') ? 1 : !done('onToGreyminster') ? 2 : !done('theSaintsBargain') ? 3 : 4;
  return {
    act,
    witch: WITCH[chose('smokeOnTheRoad') as keyof typeof WITCH] ?? null,
    ending: ENDING[chose('theSaintsBargain') as keyof typeof ENDING] ?? null,
    open: !!stands('theStairUnderTheAltar'),
    carterHeld: act >= 1 && act < 4,
    carterGone: act >= 1 && !done('theRoadHome'),
    town,
    carterName: carter ?? 'the carter',
  };
}

// The key a quest of the arc that another follows is kept by: wherever it's set (its places far apart: the one
// before set in another), as the ledger has it, else as it's set on the maps.
export const keyBefore = (id: string, state: ReadonlyMap<string, unknown>, set: ReadonlyMap<string, unknown>): string =>
  [...state.keys(), ...set.keys()].find((key) => idOf(key) === id) ?? `${id}@first`;

// A pleasure worker's client let in, for the tests (model/jobs/roomShift.ts): the answer picked at the door, then
// the time it takes them to come in from the hallway and shut the door behind them, till they've their word to say.
import type { GameModel } from '../../src/model/GameModel';
import type { RoomShift } from '../../src/model/jobs/roomShift';
import type { Talk } from '../../src/model/story/story';

// `answer`: which of the hero's at the door (0: warm, 1: plain, 2: teasing). What the one come in says, as a talk.
export function comeIn(model: GameModel, shift: RoomShift, answer = 0): Talk {
  const met = model.work.meet();
  if (!met) throw new Error('no one at the door');
  const said = met.talk.answers[answer].pick();
  if (said) return said; // (no door to come by: said at once)
  for (let t = 0; t < 30; t += 0.1) {
    shift.update([], 0.1);
    const come = model.work.arrived();
    if (come) return come.talk;
  }
  throw new Error('the one let in never came');
}

// The one who's had their say, gone: out by the door, it shut after them.
export function seeOut(shift: RoomShift): void {
  for (let t = 0; t < 30 && shift.visitor; t += 0.1) shift.update([], 0.1);
}

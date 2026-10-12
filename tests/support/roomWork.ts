// A pleasure worker's shift, for the tests (model/jobs/room/roomShift.ts): begun at an inn, the hero taken up to the
// room; a client let in (the answer picked at the door, then the time it takes them to come in from the hallway and
// shut the door behind them, till they've their word to say), and seen out.
import type { GameModel } from '../../src/model/GameModel';
import type { Furniture } from '../../src/model/interiors/furniture';
import { letDoor, letRoomTiles } from '../../src/model/inn/roomLetting';
import { stairsOf, upstairsInside } from '../../src/model/interiors/upstairs';
import type { RoomShift } from '../../src/model/jobs/room/roomShift';
import type { Talk } from '../../src/model/story/story';

// A shift begun at the first inn (the hero in it, downstairs still).
export function startShift(model: GameModel): RoomShift {
  const inn = model.entrances.find((e) => e.type === 'inn')!;
  model.enterRoom(inn);
  if (!model.work.start(inn, 'innCompanion')) throw new Error('shift not begun');
  return model.work.shift as RoomShift;
}

// Up to the room that's theirs for the shift, stood in it (its door shut: the shift begins); the door.
export function goUp(model: GameModel): Furniture {
  const below = model.inside!;
  const inside = (model.inside = upstairsInside(below.entrance, below.room, stairsOf(below)!, model.seed, model.fullWalls));
  const [x, z] = letRoomTiles(inside)[0];
  Object.assign(model.hero, { x, z });
  return letDoor(inside.furniture)!;
}

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

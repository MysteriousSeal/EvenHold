// @vitest-environment happy-dom
// A word with whoever knocks at a pleasure worker's door, as the talk scene tells it (controller/story/talkPanel.ts,
// model/jobs/roomShift.ts): an answer may lead on to more, said in the same breath; Escape takes the way out (the
// one turned away, trouble let go), never an answer that lets someone in or calls the bouncer.
import { describe, expect, it } from 'vitest';
import { fresh } from './support/testWorld'; // (first: the game's own order of loading)
import { createTalkPanel } from '../src/controller/story/talkPanel';
import { maxEnergyOf } from '../src/model/hero/attributes';
import { letDoor } from '../src/model/inn/roomLetting';
import { roomsOff, stairsOf, upstairsInside } from '../src/model/interiors/upstairs';
import { LET_IN } from '../src/model/jobs/roomLines';
import type { RoomShift } from '../src/model/jobs/roomShift';

function atWork() {
  const model = fresh();
  const inn = model.entrances.find((e) => e.type === 'inn')!;
  model.enterRoom(inn);
  model.work.start(inn, 'innCompanion');
  const below = model.inside!;
  const inside = (model.inside = upstairsInside(inn, below.room, stairsOf(below)!, model.seed, model.fullWalls));
  const [x, z] = roomsOff(inside.furniture, inside.room).find((r) => r.doors.includes(letDoor(inside.furniture)!))!.tiles[0];
  Object.assign(model.hero, { x, z });
  const shift = model.work.shift as RoomShift;
  const panel = createTalkPanel(model, { setPaused: () => {} });
  // Someone of `kind` at the door (those who aren't: turned away).
  const knock = (trouble: boolean) => {
    for (let n = 0; n < 200; n++) {
      model.hero.energy = maxEnergyOf(model.hero);
      shift.left = 100;
      for (let t = 0; t < 40 && !shift.client; t++) shift.update([], 1);
      if ((shift.client!.kind !== 'plain') === trouble) return shift.client!;
      model.work.meet()!.talk.answers.at(-1)!.pick();
    }
    throw new Error('no such client came');
  };
  return { model, shift, panel, knock };
}
const key = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
const scene = () => document.body.querySelector('.talk-scene:last-of-type') as HTMLElement;
const labels = () => Array.from(scene().querySelectorAll('.talk-answer span')).map((b) => b.textContent);

describe("a word at a pleasure worker's door", () => {
  it('leads on, let in, to what they say inside and after; Escape at the door turns them away', () => {
    const { model, shift, panel, knock } = atWork();
    knock(false);
    const met = model.work.meet()!;
    const away = shift.turnedAway;
    expect(panel.show(met.who, met.talk)).toBe(true);
    key('Escape'); // (out: turned away, not let in)
    expect(panel.menu.isOpen).toBe(false);
    expect([shift.turnedAway, shift.served, shift.client]).toEqual([away + 1, 0, null]);
    // Let in, by an answer: the scene stays up, their next word begun.
    knock(false);
    const again = model.work.meet()!;
    panel.show(again.who, again.talk);
    key('Space');
    key('Space'); // (their line written out, then the hero's turn)
    expect(labels()[0]).toBe(LET_IN.warm);
    key('Digit2');
    expect(panel.menu.isOpen).toBe(true);
    expect(shift.client).not.toBeNull(); // (inside now: not yet paid)
    expect(scene().querySelector('.talk-words')!.textContent!.length).toBeLessThan(again.talk.lines[0].length + 200);
    panel.menu.close();
  });

  it("gives trouble nothing by Escape: let go, the bouncer left where he is", () => {
    const { model, shift, panel, knock } = atWork();
    const client = knock(true);
    const after = model.work.meet()!.talk.answers[0].pick()!; // (let in)
    after.night!();
    panel.show(client, after);
    const earned = shift.earned;
    key('Escape');
    expect(panel.menu.isOpen).toBe(false);
    expect(shift.client).toBeNull();
    if (client.kind === 'skinflint') expect(shift.earned).toBeLessThan(earned + 22); // (his half, no more)
    else expect([shift.earned, shift.unpaid]).toEqual([earned, 1]);
  });
});
